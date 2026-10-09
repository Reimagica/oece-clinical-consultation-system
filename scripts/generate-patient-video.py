"""Offline fixed video generation using MuseTalk 1.5 weights and its documented
VAE/UNet/Whisper feature pipeline. Manual crop is specific to the existing
synthetic Guoman portrait, avoiding full landmark/segmentation dependencies.
Sources: https://github.com/TMElyralab/MuseTalk (MIT license).
No online video service or runtime GPU endpoint is used.
"""
from pathlib import Path
import math,json,subprocess,hashlib
import torch,numpy as np,cv2,soundfile as sf,librosa,imageio_ffmpeg
from diffusers import AutoencoderKL,UNet2DConditionModel
from transformers import WhisperModel,WhisperFeatureExtractor
ROOT=Path.cwd();WORK=ROOT/'work/media';MODELS=WORK/'models';OUTPUT=ROOT/'public/assets/patient-video';OUTPUT.mkdir(parents=True,exist_ok=True)
device='cuda:0';dtype=torch.float16;fps=25;torch.manual_seed(42)
print('Loading MuseTalk/Whisper/VAE',flush=True)
vae=AutoencoderKL.from_pretrained(str(MODELS/'sd-vae'),local_files_only=True).to(device)
unet=UNet2DConditionModel(**json.loads((MODELS/'musetalk/musetalk.json').read_text())).to(dtype=dtype)
weights=torch.load(MODELS/'musetalk/unet.pth',map_location='cpu',weights_only=True);unet.load_state_dict(weights);del weights;unet.to(device).eval()
whisper=WhisperModel.from_pretrained(str(MODELS/'whisper'),local_files_only=True).to(device,dtype).eval()
extractor=WhisperFeatureExtractor.from_pretrained(str(MODELS/'whisper'),local_files_only=True)
base=cv2.imdecode(np.fromfile(ROOT/'public/assets/patient-guoman.png',dtype=np.uint8),cv2.IMREAD_COLOR);assert base is not None
# Explicit single-portrait crop; do not reuse as a generic face detector.
x1,y1,x2,y2=590,135,865,445
face=cv2.resize(base[y1:y2,x1:x2],(256,256));rgb=cv2.cvtColor(face,cv2.COLOR_BGR2RGB)
reference=torch.from_numpy(rgb.copy()).permute(2,0,1).float().unsqueeze(0).to(device)/255
masked=reference.clone();masked[:,:,128:]=0
with torch.inference_mode():
 latent=torch.cat([vae.encode(masked*2-1).latent_dist.sample()*vae.config.scaling_factor,vae.encode(reference*2-1).latent_dist.sample()*vae.config.scaling_factor],dim=1).to(dtype)
 audio,sr=sf.read(ROOT/'animation-source/patient-guoman-motion-guide.wav');audio=librosa.resample(audio[:int(sr*3)],orig_sr=sr,target_sr=16000)
 features=extractor(audio,return_tensors='pt',sampling_rate=16000).input_features.to(device,dtype)
 hidden=torch.stack(whisper.encoder(features,output_hidden_states=True).hidden_states,dim=2)[:,:len(audio)//320]
 hidden=torch.cat([torch.zeros_like(hidden[:,:4]),hidden,torch.zeros_like(hidden[:,:12])],dim=1)
 prompts=torch.cat([hidden[:,i*2:i*2+10] for i in range(75)],dim=0).reshape(75,50,384)
 pos=torch.arange(50,device=device).float().unsqueeze(1);freq=torch.exp(torch.arange(0,384,2,device=device).float()*(-math.log(10000)/384));pe=torch.zeros(50,384,device=device);pe[:,0::2]=torch.sin(pos*freq);pe[:,1::2]=torch.cos(pos*freq)
 prompts=(prompts+pe).to(dtype)
 del whisper,features,hidden;torch.cuda.empty_cache()
 # Feathered lower-face blending preserves the eyes, hair and the whole room.
 yy,xx=np.mgrid[y1:y2,x1:x2];mask=np.clip((1-((xx-730)/100)**2-((yy-351)/82)**2)*3,0,1)[...,None].astype(np.float32)
 frames=[]
 for i in range(0,75,3):
  output=unet(latent.repeat(min(3,75-i),1,1,1),torch.tensor([0],device=device),encoder_hidden_states=prompts[i:i+3]).sample
  decoded=(vae.decode(output.float()/vae.config.scaling_factor).sample/2+.5).clamp(0,1).permute(0,2,3,1).cpu().numpy()
  for generated in decoded:
   patch=cv2.resize((generated[:,:,::-1]*255).round().astype('uint8'),(x2-x1,y2-y1));frame=base.copy();frame[y1:y2,x1:x2]=(base[y1:y2,x1:x2]*(1-mask)+patch*mask).round().astype('uint8');frames.append(cv2.resize(frame,(640,480)))
  print('generated frames',len(frames),flush=True)
np.savez_compressed(WORK/'muse-frames.npz',frames=np.array(frames))
# Four clips share resolution, frame rate, crop and a poster underlay.
base_small=cv2.resize(base,(640,480));loop=frames[:]
for i in range(6):
 a=(i+1)/6;loop[-6+i]=cv2.addWeighted(loop[-6+i],1-a,loop[0],a,0)
clips={'talk-start':[cv2.addWeighted(base_small,1-i/9,loop[0],i/9,0) for i in range(10)],'talk-loop':loop,'talk-end':[cv2.addWeighted(loop[0],1-i/9,base_small,i/9,0) for i in range(10)]}
# Cough is a small hand-animated head/shoulder nod, not a generated clinical event.
h,w=base_small.shape[:2];yy,xx=np.mgrid[:h,:w].astype(np.float32);weight=np.exp(-((xx-w*.50)/(w*.23))**2-((yy-h*.28)/(h*.26))**2)
cough=[]
for i in range(40):
 t=i/39;envelope=math.sin(math.pi*t)**2;pulse=envelope*max(0,math.sin(t*math.pi*4))
 image=cv2.addWeighted(base_small,1-pulse*.55,frames[20],pulse*.55,0)
 cough.append(cv2.remap(image,xx+weight*pulse*1.8,yy-weight*pulse*7,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT))
clips['cough']=cough
for name,items in clips.items():
 target=OUTPUT/(name+'.mp4');process=subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-vcodec','rawvideo','-s','640x480','-pix_fmt','bgr24','-r','25','-i','-','-an','-c:v','libx264','-preset','slow','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 for item in items:process.stdin.write(item.tobytes())
 process.stdin.close();stderr=process.stderr.read();assert process.wait()==0,stderr.decode(errors='replace')
 print(name,len(items)/25,'sec',target.stat().st_size,'bytes',hashlib.sha256(target.read_bytes()).hexdigest(),flush=True)
print('Video generation complete',flush=True)

# 郭曼数字人 Demo 实现说明

2026-10-06。当前方式替代旧的静态帧GIF＋全浏览器语音。

## 当前播放

- 四段固定静音MP4：开始0.4秒、说话循环3秒、停止0.4秒、轻咳1.6秒；640×480、25fps、H.264/yuv420p，共221,865字节。待机显示原患者图片。
- MuseTalk1.5根据原郭曼形象离线生成连续嘴部运动；轻咳是简易头肩动画。允许固定循环、口型不逐字对应，不是每轮生成新视频。
- 固定31轮回答使用免费本地Qwen模型生成的音频；用户选择年龄感更强的B声线。参考由1.7B-VoiceDesign合成并保持先前认可的语速，0.6B-Base复用该合成参考生成完整回答。没有真人声音录音或克隆。
- `app/patient-audio-manifest.json`按原文映射MP3，记录轮次、时长、文件SHA256、模型及参考声SHA256；文本与原31轮逐项一致。教师声线试听也使用第一条录音。
- 实时/补问回答若与固定台词完全一致可复用录音；其他新回答继续由设备的浏览器中文女性语音朗读。其声线不保证与B一致，不依赖本机常开或新增语音API。
- `app/patient-playback.ts`统一音频、浏览器语音、重听与停止；`app/patient-media.tsx`根据实际playing/onstart和ended/onend组合视频。切模式、换页、录音提问和取消均停止旧播放；补问驱动可见患者。片段预加载、静音及playsInline，视频失败或减少动画时保留图片与文字。
- 版本14已删除“演示咳嗽”按钮。轻咳片段保留作素材，不随机插入，不根据提问中的“咳嗽”字样触发，不写入评分。
- 媒体总计约1.86MiB；网页直接播放静态资产，没有在线视频/GPU推理或付费视频/TTS调用。制作工具和模型仅位于忽略的`work/media/`目录，不进入站点发布包。

## 素材与复现

- 成品：`public/assets/patient-video/`及`public/assets/patient-audio/`。
- 用户选择的合成参考：`animation-source/patient-guoman-voice-reference.wav/.json`；原测试声音仅用作嘴部动作引导：`patient-guoman-motion-guide.wav`，不用于页面朗读。
- 制作脚本：先执行`node scripts/export-patient-script.cjs`，然后在隔离Python环境运行`python scripts/generate-patient-voice.py --all`；`python scripts/generate-patient-video.py`生成四段视频。脚本从本地模型目录读取，不调用云服务。
- 本次制作环境：Python3.12、RTX4060 Laptop 8GB、PyTorch2.10.0+cu128、qwen-tts0.1.1、transformers4.57.3、accelerate1.12.0、diffusers0.30.2、huggingface-hub0.36.2、imageio-ffmpeg0.6.0。使用SDPA，不需要FlashAttention；未改变原Python环境或网站npm依赖。
- 模型目录：`work/media/models/qwen-base`、`musetalk`、`sd-vae`、`whisper`。声线设计时另用`qwen-voice-design`；模型下载来源与校验元数据在同目录保留。
- 来源：[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)、[MuseTalk](https://github.com/TMElyralab/MuseTalk)、[SD-VAE](https://huggingface.co/stabilityai/sd-vae-ft-mse)、[Whisper tiny](https://huggingface.co/openai/whisper-tiny)。MuseTalk MIT许可见`animation-source/MuseTalk-LICENSE.txt`。生成的头像是虚构标准化患者，不是真人影像。

## 验证与边界

已完成31条文本/文件哈希/合成声来源核对、31个MP3与4个MP4解码、24kHz非静音波形、30秒循环解码，以及Chrome1440/538/375px真实MP3与视频播放、重听/停止、切页/模式、两个补问模式、减少动画、评分隔离。动态浏览器语音生命周期在自动化中用模拟事件验证；真人麦克风和其他设备声线仍需人工验收。用户确认的是B参考声线，不把自动文本核对等同于31条发音的医学专家核验。

旧GIF和生成脚本保留作历史素材，当前问诊不再引用GIF。

## 实时回答与密钥

服务端`/api/patient`仍使用已确认病例的患者可知事实，调用既有DeepSeek配置；本次没有变更医学事实、评分或提示词。密钥仅通过Sites运行时密文变量配置，不进入源码/模型脚本。原同源校验、长度限制与单实例限流保留；此前记录的持久化限额和供应商监控待办不变。

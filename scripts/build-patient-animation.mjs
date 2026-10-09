import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The only creative edits are the two identity-preserving ImageGen frames.
// This script crops those edits into the original portrait and encodes a loop.
const root = process.cwd();
const basePath = path.join(root, "public/assets/patient-guoman.png");
const mouthPath = path.join(root, "animation-source/patient-guoman-mouth.png");
const blinkPath = path.join(root, "animation-source/patient-guoman-blink.png");
const outputPath = path.join(root, "public/assets/patient-guoman-talking.gif");
const width = 724;
const height = 543;

async function featheredCrop(input, box, feather) {
  const { data, info } = await sharp(input)
    .extract(box)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cx = (box.width - 1) / 2;
  const cy = (box.height - 1) / 2;
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const edge = Math.min(x, y, box.width - 1 - x, box.height - 1 - y);
      const ellipse = 1 - ((x - cx) / cx) ** 2 - ((y - cy) / cy) ** 2;
      const blend = Math.max(0, Math.min(1, edge / feather, ellipse * 5));
      data[(y * box.width + x) * info.channels + 3] = Math.round(255 * blend);
    }
  }
  return sharp(data, { raw: { width: box.width, height: box.height, channels: 4 } }).png().toBuffer();
}

const mouthBox = { left: 660, top: 300, width: 136, height: 96 };
const blinkBox = { left: 620, top: 188, width: 224, height: 90 };
const [mouth, blink] = await Promise.all([
  featheredCrop(mouthPath, mouthBox, 13),
  featheredCrop(blinkPath, blinkBox, 15),
]);
const combinations = [[], [{ input: mouth, left: mouthBox.left, top: mouthBox.top }],
  [{ input: blink, left: blinkBox.left, top: blinkBox.top }],
  [{ input: mouth, left: mouthBox.left, top: mouthBox.top }, { input: blink, left: blinkBox.left, top: blinkBox.top }]];
const frames = await Promise.all(combinations.map(async (overlays) => {
  // sharp schedules resize before composite, so finish the full-size composite first.
  const composited = await sharp(basePath).composite(overlays).png().toBuffer();
  return sharp(composited).resize(width, height).ensureAlpha().raw().toBuffer();
}));
const sequence = [0, 1, 0, 1, 0, 1, 0, 3, 0, 1, 0, 1, 0, 1, 0];
const delays = [260, 160, 180, 180, 220, 160, 200, 120, 180, 180, 180, 180, 180, 160, 200];
await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.concat(sequence.map((index) => frames[index])), {
  raw: { width, height: height * sequence.length, channels: 4, pageHeight: height },
})
  .gif({ delay: delays, loop: 0, effort: 8, dither: 0.2, interFrameMaxError: 8 })
  .toFile(outputPath);
const metadata = await sharp(outputPath, { animated: true }).metadata();
console.log(JSON.stringify({ outputPath, frames: metadata.pages, width: metadata.width, height: metadata.pageHeight }));

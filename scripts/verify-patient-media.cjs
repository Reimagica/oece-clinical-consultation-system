/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['scripts/export-patient-script.cjs']);
const script = JSON.parse(fs.readFileSync('work/media/script.json', 'utf8'));
const audio = JSON.parse(fs.readFileSync('app/patient-audio-manifest.json', 'utf8'));
assert.equal(audio.length, 31);
const referenceHash = crypto.createHash('sha256').update(fs.readFileSync('animation-source/patient-guoman-voice-reference.wav')).digest('hex');
let bytes = 0;
for (const [index, item] of audio.entries()) {
  assert.equal(item.turn, index + 1);
  assert.equal(item.text, script[index].patient);
  assert.equal(item.src, `/assets/patient-audio/turn-${String(index + 1).padStart(2, '0')}.mp3`);
  assert.equal(item.model, 'Qwen3-TTS-12Hz-0.6B-Base');
  assert.equal(item.referenceSha256, referenceHash);
  const buffer = fs.readFileSync(path.join('public', item.src));
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'), item.sha256);
  assert.ok(item.duration > 0.25 && item.duration < 60);
  assert.ok(buffer.length > 3000);
  bytes += buffer.length;
}
const video = JSON.parse(fs.readFileSync('public/assets/patient-video/manifest.json', 'utf8'));
for (const [name, duration] of Object.entries({ 'talk-start': 0.4, 'talk-loop': 3, 'talk-end': 0.4, cough: 1.6 })) {
  const info = video[name];
  assert.equal(info.duration, duration); assert.equal(info.fps, 25); assert.equal(info.audioTracks, 0);
  const buffer = fs.readFileSync(`public/assets/patient-video/${name}.mp4`);
  assert.equal(buffer.toString('ascii', 4, 8), 'ftyp');
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'), info.sha256);
  bytes += buffer.length;
}
assert.ok(bytes < 10 * 1024 * 1024);
console.log(`PASS 31 original replies, one approved synthetic reference, file hashes, four video clips and ${(bytes / 1024 / 1024).toFixed(2)} MiB payload`);

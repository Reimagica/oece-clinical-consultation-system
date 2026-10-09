/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const audios = [], utterances = [], timers = new Map();
let timerId = 0, cancellations = 0;
const synth = { getVoices: () => [{ name: 'Huihui', lang: 'zh-CN' }], speak: utterance => utterances.push(utterance), cancel: () => { cancellations++; }, addEventListener() {}, removeEventListener() {} };
class Audio {
  constructor(src) { this.src = src; audios.push(this); }
  addEventListener() {} play() { return Promise.resolve(); } pause() { this.paused = true; } removeAttribute() {} load() {}
}
const manifest = [{ text: '固定回答', src: '/test.mp3' }];
const moduleObject = { exports: {} };
let snapshot;
const script = ts.transpileModule(fs.readFileSync('app/patient-playback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
vm.runInNewContext(script, { module: moduleObject, exports: moduleObject.exports, require: name => name === 'react' ? { useSyncExternalStore: (_subscribe, get) => { snapshot = get; return get(); } } : manifest, window: { speechSynthesis: synth, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) }, Audio, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, console, Set });
const api = moduleObject.exports; api.usePatientPlayback();
let ended = 0, started = 0;
api.speakPatientText('固定回答', () => ended++, () => started++);
assert.equal(snapshot().loading, true); assert.equal(snapshot().speaking, false);
audios[0].onplaying(); assert.equal(snapshot().speaking, true); assert.equal(started, 1);
audios[0].onended(); assert.equal(snapshot().kind, 'idle'); assert.equal(ended, 1); assert.equal(audios[0].paused, true);
api.speakPatientText('动态回答', () => ended++);
assert.equal(utterances.at(-1).text, '动态回答'); assert.equal(snapshot().speaking, false);
const staleStart = utterances.at(-1).onstart, staleEnd = utterances.at(-1).onend;
api.stopPatientPlayback(); staleStart(); staleEnd();
assert.equal(snapshot().speaking, false); assert.equal(ended, 2);
api.speakPatientText('固定回答', () => ended++); const failed = audios.at(-1); failed.onerror();
assert.equal(failed.paused, true); assert.equal(utterances.at(-1).text, '固定回答');
utterances.at(-1).onstart(); assert.equal(snapshot().speaking, true);
utterances.at(-1).onend(); assert.equal(snapshot().kind, 'idle');
assert.equal(ended, 3);
api.playPatientCough(); const coughId = snapshot().playbackId;
assert.equal(snapshot().kind, 'cough'); assert.equal(snapshot().speaking, false);
api.stopPatientPlayback(); api.speakPatientText('新回答');
api.finishPatientAction(coughId); assert.equal(snapshot().kind, 'speech');
api.stopPatientPlayback(); assert.equal(timers.size, 0); assert.ok(cancellations >= 3);
console.log('PASS actual playback start/end, fixed-file fallback, cancellation, stale speech/cough callbacks and timer cleanup');

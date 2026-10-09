/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS export helper. */
/**
 * Export the patient conversation script to work/media/script.json.
 *
 * Loading strategy mirrors scripts/verify-p01.cjs: app/*.ts sources are read
 * (never written), transpiled in memory with the TypeScript compiler and
 * evaluated in a fresh VM context with a recursive CommonJS require shim.
 * This keeps the export faithful to the runtime module graph without adding
 * a build step or any new dependency.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const APP_DIR = path.join(__dirname, '..', 'app');
const OUTPUT_DIR = path.join(__dirname, '..', 'work', 'media');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'script.json');

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(APP_DIR, `${name}.ts`);
  if (!fs.existsSync(file)) {
    throw new Error(`Cannot resolve "${name}" to a TypeScript module under ${APP_DIR}`);
  }
  const source = fs.readFileSync(file, 'utf8');
  const compiledModule = { exports: {} };
  cache.set(name, compiledModule.exports);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (specifier) => load(specifier.replace(/^\.\//, '')),
    Date,
    JSON,
    console,
  });
  return compiledModule.exports;
}

function assertScript(script) {
  if (!Array.isArray(script)) throw new Error('conversationScript is not an array');
  if (script.length !== 31) throw new Error(`expected 31 conversation turns, received ${script.length}`);
  script.forEach((turn, index) => {
    const where = `turn ${index + 1}`;
    if (!turn || typeof turn !== 'object') throw new Error(`${where} is not an object`);
    for (const field of ['student', 'patient']) {
      if (typeof turn[field] !== 'string' || turn[field].length === 0) {
        throw new Error(`${where} is missing a non-empty string "${field}"`);
      }
    }
    for (const field of ['askedAt', 'answeredAt']) {
      if (typeof turn[field] !== 'string' || !/^\d+$/.test(turn[field])) {
        throw new Error(`${where} is missing a numeric timestamp string "${field}"`);
      }
    }
    if (typeof turn.stage !== 'number' || typeof turn.turn !== 'number') {
      throw new Error(`${where} is missing numeric "stage" or "turn"`);
    }
  });
}

const { conversationScript } = load('demo-data');
assertScript(conversationScript);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(conversationScript, null, 2)}\n`, 'utf8');

// Re-read from disk to prove the written file round-trips without loss.
const written = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
assertScript(written);
if (JSON.stringify(written) !== JSON.stringify(conversationScript)) {
  throw new Error('written script.json does not match the in-memory conversationScript');
}
const bytes = fs.statSync(OUTPUT_FILE).size;
const stages = [...new Set(written.map((turn) => turn.stage))].sort((a, b) => a - b);

console.log(`Exported ${written.length} conversation turns to ${path.relative(path.join(__dirname, '..'), OUTPUT_FILE)}`);
console.log(`Fields per turn: ${Object.keys(written[0]).join(', ')}`);
console.log(`Stages present: ${stages.join(', ')}`);
console.log(`Timestamps: first answeredAt=${written[0].answeredAt}, last answeredAt=${written[written.length - 1].answeredAt}`);
console.log(`UTF-8 bytes: ${bytes}`);
console.log(`First patient line: ${written[0].patient}`);
console.log(`Last student line: ${written[written.length - 1].student}`);

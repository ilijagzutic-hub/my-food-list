// Test helper: loads src/lib/pick.ts (+ geo.ts, rating.ts) from source, with no build step and no extra deps.
const fs = require('fs'); const path = require('path'); const ts = require('typescript');
const lib = path.join(__dirname, '..', 'src', 'lib');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name].exports;
  const src = fs.readFileSync(path.join(lib, name + '.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} }; cache[name] = mod;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (p) => (p.startsWith('./') ? load(p.slice(2)) : require(p)));
  return mod.exports;
}
module.exports = { pick: () => load('pick'), geo: () => load('geo') };

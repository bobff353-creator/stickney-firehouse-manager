import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function trainingModules(overrides = {}) {
  const cache = new Map();
  const root = resolve(import.meta.dirname, '../..');
  function load(path) {
    path = resolve(root, path);
    if (Object.hasOwn(overrides, path)) return overrides[path];
    if (cache.has(path)) return cache.get(path).exports;
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const target = { exports: {} }; cache.set(path, target);
    new Function('require', 'module', 'exports', code)(name => name === 'server-only' ? {} : name.startsWith('.') ? load(resolve(dirname(path), name + '.ts')) : require(name), target, target.exports);
    return target.exports;
  }
  return load;
}

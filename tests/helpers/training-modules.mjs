import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function trainingModules(overrides = {}) {
  const cache = new Map();
  const root = resolve(import.meta.dirname, '../..');
  function load(path) {
    path = resolve(root, path);
    if (Object.hasOwn(overrides, path)) return overrides[path];
    if (extname(path)==='.json') return JSON.parse(readFileSync(path,'utf8'));
    if (cache.has(path)) return cache.get(path).exports;
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
    const target = { exports: {} }; cache.set(path, target);
    new Function('require', 'module', 'exports', code)(name => name === 'server-only' ? {} : name.startsWith('.') ? load(resolve(dirname(path), extname(name)?name:name + '.ts')) : require(name), target, target.exports);
    return target.exports;
  }
  return load;
}

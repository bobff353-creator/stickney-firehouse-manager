// Node's TS erasure does not add extensions to Next-style imports.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const url = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]sx?$/.test(url.pathname) && existsSync(new URL(url.href + '.ts'))) return next(url.href + '.ts', context);
  }
  return next(specifier, context);
} });

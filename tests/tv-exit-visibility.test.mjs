import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTvExitVisibility } from '../app/tv-exit-visibility.ts';
function harness() {
  let value; let next = 0;
  const timers = new Map();
  const control = createTvExitVisibility(v => {value=v;}, (fn,delay) => {assert.equal(delay,3000);timers.set(++next,fn);return next;}, id=>timers.delete(id));
  return {control,timers,visible:()=>value,expire:()=>{const fn=[...timers.values()][0];timers.clear();fn?.();}};
}
test('starts hidden, reveals on activity, then hides after three seconds',()=>{
  const h=harness(); assert.equal(h.visible(),false);h.control.reveal();assert.equal(h.visible(),true);h.expire();assert.equal(h.visible(),false);
});
test('continued activity resets the timer without accumulating timers',()=>{
  const h=harness();h.control.reveal();const first=[...h.timers.keys()][0];h.control.reveal();assert.equal(h.timers.size,1);assert.equal(h.timers.has(first),false);h.expire();assert.equal(h.visible(),false);
});
test('leaving TV mode cancels pending work and prevents later updates',()=>{
  const h=harness();h.control.reveal();h.control.dispose();assert.equal(h.timers.size,0);h.control.reveal();assert.equal(h.timers.size,0);
});
test('TV exit handles mouse, touch and keyboard with matching cleanup and visible focus',async()=>{
  const source=await readFile(new URL('../app/operations-board.tsx',import.meta.url),'utf8');
  for(const event of ['pointermove','pointerdown','keydown']) {
    assert.ok(source.includes(`addEventListener("${event}", reveal`));assert.ok(source.includes(`removeEventListener("${event}", reveal`));
  }
  const css=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.board-exit-tv\.is-visible,\.tv-display \.board-exit-tv:focus-visible \{ opacity: 1; pointer-events: auto/);
  assert.match(css,/\.board-exit-tv:not\(\.is-visible\):not\(:focus-visible\) \{ opacity: 0; pointer-events: none/);
});

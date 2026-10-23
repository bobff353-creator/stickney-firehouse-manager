import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const source = readFileSync(new URL("../app/station-scheduler.tsx", import.meta.url), "utf8");
const code = compile(`${source}\nexport { CalendarScreen };`);
const keyboardCode = compile(readFileSync(new URL("../app/dialog-keyboard.ts", import.meta.url), "utf8"));

function fixture({ inline = false } = {}) {
  const hooks = [], pending = [], frames = new Map(), focusLog = [];
  let cursor = 0, tree, nextFrame = 0, canLeave = true, guardCalls = 0;
  const document = { body: { style: { overflow: "auto" } }, activeElement: null };
  const control = name => ({ isConnected: true, getClientRects: () => [{}], focus() { document.activeElement = this; focusLog.push(name); } });
  const opener = control("opener"), replacement = control("replacement"), close = control("close"), dateInput = control("date");
  const dialog = { open: false, shows: 0, closes: 0,
    showModal() { this.open = true; this.shows++; }, close() { this.open = false; this.closes++; },
    focus() { document.activeElement = this; }, querySelectorAll: () => [dateInput, close],
    getBoundingClientRect: () => ({ left: 20, right: 980, top: 20, bottom: 720 }),
  };
  const window = { requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  const react = {
    useState(initial) { const i = cursor++; hooks[i] ??= { value: typeof initial === "function" ? initial() : initial }; return [hooks[i].value, next => { hooks[i].value = typeof next === "function" ? next(hooks[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; hooks[i] ??= { value: { current: initial } }; return hooks[i].value; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) { const i = cursor++, old = hooks[i]; if (!old || deps.some((dep, index) => !Object.is(dep, old.deps[index]))) { hooks[i] = { deps, cleanup: old?.cleanup }; pending.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = fn(); }); } },
  };
  const keyboard = { exports: {} };
  new Function("module", "exports", "document", keyboardCode)(keyboard, keyboard.exports, document);
  const target = { exports: {} };
  const mods = {
    react, "react/jsx-runtime": require("react/jsx-runtime"),
    "./workspace-view-state": { useWorkspaceViewState: (_key, value) => react.useState(value) },
    "./use-unsaved-work": { confirmLeavingWork: () => { guardCalls++; return canLeave; } },
    "./dialog-keyboard": keyboard.exports,
    "./schedule-time": { scheduleTimeBlocks: [] },
    "./scheduler-calendar-view": { calendarDayShifts: () => [] },
  };
  new Function("require", "module", "exports", "window", "document", code)(name => mods[name] ?? {}, target, target.exports, window, document);
  const props = {
    data: { today: "2026-10-23", viewer: { employeeId: "fixture-member" }, shiftTypes: [], entries: [], slots: [], availability: [], employees: [], claims: [], awardBySlot: {}, roles: [] },
    isAdmin: true, adminDayMode: inline, selectedDate: "2026-10-23", busy: false,
    setAdminDayMode(value) { props.adminDayMode = value; }, setSelectedDate(value) { props.selectedDate = value; }, act: async () => null,
    employeeName: () => "Fixture member", shiftTypeName: () => "Fixture shift", onTrade() {},
  };
  const walk = (node, result = []) => { if (Array.isArray(node)) node.forEach(child => walk(child, result)); else if (node && typeof node === "object") { result.push(node); walk(node.props?.children, result); } return result; };
  const nodes = () => walk(tree);
  const render = () => {
    cursor = 0; tree = target.exports.CalendarScreen(props);
    for (const node of nodes()) if (node.props?.ref) node.props.ref.current = node.type === "dialog" ? dialog : node.props["aria-label"] === "Close day view" ? close : { isConnected: true, querySelector: () => replacement };
    return tree;
  };
  const flush = () => { for (const fn of pending.splice(0)) fn(); };
  const modal = () => nodes().find(node => node.type === "dialog");
  const open = () => { nodes().find(node => node.props?.["data-calendar-date"] === props.selectedDate).props.onClick({ currentTarget: opener }); render(); flush(); };
  render(); flush();
  return { props, render, flush, nodes, modal, open, dialog, document, opener, focusLog, close, dateInput,
    guardCalls: () => guardCalls, canLeave(value) { canLeave = value; },
    flushFrames() { const queued = [...frames.values()]; frames.clear(); queued.forEach(fn => fn()); },
  };
}

test("month day view opens a native dialog with safe initial focus and restores focus after refresh", () => {
  const f = fixture(); f.open();
  assert.equal(f.dialog.open, true); assert.equal(f.dialog.shows, 1);
  assert.equal(f.document.body.style.overflow, "hidden"); assert.equal(f.document.activeElement, f.close);
  f.props.data = structuredClone(f.props.data); f.render(); f.flush();
  assert.equal(f.dialog.shows, 1, "a data refresh must not reopen or steal focus");
  f.modal().props.onCancel({ preventDefault() {} }); f.render(); f.flush(); f.flushFrames();
  assert.equal(f.modal(), undefined); assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.document.activeElement, f.opener);
});

test("busy save blocks Escape, Close, backdrop and date dismissal without reopening the dialog", () => {
  const f = fixture(); f.open(); f.props.busy = true; f.render(); f.flush();
  let prevented = false;
  f.modal().props.onCancel({ preventDefault() { prevented = true; } });
  f.nodes().find(node => node.props?.["aria-label"] === "Close day view").props.onClick();
  f.modal().props.onMouseDown({ target: f.dialog, currentTarget: f.dialog, clientX: 0, clientY: 0 });
  f.nodes().find(node => node.props?.["aria-label"] === "Choose another date").props.onChange({ target: { value: "2026-11-01" } });
  f.render(); f.flush();
  assert.equal(prevented, true); assert.ok(f.modal()); assert.equal(f.dialog.shows, 1);
  assert.equal(f.props.selectedDate, "2026-10-23"); assert.equal(f.guardCalls(), 0);
  assert.equal(f.nodes().find(node => node.props?.["aria-label"] === "Close day view").props.disabled, true);
  f.props.busy = false; f.render(); f.modal().props.onCancel({ preventDefault() {} }); f.render(); f.flush();
  assert.equal(f.modal(), undefined);
});

test("unsaved-work cancellation keeps the dialog and current date open", () => {
  const f = fixture(); f.open(); f.canLeave(false);
  f.modal().props.onCancel({ preventDefault() {} });
  f.nodes().find(node => node.props?.["aria-label"] === "Choose another date").props.onChange({ target: { value: "2026-11-01" } });
  f.render(); f.flush(); assert.ok(f.modal()); assert.equal(f.props.selectedDate, "2026-10-23"); assert.equal(f.guardCalls(), 2);
});

test("Tab wraps in both directions through the shared dialog keyboard helper", () => {
  const f = fixture(); f.open(); let prevented = 0;
  const event = shiftKey => ({ key: "Tab", shiftKey, currentTarget: f.dialog, preventDefault() { prevented++; } });
  f.document.activeElement = f.close; f.modal().props.onKeyDown(event(false)); assert.equal(f.document.activeElement, f.dateInput);
  f.modal().props.onKeyDown(event(true)); assert.equal(f.document.activeElement, f.close); assert.equal(prevented, 2);
});

test("return focus uses the current day button if async updates removed the original opener", () => {
  const f = fixture(); f.open(); f.opener.isConnected = false;
  f.modal().props.onCancel({ preventDefault() {} }); f.render(); f.flush(); f.flushFrames();
  assert.equal(f.focusLog.at(-1), "replacement");
});

test("administrator inline day staffing remains a region without modal lifecycle or Tab interception", () => {
  const f = fixture({ inline: true });
  const region = f.nodes().find(node => node.props?.role === "region");
  assert.equal(region.type, "section"); assert.equal(region.props["aria-modal"], undefined);
  assert.equal(region.props.onCancel, undefined); assert.equal(region.props.onKeyDown, undefined);
  assert.equal(f.dialog.shows, 0); assert.equal(f.document.body.style.overflow, "auto");
  assert.equal(f.nodes().some(node => node.props?.["aria-label"] === "Close day view"), false);
});

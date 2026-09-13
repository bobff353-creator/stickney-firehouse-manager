"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// View choices only, never records, drafts, credentials, or permissions. The
// authenticated shell owns this bounded memory and drops it on identity change.
const ViewMemory = createContext<Map<string, unknown> | null>(null);
export function WorkspaceViewMemory({ children }: { children: ReactNode }) {
  const [memory] = useState(() => new Map<string, unknown>());
  return <ViewMemory.Provider value={memory}>{children}</ViewMemory.Provider>;
}
export function useWorkspaceViewState<T>(key: string, initial: T | (() => T)) {
  const memory = useContext(ViewMemory);
  const [value, setValue] = useState<T>(() => memory?.has(key) ? memory.get(key) as T : typeof initial === "function" ? (initial as () => T)() : initial);
  useEffect(() => {
    if (!memory) return;
    if (!memory.has(key) && memory.size >= 64) memory.delete(memory.keys().next().value!);
    memory.set(key, value);
  }, [memory, key, value]);
  return [value, setValue] as const;
}

/** Wait briefly for an asynchronously loaded workspace, then restore position. */
export function restoreWorkspaceScroll(top: number) {
  let frame = 0, attempts = 0;
  const stop = () => { cancelAnimationFrame(frame); window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); window.removeEventListener("keydown", stop); };
  const restore = () => {
    if (document.documentElement.scrollHeight - window.innerHeight >= top || attempts++ >= 90) {
      window.scrollTo({ top, behavior: "instant" }); stop();
    } else frame = requestAnimationFrame(restore);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  frame = requestAnimationFrame(restore);
  return stop;
}

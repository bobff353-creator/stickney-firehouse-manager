"use client";
import { useEffect } from "react";

export function confirmLeavingWork() {
  return window.dispatchEvent(new Event("firehouse:before-navigate", { cancelable: true }));
}

/** Protect local edits; never save or submit operational records automatically. */
export function useUnsavedWork(dirty: boolean, saving = false) {
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event: Event) => {
      if (saving) { event.preventDefault(); window.alert("Please wait for the current save to finish before leaving this screen."); }
      else if (!window.confirm("You have unsaved changes. Leave this screen and discard those changes? Choose Cancel to stay and save your work.")) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("firehouse:before-navigate", beforeNavigate);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("firehouse:before-navigate", beforeNavigate); };
  }, [dirty, saving]);
}

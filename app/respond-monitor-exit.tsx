"use client";

import { useEffect, useState } from "react";
import { createTvExitVisibility } from "./tv-exit-visibility";
import "./respond-monitor.css";

export default function RespondMonitorExit({ onExit }: { onExit: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const visibility = createTvExitVisibility(setVisible, (callback, delay) => window.setTimeout(callback, delay), (id) => window.clearTimeout(id));
    const reveal = () => visibility.reveal();
    window.addEventListener("pointermove", reveal, { passive: true });
    window.addEventListener("pointerdown", reveal, { passive: true });
    window.addEventListener("keydown", reveal);
    return () => {
      visibility.dispose();
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("pointerdown", reveal);
      window.removeEventListener("keydown", reveal);
    };
  }, []);
  return <button type="button" className={`respond-monitor-exit${visible ? " is-visible" : ""}`} onClick={onExit} aria-label="Exit full-screen Respond">
    <span aria-hidden="true">×</span> Exit full screen
  </button>;
}

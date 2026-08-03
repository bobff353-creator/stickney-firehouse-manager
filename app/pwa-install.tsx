"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function PwaInstall() {
  const [install, setInstall] = useState<InstallEvent | null>(null), [installed, setInstalled] = useState(false);
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js"); const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); }; const done = () => { setInstalled(true); setInstall(null); }; window.addEventListener("beforeinstallprompt", capture); window.addEventListener("appinstalled", done); return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); }; }, []);
  if (!install || installed) return null;
  return <button className="install-app-button" onClick={async () => { await install.prompt(); const choice = await install.userChoice; if (choice.outcome === "accepted") setInstall(null); }} aria-label="Install Operations Portal on this device"><span>↓</span><strong>Install app</strong></button>;
}

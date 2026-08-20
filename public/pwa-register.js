(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The portal remains fully usable in the browser if registration is unavailable.
    });
  });

  let installPrompt = null;
  let installButton = null;

  const removeInstallButton = () => {
    installButton?.remove();
    installButton = null;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton || window.matchMedia("(display-mode: standalone)").matches) return;

    installButton = document.createElement("button");
    installButton.type = "button";
    installButton.textContent = "Install Stickney FD App";
    installButton.setAttribute("aria-label", "Install Stickney Firehouse Manager on this device");
    Object.assign(installButton.style, {
      position: "fixed",
      right: "max(16px, env(safe-area-inset-right))",
      bottom: "max(16px, env(safe-area-inset-bottom))",
      zIndex: "2147483640",
      minHeight: "44px",
      padding: "0 16px",
      border: "1px solid #f3c64f",
      borderRadius: "8px",
      background: "#0b2b40",
      color: "#ffffff",
      boxShadow: "0 6px 22px rgba(0,0,0,.28)",
      font: "700 14px/1 system-ui, sans-serif",
      cursor: "pointer"
    });
    document.body.appendChild(installButton);

    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      removeInstallButton();
    });
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    removeInstallButton();
  });
})();

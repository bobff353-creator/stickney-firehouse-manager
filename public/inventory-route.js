(() => {
  const inventoryLabels = new Set(["Inventory", "Open Inventory"]);

  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("button,a")
          : null;
      if (!target) return;

      const label = (target.textContent || "").replace(/\s+/g, " ").trim();
      if (!inventoryLabels.has(label)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign("/inventory");
    },
    true,
  );
})();

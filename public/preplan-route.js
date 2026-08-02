(function () {
  const pageSelector = ".field-preplans-page";
  const editorSelector = ".preplan-editor";
  const focusClass = "preplan-builder-focused";
  const backClass = "preplan-builder-back";
  const stepSelectorClass = "preplan-step-selector";
  const stepButtonClass = "preplan-step-button";
  const locationControlClass = "preplan-map-location-control";
  const targetMapZoom = 17;
  const steps = [
    { number: "1", label: "Footprint" },
    { number: "2", label: "Building Info" },
    { number: "3", label: "Systems" },
  ];

  function leaveFocusedEditor() {
    const page = document.querySelector(pageSelector);
    page?.classList.remove(focusClass);
    page?.removeAttribute("data-preplan-active-step");
    page?.removeAttribute("data-current-location-requested");
    page?.querySelector(`.${backClass}`)?.remove();
    page?.scrollIntoView({ block: "start" });
  }

  function findButton(page, label) {
    return Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === label,
    );
  }

  function currentMapZoom(page) {
    const text = page.querySelector(".field-map-toolbar")?.textContent || "";
    const match = text.match(/Zoom\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function widenMap(page, attempts = 0) {
    const zoom = currentMapZoom(page);
    if (zoom !== null && zoom > targetMapZoom && attempts < 8) {
      findButton(page, "\u2212")?.click();
      window.setTimeout(() => widenMap(page, attempts + 1), 180);
    }
  }

  function setLocationStatus(page, message) {
    const status = page.querySelector(`.${locationControlClass} span`);
    if (status) status.textContent = message;
  }

  function centerOnCurrentLocation(page, force = false) {
    if (!force && page.getAttribute("data-current-location-requested") === "true") return;
    page.setAttribute("data-current-location-requested", "true");
    setLocationStatus(page, "Locating\u2026");

    if (!navigator.geolocation) {
      setLocationStatus(page, "Location unavailable \u00b7 wider view");
      widenMap(page);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        findButton(page, "\u25ce Current location")?.click();
        setLocationStatus(page, "Current location \u00b7 Google map");
        window.setTimeout(() => widenMap(page), 500);
      },
      () => {
        setLocationStatus(page, "Use current location \u00b7 wider view");
        widenMap(page);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function ensureLocationControl(page, map) {
    let control = map.querySelector(`.${locationControlClass}`);
    if (control) return;
    control = document.createElement("div");
    control.className = locationControlClass;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "\u25ce Current location";
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      centerOnCurrentLocation(page, true);
    });
    const status = document.createElement("span");
    status.textContent = "Google map \u00b7 wider view";
    control.append(button, status);
    map.append(control);
  }

  function ensureCaptureMap(page) {
    const map = page.querySelector(".field-map.capture");
    if (!map) return;
    ensureLocationControl(page, map);
    centerOnCurrentLocation(page);
    window.setTimeout(() => widenMap(page), 250);
  }

  function selectStep(page, selector, stepNumber) {
    page.setAttribute("data-preplan-active-step", stepNumber);
    selector.querySelectorAll(`.${stepButtonClass}`).forEach((button) => {
      const selected = button.getAttribute("data-step") === stepNumber;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function ensureStepSelector(page, editor) {
    const quickGrid = editor.querySelector(".preplan-quick-grid");
    let selector = editor.querySelector(`.${stepSelectorClass}`);

    if (!quickGrid) {
      if (selector) selector.hidden = true;
      return;
    }

    if (!selector) {
      selector = document.createElement("nav");
      selector.className = stepSelectorClass;
      selector.setAttribute("aria-label", "Quick Preplan sections");

      steps.forEach((step) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = stepButtonClass;
        button.setAttribute("data-step", step.number);
        button.setAttribute("role", "tab");

        const number = document.createElement("strong");
        number.textContent = step.number;
        const label = document.createElement("span");
        label.textContent = step.label;
        button.append(number, label);
        button.addEventListener("click", () => {
          selectStep(page, selector, step.number);
          quickGrid.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        selector.append(button);
      });
    }

    selector.hidden = false;
    if (selector.nextElementSibling !== quickGrid) {
      quickGrid.before(selector);
    }
    selectStep(page, selector, page.getAttribute("data-preplan-active-step") || "1");
  }

  function observeEditor(page, editor) {
    if (editor.getAttribute("data-layout-observed") === "true") return;
    editor.setAttribute("data-layout-observed", "true");
    const observer = new MutationObserver(() => ensureStepSelector(page, editor));
    observer.observe(editor, { childList: true, subtree: true });
  }

  function focusSelectedEditor() {
    const page = document.querySelector(pageSelector);
    const editor = page?.querySelector(editorSelector);
    if (!page || !editor) return false;

    page.classList.add(focusClass);
    if (!editor.querySelector(`.${backClass}`)) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = backClass;
      back.textContent = "\u2190 Back to Preplan list";
      back.setAttribute("aria-label", "Back to Preplan list");
      back.addEventListener("click", leaveFocusedEditor);
      editor.prepend(back);
    }
    ensureStepSelector(page, editor);
    observeEditor(page, editor);
    ensureCaptureMap(page);
    editor.scrollIntoView({ block: "start" });
    return true;
  }

  function isLocateAndBuild(target) {
    const button = target instanceof Element ? target.closest("button") : null;
    return button?.textContent?.trim() === "Locate & Build";
  }

  document.addEventListener("click", (event) => {
    if (!isLocateAndBuild(event.target)) return;

    // The upstream React handler creates or updates the editor after this click.
    // Check across the next few frames so the selected building opens in place.
    requestAnimationFrame(() => {
      if (focusSelectedEditor()) return;
      window.setTimeout(focusSelectedEditor, 100);
      window.setTimeout(focusSelectedEditor, 400);
    });
  });

  window.addEventListener("popstate", leaveFocusedEditor);
})();

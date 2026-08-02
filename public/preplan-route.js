(function () {
  const pageSelector = ".field-preplans-page";
  const editorSelector = ".preplan-editor";
  const focusClass = "preplan-builder-focused";
  const backClass = "preplan-builder-back";
  const stepSelectorClass = "preplan-step-selector";
  const stepButtonClass = "preplan-step-button";
  const steps = [
    { number: "1", label: "Footprint" },
    { number: "2", label: "Building Info" },
    { number: "3", label: "Systems" },
  ];

  function leaveFocusedEditor() {
    const page = document.querySelector(pageSelector);
    page?.classList.remove(focusClass);
    page?.removeAttribute("data-preplan-active-step");
    page?.querySelector(`.${backClass}`)?.remove();
    page?.scrollIntoView({ block: "start" });
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

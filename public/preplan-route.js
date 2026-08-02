(function () {
  const pageSelector = ".field-preplans-page";
  const editorSelector = ".preplan-editor";
  const focusClass = "preplan-builder-focused";
  const backClass = "preplan-builder-back";

  function leaveFocusedEditor() {
    const page = document.querySelector(pageSelector);
    page?.classList.remove(focusClass);
    page?.querySelector(`.${backClass}`)?.remove();
    page?.scrollIntoView({ block: "start" });
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

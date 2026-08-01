(() => {
  const panelId = "fleet-assigned-notices";
  let loading = false;
  let lastLoaded = 0;

  function words(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function ensureStyles() {
    if (document.getElementById(`${panelId}-styles`)) return;
    const style = document.createElement("style");
    style.id = `${panelId}-styles`;
    style.textContent = `
      #${panelId}{margin:0 0 18px;padding:18px;border:1px solid #f0b15a;border-left:5px solid #c73b2f;border-radius:14px;background:#fff8ed;color:#311b13;box-shadow:0 8px 24px rgba(80,35,12,.08)}
      #${panelId} header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      #${panelId} header span{font-size:12px;font-weight:800;letter-spacing:.08em;color:#9c2f25}
      #${panelId} header a{color:#8b2d23;font-weight:800;text-decoration:none}
      #${panelId} h2{margin:3px 0 0;font-size:20px}
      #${panelId} .fleet-notice-list{display:grid;gap:10px}
      #${panelId} article{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:12px;border:1px solid #efcfaa;border-radius:10px;background:#fff}
      #${panelId} article strong{font-size:15px}
      #${panelId} article b{align-self:start;padding:3px 8px;border-radius:999px;background:#f9d8d3;color:#8e231b;font-size:11px;text-transform:uppercase}
      #${panelId} article p{grid-column:1/-1;margin:0;color:#553a2f;line-height:1.4}
      #${panelId} article small{grid-column:1/-1;color:#73584d}
      #${panelId} article a{grid-column:1/-1;color:#8b2d23;font-weight:700}
      @media(max-width:700px){#${panelId}{margin:0 12px 16px}#${panelId} header{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function render(notices) {
    const dashboard = document.querySelector(".role-dashboard");
    if (!dashboard) return;
    let panel = document.getElementById(panelId);
    if (!notices.length) {
      panel?.remove();
      return;
    }
    ensureStyles();
    if (!panel) {
      panel = document.createElement("section");
      panel.id = panelId;
      panel.setAttribute("aria-live", "polite");
      const welcome = dashboard.querySelector(".dashboard-welcome");
      welcome?.insertAdjacentElement("afterend", panel);
      if (!welcome) dashboard.prepend(panel);
    }
    panel.replaceChildren();
    const header = document.createElement("header");
    const title = document.createElement("div");
    title.innerHTML = `<span>ASSIGNED FLEET NOTICE</span><h2>${notices.length} repair ${notices.length === 1 ? "item" : "items"} assigned to you</h2>`;
    const link = document.createElement("a");
    link.href = "/inventory";
    link.textContent = "Open Repairs →";
    header.append(title, link);
    const list = document.createElement("div");
    list.className = "fleet-notice-list";
    notices.forEach((notice) => {
      const article = document.createElement("article");
      const item = document.createElement("strong");
      item.textContent = `${notice.apparatusName}${notice.equipmentName ? ` · ${notice.equipmentName}` : ""}`;
      const status = document.createElement("b");
      status.textContent = words(notice.result || "Open");
      const details = document.createElement("p");
      details.textContent = notice.notes || "Repair action required.";
      const meta = document.createElement("small");
      meta.textContent = `${(notice.issue_categories || []).map(words).join(" / ")} · ${words(notice.priority)} priority`;
      article.append(item, status, details, meta);
      if (notice.photoUrl) {
        const photo = document.createElement("a");
        photo.href = notice.photoUrl;
        photo.target = "_blank";
        photo.rel = "noreferrer";
        photo.textContent = "View attached deficiency photo";
        article.append(photo);
      }
      list.append(article);
    });
    panel.append(header, list);
  }

  async function refresh() {
    if (loading || !document.querySelector(".role-dashboard")) return;
    if (Date.now() - lastLoaded < 15000) return;
    loading = true;
    lastLoaded = Date.now();
    try {
      const response = await fetch("/api/fleet-notices", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      render(Array.isArray(payload.notices) ? payload.notices : []);
    } finally {
      loading = false;
    }
  }

  const observer = new MutationObserver(() => void refresh());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(() => void refresh(), 30000);
  void refresh();
})();

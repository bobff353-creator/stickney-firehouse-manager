(() => {
  const providerIds = {
    "Romeoville Fire Academy": "romeoville",
    "Illinois Fire Service Institute": "ifsi",
    "NIPSTA Fire & Technical Rescue": "nipsta",
  };

  let payload = null;
  let scheduled = false;

  function formatChecked(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "today";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatCourseDates(course) {
    const start = new Date(`${course.startDate}T12:00:00`);
    const end = new Date(`${course.endDate || course.startDate}T12:00:00`);
    if (Number.isNaN(start.getTime())) return "UPCOMING";
    const startLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(start);
    if (Number.isNaN(end.getTime()) || course.endDate === course.startDate) {
      return startLabel;
    }
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: start.getMonth() === end.getMonth() ? undefined : "short",
      day: "numeric",
    }).format(end);
    return `${startLabel}–${endLabel}`;
  }

  function resourceLink(resource, isCourse = false) {
    const link = document.createElement("a");
    link.href = resource.url;
    link.target = "_blank";
    link.rel = "noreferrer";

    const time = document.createElement("time");
    time.textContent = isCourse ? formatCourseDates(resource) : "CURRENT";
    const detail = document.createElement("small");
    detail.textContent = "DAILY";
    time.append(detail);

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = resource.title;
    const description = document.createElement("span");
    description.textContent = resource.detail || resource.location || "Official provider schedule";
    content.append(title, description);

    const arrow = document.createElement("b");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(time, content, arrow);
    return link;
  }

  function applyTrainingData() {
    scheduled = false;
    if (!payload?.providers) return;

    for (const heading of document.querySelectorAll("h2")) {
      const id = providerIds[(heading.textContent || "").trim()];
      if (!id) continue;
      const provider = payload.providers.find((item) => item.id === id);
      const panel = heading.parentElement?.querySelector(".training-board");
      if (!provider || !panel) continue;
      if (panel.dataset.dailyFeedVersion === provider.checkedAt) continue;

      const checked = panel.querySelector(".training-provider small");
      if (checked) {
        checked.textContent = `Official site checked ${formatChecked(provider.checkedAt)}`;
      }

      const list = panel.querySelector(".training-course-list");
      if (list) {
        list.replaceChildren();
        if (provider.available && provider.upcoming?.length) {
          for (const course of provider.upcoming.slice(0, 6)) {
            list.append(resourceLink(course, true));
          }
        } else if (provider.available) {
          const empty = document.createElement("p");
          empty.className = "board-empty";
          empty.textContent =
            "No future classes were listed on today's official schedule. Use the source link below.";
          list.append(empty);
        } else {
          const unavailable = document.createElement("p");
          unavailable.className = "board-empty";
          unavailable.textContent =
            "The official provider site is temporarily unavailable. Use the source link below.";
          list.append(unavailable);
        }
      }

      const source = panel.querySelector(".training-source");
      if (source && provider.sourceUrl) source.href = provider.sourceUrl;

      panel.dataset.dailyFeedVersion = provider.checkedAt;
    }
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(applyTrainingData, 0);
  }

  fetch("/api/training-sites", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Training sites unavailable");
      return response.json();
    })
    .then((data) => {
      payload = data;
      applyTrainingData();
      new MutationObserver(scheduleApply).observe(document.body, {
        childList: true,
        subtree: true,
      });
    })
    .catch(() => {
      // The existing source links remain visible if the refresh is unavailable.
    });
})();

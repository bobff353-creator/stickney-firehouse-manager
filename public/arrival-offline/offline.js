"use strict";
let savedPackets = [];
const element = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const date = (value) => {
  if (!value) return "Not recorded";
  return (
    new Date(value.length === 10 ? value + "T12:00:00Z" : value).toLocaleString(
      "en-US",
      {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(value.length > 10 ? { hour: "numeric", minute: "2-digit" } : {}),
      },
    ) + (value.length > 10 ? " CT" : "")
  );
};
function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("stickney-arrival-device-v1", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("packets", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function showList() {
  document.getElementById("library").hidden = false;
  document.getElementById("detail").hidden = true;
  const list = document.getElementById("packets");
  list.replaceChildren();
  const term = document.getElementById("search").value.toLowerCase();
  const matches = savedPackets.filter((x) =>
    (x.record.name + " " + x.record.address).toLowerCase().includes(term),
  );
  for (const packet of matches) {
    const b = element("button", undefined, "packet");
    const d = element("div");
    d.append(
      element("b", packet.record.name),
      element(
        "small",
        packet.record.published.address + ", " + packet.record.published.city,
      ),
      element(
        "small",
        "Revision " +
          packet.record.publishedRevision +
          " · downloaded " +
          date(packet.savedAt),
      ),
    );
    b.append(d, element("span", "Read →"));
    b.addEventListener("click", () => {
      location.hash = packet.id;
      showPacket(packet);
    });
    list.append(b);
  }
  document.getElementById("message").textContent = matches.length
    ? ""
    : savedPackets.length
      ? "No saved buildings match your search."
      : "No published packets have been downloaded on this browser. Open Arrival online, choose a published preplan, and select Save published plan offline.";
}
function panel(title) {
  const n = element("section", undefined, "panel");
  n.append(element("h2", title));
  return n;
}
function row(parent, label, value) {
  const r = element("div", undefined, "row");
  r.append(
    element("span", label),
    element("strong", value || "Unknown — not recorded"),
  );
  parent.append(r);
}
function showPacket(packet) {
  document.getElementById("library").hidden = true;
  const detail = document.getElementById("detail");
  detail.hidden = false;
  detail.replaceChildren();
  const r = packet.record;
  const p = r.published;
  if (!p) {
    detail.append(
      element(
        "p",
        "This packet does not contain a published version.",
        "error",
      ),
    );
    return;
  }
  const tools = element("div", undefined, "tools");
  const back = element("button", "← Library");
  back.onclick = () => {
    history.replaceState(null, "", location.pathname);
    showList();
  };
  const print = element("button", "Print saved packet");
  print.onclick = () => window.print();
  tools.append(back, print);
  detail.append(
    tools,
    element("h1", p.name),
    element("p", p.address + ", " + p.city + " " + p.region),
    element(
      "p",
      "PUBLISHED REVISION " +
        r.publishedRevision +
        " · Published " +
        date(r.publishedAt) +
        " · Downloaded " +
        date(packet.savedAt),
      "dates",
    ),
    element(
      "p",
      "Visited " + date(p.visited) + " · Next review " + date(p.reviewDue),
      "dates",
    ),
  );
  detail.append(element("p", "Saved approved snapshot only. Separate field observations and crew alerts are online-only and are not included in this packet.", "banner"));
  for (const [key, system] of Object.entries({...p.systems, standpipe:p.details?.standpipe, firePump:p.details?.firePump})) {
    if (system?.answer === "Yes" && ["Impaired","Out of service"].includes(system.status)) detail.append(element("p", key + " — " + system.status + " · " + (system.location || "Location unknown"), "banner"));
  }
  if(p.imported) detail.append(element("p","Imported source snapshot. Original source archives and linked hydrants require an online connection. Importing did not verify current conditions.","banner"));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (p.reviewDue && p.reviewDue <= today)
    detail.append(
      element(
        "div",
        "REVIEW DUE — verify the current building conditions.",
        "banner",
      ),
    );
  if (p.hazardStatus === "Present" || p.hazardNotes) {
    const n = panel("Hazards & special considerations");
    n.classList.add("critical");
    n.append(
      element("b", p.hazards.join(" · ") || "Review observations"),
      element("p", p.hazardNotes || "Hazard locations not recorded."),
      element("small", "Field observation: " + (p.hazardStatus || "Unknown")),
    );
    detail.append(n);
  }
  if (p.hydrantStatus === "Out of service")
    detail.append(
      element(
        "div",
        "RECORDED WATER SOURCE OUT OF SERVICE — " + p.hydrant,
        "banner",
      ),
    );
  const essential = panel("First-in essentials");
  row(essential, "Main entrance / A side", p.entrance);
  row(essential, "Access restrictions", p.access);
  row(essential, "Water-source location", p.hydrant);
  row(essential, "Water status at visit", p.hydrantStatus);
  row(
    essential,
    "Tested flow",
    p.flow
      ? p.flow +
          " GPM · " +
          date(p.flowDate) +
          " · not a current flow guarantee"
      : "No verified test recorded",
  );
  const labels = {
    fdc: "Fire department connection",
    keybox: "Key / Knox box",
    gas: "Gas shutoff",
    electric: "Electrical shutoff",
    sprinklers: "Fire sprinklers",
    alarm: "Alarm panel",
  };
  for (const [k, label] of Object.entries(labels)) {
    const s = p.systems[k];
    row(
      essential,
      label,
      s.answer === "Yes"
        ? "Present · " + (s.location || "location unknown") + " · " + (s.status || "Condition not checked")
        : s.answer === "No"
          ? "Recorded absent at visit"
          : "Unknown — presence and location unverified",
    );
  }
  detail.append(essential);
  const building = panel("Building & people");
  for (const [label, value] of [
    ["Occupancy", p.occupancy],
    ["Floors", p.floors],
    ["Construction", p.construction],
    ["Roof", p.roof],
    ["Basement", p.basement],
    ["Occupant / rescue", p.lifeSafety],
    [
      "Emergency contact",
      [p.contactName, p.contactPhone].filter(Boolean).join(" · "),
    ],
    ["Field notes", p.notes],
  ])
    row(building, label, value);
  detail.append(building);
  if (p.footprint?.rings?.length) {
    const f = panel("Geographic building outline · estimated ground footprint");
    const rad = Math.PI / 180, radius = 6371008.8;
    const areas = p.footprint.rings.map(ring => Math.abs(ring.reduce((sum,a,i) => { const b=ring[(i+1)%ring.length]; return sum+(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad)); },0)*radius*radius/2));
    const area = Math.max(0,areas[0]-areas.slice(1).reduce((a,b)=>a+b,0))/0.09290304;
    const points=p.footprint.rings.flat(), lat0=points.reduce((v,p)=>v+p[1],0)/points.length;
    const project=p=>[p[0]*Math.cos(lat0*rad),p[1]]; const projected=p.footprint.rings.map(r=>r.map(project));
    const xs=projected.flat().map(p=>p[0]),ys=projected.flat().map(p=>p[1]); const minX=Math.min(...xs),maxY=Math.max(...ys),w=Math.max(...xs)-minX,h=maxY-Math.min(...ys),scale=260/Math.max(w,h);
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); svg.setAttribute("viewBox","0 0 300 300");svg.setAttribute("role","img");svg.setAttribute("aria-label","Saved geographic building outline, north up");svg.style.maxWidth="300px";
    const shape=document.createElementNS("http://www.w3.org/2000/svg","path");shape.setAttribute("d",projected.map(r=>r.map((p,i)=>(i?"L":"M")+(20+(p[0]-minX)*scale)+","+(20+(maxY-p[1])*scale)).join(" ")+" Z").join(" "));shape.setAttribute("fill-rule","evenodd");shape.setAttribute("fill","#e7efdd");shape.setAttribute("stroke","#2c523e");shape.setAttribute("stroke-width","2");svg.append(shape);f.append(svg,element("small","North up · saved geometry; aerial imagery requires a connection"));
    row(f,"Estimated footprint",Math.round(area).toLocaleString()+" sq ft · not total floor area");
    row(f,"Source",(p.footprint.source === "cook-county-2022" ? "Cook County GIS" : "Traced / edited")+" · "+p.footprint.sourceYear);
    row(f,"Checked",date(p.footprint.checkedAt)); detail.append(f);
  }
  if (p.details) {
    const extra = panel("Additional building details");
    for (const [key,label] of [["standpipe","Standpipe"],["firePump","Fire pump"]]) { const system=p.details[key]; if(system) row(extra,label,(system.answer||"Unknown")+" · "+(system.location||"Location unknown")+" · "+(system.status||"Not checked")); }
    row(extra,"FDC specifications",p.details.fdcSpec); row(extra,"Sprinkler coverage",p.details.sprinklerCoverage);
    for(const x of p.details.levels||[]) row(extra,"Floor / level",[x.name,x.notes].filter(Boolean).join(" · "));
    for(const x of p.details.occupants||[]) row(extra,"Occupant",[x.name,x.location,x.notes].filter(Boolean).join(" · "));
    for(const x of p.details.materials||[]) row(extra,"Hazardous material",[x.name,x.location,x.quantity,x.unNumber,x.notes].filter(Boolean).join(" · "));
    detail.append(extra);
  }
  const photos = panel("Exterior photos · downloaded copies");
  const grid = element("div", undefined, "photos");
  for (const [index, side] of ["A", "B", "C", "D"].entries()) {
    const f = element("figure");
    const photo = p.photos.find((x) => x.side === side);
    if (photo && packet.images[photo.id]) {
      const img = element("img");
      img.src = packet.images[photo.id];
      img.alt = side + " side " + (photo.caption || "exterior");
      f.append(img);
    } else f.append(element("p", "No downloaded photo"));
    f.append(
      element(
        "figcaption",
        side +
          " · " +
          ["Front / main entrance", "Left side", "Rear side", "Right side"][
            index
          ] +
          (photo?.caption ? " — " + photo.caption : ""),
      ),
    );
    grid.append(f);
  }
  photos.append(
    grid,
    element(
      "p",
      "Floor-plan PDFs and other online attachments are not included.",
    ),
  );
  const overviews=p.photos.filter(x=>x.side==="Overview");
  if(overviews.length){const overview=panel("Imported overview photos · source sides unassigned");const tiles=element("div",undefined,"photos");for(const photo of overviews){const f=element("figure");if(packet.images[photo.id]){const img=element("img");img.src=packet.images[photo.id];img.alt=photo.caption||photo.name;f.append(img);}else f.append(element("p","No downloaded source image"));f.append(element("figcaption",photo.caption||photo.name));tiles.append(f);}overview.append(tiles);detail.append(overview);}
  detail.append(photos);
  const sketch = panel("Relative sketch symbols · not geographic coordinates");
  if (p.pins.length)
    for (const pin of p.pins)
      row(
        sketch,
        pin.label,
        Math.round(pin.x) +
          "% from left · " +
          Math.round(pin.y) +
          "% from top · A side at bottom",
      );
  else
    sketch.append(
      element("p", "No symbols recorded. Use the written locations."),
    );
  detail.append(sketch);
  const unknown = [];
  for (const [k, label] of Object.entries(labels)) {
    const s = p.systems[k];
    if (!s.answer || s.answer === "Unknown") unknown.push(label);
    else if (s.answer === "Yes" && (!s.location || /unknown/i.test(s.location)))
      unknown.push(label + " location");
  }
  for (const [label, value] of [
    ["Construction", p.construction],
    ["Roof", p.roof],
    ["Floors", p.floors],
    ["Occupancy", p.occupancy],
    ["Basement", p.basement],
    ["Water supply", p.hydrantStatus],
    ["Hazards", p.hazardStatus],
    ["Occupant / rescue", p.lifeSafety],
    ["Emergency contact", p.contactName],
  ])
    if (!value || value === "Unknown") unknown.push(label);
  if (!p.hydrant || /unknown/i.test(p.hydrant))
    unknown.push("Water-source location");
  for (const side of ["A", "B", "C", "D"])
    if (!p.photos.some((x) => x.side === side))
      unknown.push(side + "-side photo");
  const unknownPanel = panel("Unknown or missing information");
  unknownPanel.classList.add("critical");
  unknownPanel.append(
    element("p", "Unknown does not mean absent. Verify current conditions."),
  );
  const tags = element("div", undefined, "tags");
  for (const value of unknown) tags.append(element("span", value));
  unknownPanel.append(tags);
  detail.append(unknownPanel);
  window.scrollTo(0, 0);
}
async function load() {
  try {
    const db = await database();
    savedPackets = await new Promise((resolve, reject) => {
      const req = db.transaction("packets").objectStore("packets").getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((p) => p.record?.published && p.owner===localStorage.getItem("stickney-arrival-owner")));
      req.onerror = () => reject(req.error);
    });
    db.close();
    savedPackets.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    const selected = savedPackets.find((p) => p.id === location.hash.slice(1));
    if (selected) showPacket(selected);
    else showList();
  } catch {
    document.getElementById("message").textContent =
      "Device storage could not be opened. Use the online workspace on this browser.";
  }
}
document.getElementById("search").addEventListener("input", showList);
window.addEventListener("hashchange", () => {
  const selected = savedPackets.find((p) => p.id === location.hash.slice(1));
  if (selected) showPacket(selected);
  else showList();
});
load();

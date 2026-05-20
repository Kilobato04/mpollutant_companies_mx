const state = {
  raw: [],
  filtered: [],
  markers: new Map(),
  layer: null,
};

const el = {
  list: document.getElementById("list"),
  stats: document.getElementById("stats"),
  search: document.getElementById("search"),
  region: document.getElementById("region"),
  medium: document.getElementById("medium"),
  reset: document.getElementById("reset"),
};

const map = L.map("map", { zoomControl: true }).setView([23.6345, -102.5528], 5);

// OpenStreetMap base layer (sin token)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

state.layer = L.layerGroup().addTo(map);

function hasMedium(item, medium) {
  if (medium === "all") return true;
  const p = item.pollution?.[medium];
  if (!p) return false;
  const keys = [
    ...(p.key_pollutants || []),
    ...(p.key_issues || []),
  ];
  return keys.length > 0;
}

function normalizeRegionFilter(v){
  if (v === "all") return "all";
  if (v === "Monterrey (ZMM/ZMM)") return "Monterrey";
  if (v === "Guadalajara (AMG)") return "Guadalajara";
  return v;
}

function matchesRegion(item, regionSel){
  if (regionSel === "all") return true;
  const r = normalizeRegionFilter(regionSel);
  const region = (item.region || "").toLowerCase();
  if (r === "Monterrey") return region.includes("monterrey") || region.includes("zmm") || region.includes("zmm/zmm");
  if (r === "Guadalajara") return region.includes("guadalajara") || region.includes("amg");
  if (r === "CDMX/EDOMEX") return region.includes("cdmx") || region.includes("edomex") || region.includes("zmvm");
  return region.includes(r.toLowerCase());
}

function textMatch(item, q){
  if (!q) return true;
  const hay = [
    item.name,
    item.region,
    item.state,
    item.category,
    item.what_produces,
    ...(item.pollution?.air?.key_pollutants || []),
    ...(item.pollution?.water?.key_issues || []),
    ...(item.pollution?.noise?.key_issues || []),
  ].filter(Boolean).join(" ").toLowerCase();

  return hay.includes(q.toLowerCase());
}

function computeScore(item){
  // Score preliminar (no definitivo): pondera solo "lo que exista" en el JSON.
  // Aire: suma de cantidades reportadas si hay.
  // Agua/Ruido: presencia de issues suma puntos.
  let s = 0;

  const airAmounts = item.pollution?.air?.reported_amounts || [];
  airAmounts.forEach(a => {
    if (typeof a.amount === "number") s += Math.min(50, a.amount); // cap simple
    else s += 5;
  });

  const airKeys = item.pollution?.air?.key_pollutants || [];
  s += airKeys.length * 3;

  const waterKeys = item.pollution?.water?.key_issues || [];
  s += waterKeys.length * 4;

  const noiseKeys = item.pollution?.noise?.key_issues || [];
  s += noiseKeys.length * 2;

  const sanctions = item.sanctions?.known_fines || [];
  s += sanctions.length * 10;

  return Math.round(s);
}

function badge(label){
  const span = document.createElement("span");
  span.className = "badge";
  span.textContent = label;
  return span;
}

function popupHtml(item){
  const score = computeScore(item);
  const air = (item.pollution?.air?.key_pollutants || []).join(", ") || "—";
  const water = (item.pollution?.water?.key_issues || []).join(", ") || "—";
  const noise = (item.pollution?.noise?.key_issues || []).join(", ") || "—";

  const sources = (item.sources || []).slice(0, 3).map(s => {
    const safeTitle = (s.title || "Fuente").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const safeUrl = s.url || "#";
    return `<div>${safeUrl}${safeTitle}</a></div>`;
  }).join("");

  return `
    <div style="min-width:260px">
      <div style="font-weight:800; margin-bottom:4px">${item.name}</div>
      <div style="color:#6f85b6; font-size:12px; margin-bottom:8px">${item.region || ""} · ${item.category || ""}</div>
      <div style="font-size:12px; margin-bottom:6px"><b>Score preliminar:</b> ${score}</div>
      <div style="font-size:12px"><b>Aire:</b> ${air}</div>
      <div style="font-size:12px"><b>Agua:</b> ${water}</div>
      <div style="font-size:12px; margin-bottom:8px"><b>Ruido:</b> ${noise}</div>
      <div style="font-size:12px; color:#6f85b6"><b>Fuentes:</b></div>
      <div style="font-size:12px">${sources || "—"}</div>
    </div>
  `;
}

function clearMarkers(){
  state.layer.clearLayers();
  state.markers.clear();
}

function renderMarkers(items){
  clearMarkers();

  const bounds = [];
  items.forEach(item => {
    const { lat, lng } = item.location || {};
    if (typeof lat === "number" && typeof lng === "number") {
      const m = L.marker([lat, lng]).addTo(state.layer);
      m.bindPopup(popupHtml(item));
      state.markers.set(item.id, m);
      bounds.push([lat, lng]);
    }
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderList(items){
  el.list.innerHTML = "";

  items
    .slice()
    .sort((a,b) => computeScore(b) - computeScore(a))
    .forEach(item => {
      const div = document.createElement("div");
      div.className = "item";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.name;

      const meta = document.createElement("div");
      meta.className = "meta";
      const loc = item.location?.lat && item.location?.lng ? "📍 con coords" : "⛔ sin coords";
      meta.textContent = `${item.region || "—"} · ${item.category || "—"} · ${loc}`;

      const badges = document.createElement("div");
      badges.className = "badges";
      const score = computeScore(item);
      badges.appendChild(badge(`Score ${score}`));
      const air = item.pollution?.air?.key_pollutants?.length ? "Aire" : null;
      const water = item.pollution?.water?.key_issues?.length ? "Agua" : null;
      const noise = item.pollution?.noise?.key_issues?.length ? "Ruido" : null;
      [air, water, noise].filter(Boolean).forEach(b => badges.appendChild(badge(b)));

      div.appendChild(name);
      div.appendChild(meta);
      div.appendChild(badges);

      div.addEventListener("click", () => {
        const marker = state.markers.get(item.id);
        const { lat, lng } = item.location || {};
        if (marker) {
          map.setView([lat, lng], 13, { animate: true });
          marker.openPopup();
        }
      });

      el.list.appendChild(div);
    });

  const withCoords = items.filter(i => typeof i.location?.lat === "number" && typeof i.location?.lng === "number").length;
  el.stats.textContent = `Items: ${items.length} · Con coordenadas: ${withCoords} · Sin coordenadas: ${items.length - withCoords}`;
}

function applyFilters(){
  const q = el.search.value.trim();
  const r = el.region.value;
  const m = el.medium.value;

  state.filtered = state.raw
    .filter(item => matchesRegion(item, r))
    .filter(item => hasMedium(item, m))
    .filter(item => textMatch(item, q));

  renderMarkers(state.filtered);
  renderList(state.filtered);
}

async function init(){
  const res = await fetch("./data/empresas.json", { cache: "no-store" });
  const data = await res.json();
  state.raw = data.items || [];
  applyFilters();
}

el.search.addEventListener("input", applyFilters);
el.region.addEventListener("change", applyFilters);
el.medium.addEventListener("change", applyFilters);
el.reset.addEventListener("click", () => {
  el.search.value = "";
  el.region.value = "all";
  el.medium.value = "all";
  applyFilters();
});

init().catch(err => {
  console.error(err);
  el.stats.textContent = "Error cargando data/empresas.json";
});

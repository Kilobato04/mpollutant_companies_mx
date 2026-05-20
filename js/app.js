/* ── Mapa de Riesgos Ambientales – app.js ────────────── */
let DATA=[],markers=[],circles=[];
const COL={ZMM:'#ef4444','CDMX-EDOMEX':'#3b82f6',AMG:'#22c55e'};

/* Leaflet init */
const map=L.map('map',{zoomControl:false}).setView([23,-102],5.5);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  maxZoom:18,
  attribution:'&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>'
}).addTo(map);

/* helpers */
const score=d=>{
  let s=0;
  s+=d.pollution.air.reported_tonnes_yr/100;
  s+=d.pollution.noise.estimated_db/10;
  s+=d.sanctions.known_fines.length*20;
  s+=d.health.evidence.length*15;
  return Math.round(s);
};
const fmt=n=>n.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});
const esc=s=>(s||'').replace(/</g,'&lt;');

/* popup builder */
function buildPopup(d){
  const c=COL[d.region]||'#888';
  let h=`<div class="pop-title" style="color:${c}">${esc(d.name)}</div>`;
  h+=`<div class="pop-cat">${esc(d.category)} · ${esc(d.region)} · ${esc(d.state)}</div>`;

  /* Qué produce */
  h+=`<div class="pop-section"><h4>🏭 Qué produce</h4>${esc(d.what_produces)}</div>`;

  /* Aire */
  const a=d.pollution.air;
  h+=`<div class="pop-section"><h4>💨 Contaminación – Aire</h4><div class="pop-pills">`;
  a.key_pollutants.forEach(p=>{h+=`<span class="pill pill-air">${esc(p)}</span>`});
  h+=`</div><b>${a.reported_tonnes_yr.toLocaleString('es-MX')}</b> ton/año <span style="color:var(--muted);font-size:.72rem">(${esc(a.source)})</span></div>`;

  /* Agua */
  const w=d.pollution.water;
  h+=`<div class="pop-section"><h4>💧 Contaminación – Agua</h4><div class="pop-pills">`;
  w.key_pollutants.forEach(p=>{h+=`<span class="pill pill-water">${esc(p)}</span>`});
  h+=`</div><b>${w.reported_m3_yr.toLocaleString('es-MX')}</b> m³/año <span style="color:var(--muted);font-size:.72rem">(${esc(w.source)})</span></div>`;

  /* Ruido */
  h+=`<div class="pop-section"><h4>🔊 Ruido</h4>${d.pollution.noise.estimated_db} dB estimados</div>`;

  /* Mitigación */
  h+=`<div class="pop-section"><h4>🛡️ Mitigación</h4><ul class="pop-list">`;
  d.mitigation.reported_actions.forEach(a=>{h+=`<li>${esc(a)}</li>`});
  h+=`</ul></div>`;

  /* Sanciones */
  if(d.sanctions.known_fines.length){
    h+=`<div class="pop-section"><h4>⚖️ Sanciones</h4>`;
    d.sanctions.known_fines.forEach(f=>{
      h+=`<div class="pop-fine"><b>${f.year}</b> — ${fmt(f.amount_mxn)}<br>${esc(f.reason)}<br><span style="color:var(--muted);font-size:.7rem">${esc(f.source)}</span></div>`;
    });
    h+=`</div>`;
  }

  /* Salud */
  if(d.health.evidence.length){
    h+=`<div class="pop-section"><h4>🏥 Evidencia de Salud</h4>`;
    d.health.evidence.forEach(e=>{
      const cc=e.confidence==='alta'?'conf-alta':e.confidence==='media'?'conf-media':'conf-baja';
      h+=`<div class="pop-health"><span class="${cc}">[${e.confidence}]</span> <b>${esc(e.type)}</b><br>${esc(e.claim)}<br><i style="color:var(--muted)">${esc(e.scope)}</i>`;
      if(e.source_url&&e.source_url!=='N/A') h+=`<br><a class="pop-link" href="${e.source_url}" target="_blank">📎 Fuente</a>`;
      h+=`</div>`;
    });
    h+=`</div>`;
  }

  /* Contacto */
  h+=`<div class="pop-section"><h4>📞 Contacto</h4>`;
  if(d.contacts.phone&&!d.contacts.phone.startsWith('No ')) h+=`📱 <a class="pop-link" href="tel:${d.contacts.phone}">${esc(d.contacts.phone)}</a><br>`;
  if(d.contacts.email&&d.contacts.email!=='N/A') h+=`📧 <a class="pop-link" href="mailto:${d.contacts.email}">${esc(d.contacts.email)}</a><br>`;
  if(d.contacts.website&&d.contacts.website!=='N/A') h+=`🌐 <a class="pop-link" href="${d.contacts.website}" target="_blank">${esc(d.contacts.website)}</a>`;
  h+=`</div>`;

  /* Ubicación */
  h+=`<div class="pop-section"><h4>📍 Ubicación</h4>${esc(d.location.address)}<br>`;
  h+=`<span style="color:var(--muted)">${d.location.lat}, ${d.location.lng}</span> · Radio de impacto: <b>${d.location.impact_radius_km} km</b></div>`;

  /* Fuentes */
  if(d.sources.length){
    h+=`<div class="pop-section"><h4>📚 Fuentes</h4>`;
    d.sources.forEach(s=>{h+=`<a class="pop-link" href="${s}" target="_blank">${esc(s)}</a><br>`});
    h+=`</div>`;
  }
  return h;
}

/* sidebar card builder */
function buildCard(d,idx){
  const c=COL[d.region]||'#888';
  const rCls=d.region==='ZMM'?'badge-zmm':d.region==='AMG'?'badge-amg':'badge-cdmx';
  let h=`<div class="card" data-idx="${idx}">`;
  h+=`<div class="c-name" style="color:${c}">${esc(d.name)}</div>`;
  h+=`<div class="c-meta"><span class="badge ${rCls}">${d.region}</span>`;
  h+=`<span>${esc(d.category)}</span>`;
  h+=`<span class="badge badge-score">⚠ ${score(d)}</span></div>`;
  h+=`<div>`;
  h+=`<span class="pill pill-air">💨 ${d.pollution.air.reported_tonnes_yr.toLocaleString('es-MX')} t</span>`;
  h+=`<span class="pill pill-water">💧 ${d.pollution.water.reported_m3_yr.toLocaleString('es-MX')} m³</span>`;
  h+=`<span class="pill pill-noise">🔊 ${d.pollution.noise.estimated_db} dB</span>`;
  h+=`</div></div>`;
  return h;
}

/* filter logic */
function applyFilters(){
  const q=document.getElementById('search').value.toLowerCase();
  const reg=document.getElementById('filterRegion').value;
  const med=document.getElementById('filterMedium').value;

  let filtered=DATA.filter(d=>{
    if(q){
      const hay=(d.name+d.category+d.state+d.what_produces).toLowerCase().includes(q);
      if(!hay) return false;
    }
    if(reg&&d.region!==reg) return false;
    if(med==='air' && d.pollution.air.reported_tonnes_yr===0) return false;
    if(med==='water' && d.pollution.water.reported_m3_yr===0) return false;
    if(med==='noise' && d.pollution.noise.estimated_db===0) return false;
    return true;
  });
  filtered.sort((a,b)=>score(b)-score(a));

  /* stats */
  const totalFines=filtered.reduce((s,d)=>s+d.sanctions.known_fines.reduce((a,f)=>a+f.amount_mxn,0),0);
  const regions=new Set(filtered.map(d=>d.region)).size;
  document.getElementById('stats').innerHTML=
    `<span>🏭 ${filtered.length} empresas</span>`+
    `<span>⚖️ ${fmt(totalFines)} en multas</span>`+
    `<span>📍 ${regions} regiones</span>`;

  /* sidebar cards */
  const list=document.getElementById('list');
  list.innerHTML='';
  filtered.forEach((d,i)=>{
    list.insertAdjacentHTML('beforeend',buildCard(d,DATA.indexOf(d)));
  });

  /* map markers visibility */
  const idSet=new Set(filtered.map(d=>d.id));
  markers.forEach((m,i)=>{
    if(idSet.has(DATA[i].id)){if(!map.hasLayer(m))m.addTo(map);if(!map.hasLayer(circles[i]))circles[i].addTo(map)}
    else{if(map.hasLayer(m))map.removeLayer(m);if(map.hasLayer(circles[i]))map.removeLayer(circles[i])}
  });

  /* card click → fly to marker */
  list.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click',()=>{
      const idx=+card.dataset.idx;
      const d=DATA[idx];
      map.flyTo([d.location.lat,d.location.lng],13,{duration:1});
      setTimeout(()=>markers[idx].openPopup(),600);
    });
  });
}

/* ── Init ─────────────────────────────────────────────── */
fetch('./data/empresas.json')
  .then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  .then(data=>{
    DATA=data;
    data.forEach((d,i)=>{
      const c=COL[d.region]||'#888';
      const mk=L.circleMarker([d.location.lat,d.location.lng],{
        radius:8,fillColor:c,color:'#fff',weight:1.5,fillOpacity:.85
      }).bindPopup(buildPopup(d),{maxWidth:400,maxHeight:500});
      markers.push(mk);

      const ci=L.circle([d.location.lat,d.location.lng],{
        radius:d.location.impact_radius_km*1000,
        color:c,fillColor:c,fillOpacity:.08,weight:1,opacity:.3
      });
      circles.push(ci);
    });

    applyFilters();

    document.getElementById('search').addEventListener('input',applyFilters);
    document.getElementById('filterRegion').addEventListener('change',applyFilters);
    document.getElementById('filterMedium').addEventListener('change',applyFilters);
    document.getElementById('resetBtn').addEventListener('click',()=>{
      document.getElementById('search').value='';
      document.getElementById('filterRegion').value='';
      document.getElementById('filterMedium').value='';
      applyFilters();
      map.flyTo([23,-102],5.5,{duration:.8});
    });
  })
  .catch(e=>{
    document.getElementById('list').innerHTML=`<p style="padding:20px;color:#f87171">Error cargando datos: ${e.message}<br>Asegúrate de que <code>data/empresas.json</code> exista.</p>`;
    console.error(e);
  });

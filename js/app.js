const COL={NORESTE:'#ef4444',NOROESTE:'#f97316',CENTRO:'#3b82f6','BAJÍO':'#8b5cf6',SURESTE:'#06b6d4','PACÍFICO':'#22c55e'};
const fmt=n=>n.toLocaleString('es-MX');
const sc=d=>Math.round(d.pollution.air.reported_tonnes_yr/100+d.pollution.noise.estimated_db/10+d.sanctions.known_fines.length*20+d.health.evidence.length*15);

function bPop(d){
  const s=sc(d),col=COL[d.region]||'#888';
  let h=`<div class="ph">${d.name}</div>`;
  h+=`<span class="badge badge-${d.region}">${d.region}</span>`;
  if(d.top10) h+=` <span class="badge badge-top10">⚠ TOP 10</span>`;
  h+=` <span style="float:right;background:${col};color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">Score ${s}</span>`;
  h+=`<div class="ps"><h4>🏭 ${d.category}</h4><p>${d.what_produces}</p></div>`;
  h+=`<div class="ps"><h4>🌬 Contaminación Aire</h4><p>${d.pollution.air.key_pollutants.map(p=>'<span class="pill">'+p+'</span>').join('')}</p><p><b>${fmt(d.pollution.air.reported_tonnes_yr)}</b> t/año</p></div>`;
  h+=`<div class="ps"><h4>💧 Contaminación Agua</h4><p>${d.pollution.water.key_pollutants.map(p=>'<span class="pill">'+p+'</span>').join('')}</p><p><b>${fmt(d.pollution.water.reported_m3_yr)}</b> m³/año</p></div>`;
  h+=`<div class="ps"><h4>🔊 Ruido</h4><p><b>${d.pollution.noise.estimated_db}</b> dB</p></div>`;
  h+=`<div class="ps"><h4>🛡 Mitigación</h4><ul>${d.mitigation.reported_actions.map(a=>'<li>'+a+'</li>').join('')}</ul></div>`;
  if(d.sanctions.known_fines.length){
    h+=`<div class="ps"><h4>⚖ Sanciones (${d.sanctions.known_fines.length})</h4>`;
    d.sanctions.known_fines.forEach(f=>{h+=`<div class="fi"><b>${f.year}</b> — $${fmt(f.amount_mxn)} MXN<br>${f.reason}</div>`;});
    h+=`</div>`;
  }
  if(d.health.evidence.length){
    h+=`<div class="ps"><h4>🏥 Evidencia de Salud (${d.health.evidence.length})</h4>`;
    d.health.evidence.forEach(e=>{h+=`<div class="hi"><b>[${e.type}]</b> ${e.claim}<br><i>Alcance: ${e.scope} · Confianza: ${e.confidence}</i></div>`;});
    h+=`</div>`;
  }
  if(d.contacts.phone!=='N/A'){
    h+=`<div class="ps"><h4>📞 Contacto</h4>`;
    h+=`<div class="cr">📱 ${d.contacts.phone}</div>`;
    h+=`<div class="cr">✉ ${d.contacts.email}</div>`;
    h+=`<div class="cr">🌐 <a href="${d.contacts.website}" target="_blank">${d.contacts.website}</a></div></div>`;
  }
  h+=`<div class="ps"><h4>📍 Ubicación</h4><p>${d.location.address}<br>Radio impacto: <b>${d.location.impact_radius_km} km</b></p></div>`;
  return h;
}

function bCard(d,i){
  const s=sc(d),col=COL[d.region]||'#888';
  let h=`<div class="card" data-i="${i}" style="border-left-color:${col}"><span class="card-sc">${s}</span>`;
  h+=`<div class="card-t">${d.name}</div><div class="card-s"><span class="badge badge-${d.region}">${d.region}</span>`;
  if(d.top10) h+=`<span class="badge badge-top10">⚠</span>`;
  h+=` ${d.state} · ${d.category}</div></div>`;
  return h;
}

const map=L.map('map',{zoomControl:true}).setView([23.5,-102],5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© CartoDB © OSM',maxZoom:18}).addTo(map);

let DATA=[],MK=[],CI=[],t10=false;

function go(){
  const q=document.getElementById('search').value.toLowerCase();
  const rg=document.getElementById('filterRegion').value;
  const md=document.getElementById('filterMedium').value;
  MK.forEach(m=>map.removeLayer(m));CI.forEach(c=>map.removeLayer(c));MK=[];CI=[];
  let F=DATA.filter(d=>{
    if(t10&&!d.top10) return false;
    if(rg&&d.region!==rg) return false;
    if(q&&!(d.name+d.state+d.category+d.what_produces+d.region).toLowerCase().includes(q)) return false;
    if(md==='air'&&d.pollution.air.reported_tonnes_yr<100) return false;
    if(md==='water'&&d.pollution.water.reported_m3_yr<10000) return false;
    if(md==='noise'&&d.pollution.noise.estimated_db<70) return false;
    return true;
  }).sort((a,b)=>sc(b)-sc(a));
  const PM=[];
  F.forEach((d,i)=>{
    const col=COL[d.region]||'#888',isT=d.top10;
    const mk=L.circleMarker([d.location.lat,d.location.lng],{radius:isT?13:8,fillColor:col,fillOpacity:isT?.95:.8,color:isT?'#fbbf24':'#fff',weight:isT?3:1}).addTo(map);
    mk.bindPopup(bPop(d),{maxWidth:380,maxHeight:440});
    MK.push(mk);PM.push(mk);
    const ci=L.circle([d.location.lat,d.location.lng],{radius:d.location.impact_radius_km*1000,fillColor:col,fillOpacity:.05,color:col,weight:1,dashArray:'4 6'}).addTo(map);
    CI.push(ci);
  });
  const tf=F.reduce((s,d)=>s+d.sanctions.known_fines.reduce((a,f)=>a+f.amount_mxn,0),0);
  const st=new Set(F.map(d=>d.state)).size;
  document.getElementById('stats').innerHTML=`<div><div class="sv">${F.length}</div><div class="sl">Empresas</div></div><div><div class="sv">$${(tf/1e6).toFixed(0)}M</div><div class="sl">Multas MXN</div></div><div><div class="sv">${st}</div><div class="sl">Estados</div></div>`;
  document.getElementById('list').innerHTML=F.map((d,i)=>bCard(d,i)).join('');
  document.querySelectorAll('.card').forEach(c=>{
    c.addEventListener('click',()=>{const i=+c.dataset.i;map.flyTo(PM[i].getLatLng(),10,{duration:1});setTimeout(()=>PM[i].openPopup(),1100);});
  });
}
document.getElementById('search').addEventListener('input',go);
document.getElementById('filterRegion').addEventListener('change',go);
document.getElementById('filterMedium').addEventListener('change',go);
document.getElementById('top10Btn').addEventListener('click',function(){t10=!t10;this.classList.toggle('active',t10);go();});
document.getElementById('resetBtn').addEventListener('click',()=>{document.getElementById('search').value='';document.getElementById('filterRegion').value='';document.getElementById('filterMedium').value='';t10=false;document.getElementById('top10Btn').classList.remove('active');map.setView([23.5,-102],5);go();});
fetch('./data/empresas.json').then(r=>r.json()).then(d=>{DATA=d;go();}).catch(e=>console.error('Error:',e));

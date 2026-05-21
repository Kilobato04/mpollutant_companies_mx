const COLREG={NORESTE:'#ef4444',NOROESTE:'#f97316',CENTRO:'#3b82f6','BAJÍO':'#8b5cf6',SURESTE:'#06b6d4','PACÍFICO':'#22c55e'};
const OWN={publico:'#22c55e',privado:'#ef4444',cluster:'#38bdf8',mixto:'#a78bfa'};
const fmt=n=>Number(n||0).toLocaleString('es-ES');
const score=d=>Number(d.score??( (d.pollution?.air?.reported_tonnes_yr||0)/100 + (d.pollution?.noise?.estimated_db||0)/10 ));

const map=L.map('map').setView([23.5,-102],5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,attribution:'© OSM © Carto'}).addTo(map);

let DATA=[],MK=[],CI=[],top10=false,top10p=false;

function badge(o){
  const cls=o==='publico'?'pub':o==='privado'?'pri':o==='cluster'?'clu':'mix';
  const txt=o==='publico'?'Público':o==='privado'?'Privado':o==='cluster'?'Cluster':'Mixto';
  return `<span class="bad ${cls}">${txt}</span>`;
}

function popup(d){
  const o=d.ownership||'privado';
  const col=OWN[o]||'#94a3b8';
  const reg=d.region||'';
  const s=Math.round(score(d));
  const top=(d.top10||d.top10_private)?`<span class="bad top">TOP</span>`:'';
  const pats=(d.pollution?.air?.key_pollutants||[]).slice(0,10).map(p=>`<span class="ppk">${p}</span>`).join('');
  return `
    <div class="pph">${d.name}</div>
    ${badge(o)}${top}${reg?`<span class="bad" style="background:${(COLREG[reg]||'#334155')}33;border:1px solid ${(COLREG[reg]||'#334155')}66;color:#fff">${reg}</span>`:''}
    <div class="pps"><b>Score:</b> <span style="color:${col};font-weight:900">${s}</span> · <b>Sector:</b> ${d.sector||'-'} · <b>Estado:</b> ${d.state||'-'}</div>
    <div class="pps"><b>Categoría:</b> ${d.category||'-'}<br><b>Qué produce:</b> ${d.what_produces||'-'}</div>
    <div class="pps"><b>Aire:</b> ${fmt(d.pollution?.air?.reported_tonnes_yr)} t/año<br>${pats}</div>
    <div class="pps"><b>Agua:</b> ${fmt(d.pollution?.water?.reported_m3_yr)} m³/año</div>
    <div class="pps"><b>Ruido:</b> ${d.pollution?.noise?.estimated_db||0} dB</div>
    <div class="pps" style="color:#94a3b8"><b>Calidad de datos:</b> ${d.data_quality||'n/a'}</div>
  `;
}

function card(d,i){
  const o=d.ownership||'privado';
  const s=Math.round(score(d));
  const top=(d.top10||d.top10_private)?`<span class="bad top">TOP</span>`:'';
  return `<div class="card" data-i="${i}"><div class="ct">${d.name} <span style="float:right">${s}</span></div><div class="cs">${badge(o)}${top}${d.state||''} · ${d.sector||''}</div></div>`;
}

function clear(){MK.forEach(m=>map.removeLayer(m));CI.forEach(c=>map.removeLayer(c));MK=[];CI=[];}

function apply(){
  const q=(document.getElementById('q').value||'').toLowerCase().trim();
  const own=document.getElementById('own').value;
  const reg=document.getElementById('reg').value;
  const med=document.getElementById('med').value;

  clear();

  let arr=DATA.filter(d=>{
    if(top10 && !(d.top10||d.top10_private)) return false;
    if(top10p && !d.top10_private) return false;
    if(own && (d.ownership!==own)) return false;
    if(reg && d.region!==reg) return false;
    if(q){
      const t=(d.name+' '+(d.state||'')+' '+(d.category||'')+' '+(d.sector||'')+' '+(d.what_produces||'')).toLowerCase();
      if(!t.includes(q)) return false;
    }
    if(med==='air' && (d.pollution?.air?.reported_tonnes_yr||0)<100) return false;
    if(med==='water' && (d.pollution?.water?.reported_m3_yr||0)<10000) return false;
    if(med==='noise' && (d.pollution?.noise?.estimated_db||0)<70) return false;
    return true;
  }).sort((a,b)=>score(b)-score(a));

  // stats
  const n=arr.length;
  const priv=arr.filter(d=>d.ownership==='privado').length;
  const pub=arr.filter(d=>d.ownership==='publico').length;
  const clu=arr.filter(d=>d.ownership==='cluster').length;
  document.getElementById('stats').innerHTML=`
    <div><div class="stv">${n}</div><div class="stl">Resultados</div></div>
    <div><div class="stv">${priv}</div><div class="stl">Privadas</div></div>
    <div><div class="stv">${pub}</div><div class="stl">Públicas</div></div>
    <div><div class="stv">${clu}</div><div class="stl">Clusters</div></div>
  `;

  // markers
  const pm=[];
  arr.forEach((d,i)=>{
    const o=d.ownership||'privado';
    const col=OWN[o]||'#94a3b8';
    const isClu=d.node_type==='cluster';
    const isTop=(d.top10||d.top10_private);

    const mk=L.circleMarker([d.location.lat,d.location.lng],{
      radius:isClu?18:(isTop?13:8),
      fillColor:col,
      fillOpacity:isClu?.18:(isTop?.95:.8),
      color:isTop?'#fbbf24':'#ffffff',
      weight:isTop?3:(isClu?2:1),
      dashArray:isClu?'6 6':null
    }).addTo(map);

    mk.bindPopup(popup(d),{maxWidth:420});
    MK.push(mk);pm.push(mk);

    const rkm=d.location.impact_radius_km|| (isClu?25:8);
    const ci=L.circle([d.location.lat,d.location.lng],{radius:rkm*1000,fillColor:col,fillOpacity:isClu?.05:.03,color:col,weight:1,dashArray:'4 6'}).addTo(map);
    CI.push(ci);
  });

  document.getElementById('list').innerHTML=arr.map((d,i)=>card(d,i)).join('');
  document.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click',()=>{
      const i=+el.dataset.i;
      const m=pm[i];
      if(!m) return;
      map.flyTo(m.getLatLng(), arr[i].node_type==='cluster'?8:10, {duration:1});
      setTimeout(()=>m.openPopup(), 1100);
    });
  });
}

function bind(){
  ['q','own','reg','med'].forEach(id=>{
    document.getElementById(id).addEventListener(id==='q'?'input':'change',apply);
  });
  document.getElementById('top10').addEventListener('click',function(){
    top10=!top10; if(top10) top10p=false;
    this.classList.toggle('active',top10);
    document.getElementById('top10p').classList.remove('active');
    apply();
  });
  document.getElementById('top10p').addEventListener('click',function(){
    top10p=!top10p; if(top10p) top10=false;
    this.classList.toggle('active',top10p);
    document.getElementById('top10').classList.remove('active');
    apply();
  });
  document.getElementById('reset').addEventListener('click',()=>{
    document.getElementById('q').value='';
    document.getElementById('own').value='';
    document.getElementById('reg').value='';
    document.getElementById('med').value='';
    top10=false;top10p=false;
    document.getElementById('top10').classList.remove('active');
    document.getElementById('top10p').classList.remove('active');
    map.setView([23.5,-102],5);
    apply();
  });
}

fetch('data/empresas.json').then(r=>r.json()).then(j=>{DATA=j.empresas||[];bind();apply();}).catch(e=>console.error(e));

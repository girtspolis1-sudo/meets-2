'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel} from '../../lib/catalog.js';

const JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function loadLeaflet(){
 return new Promise((resolve,reject)=>{
  if(window.L)return resolve(window.L);
  if(!document.querySelector('link[data-leaflet]')){
   const l=document.createElement('link');l.rel='stylesheet';l.href=CSS;l.dataset.leaflet='1';document.head.appendChild(l);
  }
  const old=document.querySelector('script[data-leaflet]');
  if(old){old.addEventListener('load',()=>resolve(window.L),{once:true});old.addEventListener('error',reject,{once:true});return;}
  const s=document.createElement('script');s.src=JS;s.async=true;s.dataset.leaflet='1';s.onload=()=>resolve(window.L);s.onerror=reject;document.head.appendChild(s);
 });
}

export default function OsmEventMap(){
 const [includePending,setIncludePending]=useState(false);
 const [category,setCategory]=useState('');
 const [municipality,setMunicipality]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const {data,loading,error,refresh}=useEvents({includePending});
 const mapEl=useRef(null),mapRef=useRef(null),layerRef=useRef(null);
 const events=data?.events||[];
 const categories=useMemo(()=>[...new Set(events.flatMap(e=>[e.primary_category,...(e.tags||[])].filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const municipalities=useMemo(()=>[...new Set(events.map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const filtered=useMemo(()=>events.filter(e=>
  (!category||e.primary_category===category||e.tags?.includes(category))&&
  (!municipality||e.municipality===municipality)&&
  (!from||(e.date_to||e.date_from)>=from)&&
  (!to||e.date_from<=to)
 ),[events,category,municipality,from,to]);
 const points=filtered.filter(e=>Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude)));

 useEffect(()=>{
  let cancelled=false;
  loadLeaflet().then(L=>{
   if(cancelled||!mapEl.current)return;
   if(!mapRef.current){
    mapRef.current=L.map(mapEl.current).setView([56.95,24.6],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(mapRef.current);
   }
   if(layerRef.current)layerRef.current.remove();
   const group=L.layerGroup().addTo(mapRef.current);layerRef.current=group;
   const bounds=[];
   for(const e of points){
    const lat=Number(e.latitude),lon=Number(e.longitude),pending=e.status==='pending_review';
    const marker=L.circleMarker([lat,lon],{radius:7,weight:2,color:pending?'#a66b00':'#315c1d',fillColor:pending?'#f0b84b':'#78a85a',fillOpacity:.9});
    marker.bindPopup('<strong>'+esc(e.title)+'</strong><br>'+esc(dateLabel(e.date_from))+' · '+esc(timeLabel(e))+'<br>'+esc(e.venue_name||e.municipality||'')+'<br><small>'+(pending?'Jāpārbauda':'Publicēts')+'</small>');
    marker.addTo(group);bounds.push([lat,lon]);
   }
   if(bounds.length)mapRef.current.fitBounds(bounds,{padding:[24,24],maxZoom:11});
   else mapRef.current.setView([56.95,24.6],7);
  }).catch(()=>{});return()=>{cancelled=true;};
 },[data,category,municipality,from,to,includePending]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;},[]);

 return <>
  <div className="map-controls">
   <div className="status-toggle" role="group" aria-label="Pasākumu statuss">
    <button className={!includePending?'active':''} onClick={()=>setIncludePending(false)}>Tikai published</button>
    <button className={includePending?'active':''} onClick={()=>setIncludePending(true)}>Rādīt arī pending_review</button>
   </div>
   <label>Kategorija<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Visas</option>{categories.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Pašvaldība<select value={municipality} onChange={e=>setMunicipality(e.target.value)}><option value="">Visas</option>{municipalities.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Datums no<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>Datums līdz<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  <div className="map-summary"><strong>{points.length}</strong> punkti kartē · {filtered.length} atlasīti ieraksti · {filtered.length-points.length} bez koordinātām <button className="text-button" onClick={refresh}>{loading?'Ielādē…':'Pārlasīt'}</button></div>
  {includePending&&<p className="data-note"><strong>Iekšējais apskates režīms:</strong> dzeltenie punkti ir <code>pending_review</code> un vēl nav publiski apstiprināti.</p>}
  {error&&<div className="error-message">{error}</div>}
  <div ref={mapEl} className="osm-map" aria-label="Pasākumu karte"/>
 </>;
}

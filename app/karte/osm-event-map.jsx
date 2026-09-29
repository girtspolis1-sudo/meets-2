'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel} from '../../lib/catalog.js';

const JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};

// Natural Earth 1:50m Latvia boundary (public domain), [longitude, latitude].
const LATVIA_POLYGON=[
[26.593555,55.667529],[26.542871,55.672412],[26.401074,55.703809],[26.28125,55.750439],[26.20957,55.812109],[26.085547,55.896875],[26.004199,55.940137],[25.876367,55.994336],[25.663184,56.104834],[25.585742,56.130176],[25.206934,56.178418],[25.069922,56.200391],[24.943848,56.325586],[24.903027,56.398193],[24.841016,56.411182],[24.773242,56.395898],[24.699512,56.381299],[24.529004,56.296289],[24.473633,56.284082],[24.367871,56.283008],[24.120703,56.264258],[24.008203,56.295264],[23.812695,56.329248],[23.706738,56.334619],[23.612695,56.333838],[23.195898,56.367139],[23.119824,56.330664],[23.042969,56.324072],[22.968262,56.38042],[22.875586,56.396436],[22.773242,56.377295],[22.586914,56.375098],[22.365918,56.392871],[22.08457,56.406738],[22.042871,56.400781],[21.730566,56.325977],[21.653516,56.314551],[21.314648,56.188135],[21.046094,56.070068],[21.014941,56.258936],[21.031445,56.636572],[21.071289,56.82373],[21.257422,56.932764],[21.350781,57.017676],[21.405078,57.131006],[21.421484,57.23584],[21.45918,57.322461],[21.728711,57.570996],[21.942383,57.597852],[22.231445,57.666797],[22.55459,57.724268],[22.616992,57.651172],[22.648633,57.595361],[23.037793,57.39209],[23.136816,57.323828],[23.287305,57.089746],[23.647754,56.971045],[23.931152,57.008496],[24.054297,57.066113],[24.28125,57.172314],[24.382617,57.250049],[24.403223,57.325],[24.362988,57.645312],[24.301563,57.784131],[24.322559,57.870605],[24.3625,57.866162],[24.458887,57.907861],[24.775781,57.985254],[24.839063,57.988721],[24.911328,58.00459],[25.111035,58.063428],[25.175195,58.032129],[25.228711,57.996582],[25.258301,57.996143],[25.272656,58.009375],[25.268652,58.032227],[25.282617,58.048486],[25.340039,58.039453],[25.571289,57.942773],[25.660156,57.920166],[25.720898,57.913818],[25.79375,57.868555],[25.991113,57.838184],[26.015234,57.814746],[26.030371,57.785547],[26.215039,57.662744],[26.298047,57.601074],[26.462109,57.544482],[26.532617,57.531006],[26.819727,57.588721],[26.899805,57.608789],[26.966016,57.609131],[27.033398,57.57876],[27.187109,57.53833],[27.326563,57.525488],[27.351953,57.528125],[27.469727,57.524023],[27.511133,57.508154],[27.538672,57.429785],[27.672754,57.368115],[27.796875,57.316943],[27.828613,57.293311],[27.838281,57.247705],[27.830273,57.194482],[27.814551,57.166895],[27.762793,57.135107],[27.717383,57.054639],[27.711133,56.978076],[27.639453,56.845654],[27.655664,56.843213],[27.806055,56.86709],[27.848633,56.853418],[27.881543,56.82417],[27.89209,56.741064],[27.941406,56.703711],[27.991602,56.645312],[28.00752,56.599854],[28.103125,56.545703],[28.11084,56.510693],[28.169238,56.386865],[28.191699,56.315576],[28.202051,56.2604],[28.17334,56.190332],[28.147949,56.14292],[28.117871,56.145801],[28.032031,56.133301],[27.896289,56.076172],[27.694238,55.941553],[27.642285,55.911719],[27.589453,55.80918],[27.576758,55.798779],[27.45918,55.803516],[27.427148,55.805957],[27.30918,55.803906],[27.052539,55.830566],[26.953027,55.812939],[26.822461,55.709229],[26.771875,55.693994],[26.620215,55.679639],[26.593555,55.667529]
];

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function sourceType(e){
 const sources=(e.sources||[]).map(s=>String(s.source||'').toLowerCase());
 if(sources.includes('lff.lv'))return 'lff';
 if(sources.includes('athletics.lv'))return 'athletics';
 return 'general';
}
function markerStyle(e){
 const type=sourceType(e),pending=e.status==='pending_review';
 if(type==='lff')return {color:'#174a7e',fillColor:'#3f8ed8',radius:8,weight:3,dashArray:pending?'4 3':null};
 if(type==='athletics')return {color:'#63328d',fillColor:'#a66bd1',radius:8,weight:3,dashArray:pending?'4 3':null};
 return {color:pending?'#a66b00':'#315c1d',fillColor:pending?'#f0b84b':'#78a85a',radius:7,weight:2,dashArray:pending?'4 3':null};
}
function sourceLabel(e){
 const type=sourceType(e);
 if(type==='lff')return 'LFF · Futbols';
 if(type==='athletics')return 'Athletics.lv · Vieglatlētika';
 return (e.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'MEETS';
}
function normalisePlace(v=''){
 return String(v).toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[“”"']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function insideLatvia(lat,lon){
 if(lat<55.667529||lat>58.063428||lon<21.014941||lon>28.202051)return false;
 let inside=false;
 for(let i=0,j=LATVIA_POLYGON.length-1;i<LATVIA_POLYGON.length;j=i++){
  const [xi,yi]=LATVIA_POLYGON[i],[xj,yj]=LATVIA_POLYGON[j];
  const intersect=((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi);
  if(intersect)inside=!inside;
 }
 return inside;
}
function insideBalticView(lat,lon){return lat>=BALTIC_VIEW.south&&lat<=BALTIC_VIEW.north&&lon>=BALTIC_VIEW.west&&lon<=BALTIC_VIEW.east;}
function isLatvianEvent(e){
 const municipality=String(e.municipality||'').trim();
 if(municipality==='Ārpus Latvijas (Igaunija)')return false;
 if(municipality==='Vairākas pašvaldības'||municipality.endsWith(' novads')||municipality.endsWith(' valstspilsēta'))return true;
 return insideLatvia(Number(e.latitude),Number(e.longitude));
}
function locationKey(e){
 const lat=Number(e.latitude),lon=Number(e.longitude);
 const place=normalisePlace(e.venue_name||e.address_raw||e.settlement||e.municipality||'unknown');
 return place+'|'+lat.toFixed(5)+'|'+lon.toFixed(5);
}
function groupEvents(events){
 const groups=new Map();
 for(const e of events){
  const key=locationKey(e),g=groups.get(key)||{key,lat:Number(e.latitude),lon:Number(e.longitude),label:e.venue_name||e.address_raw||e.settlement||e.municipality||'Norises vieta',events:[]};
  g.events.push(e);groups.set(key,g);
 }
 return [...groups.values()];
}
function closestFirst(events){
 const today=new Date();today.setHours(12,0,0,0);
 return [...events].sort((a,b)=>{
  const da=new Date(a.date_from+'T12:00:00'),db=new Date(b.date_from+'T12:00:00');
  const xa=Math.abs(da-today),xb=Math.abs(db-today);
  return xa-xb||da-db||String(a.title).localeCompare(String(b.title),'lv');
 });
}
function groupType(events){
 const types=[...new Set(events.map(sourceType))];
 return types.length===1?types[0]:'general';
}
function groupPosition(group,indexByCoordinate){
 let lat=group.lat,lon=group.lon;
 const key=lat.toFixed(5)+','+lon.toFixed(5);
 const i=indexByCoordinate.get(key)||0;indexByCoordinate.set(key,i+1);
 if(i>0){
  const angle=(i*137.5)*Math.PI/180;
  lat+=Math.sin(angle)*0.0025;
  lon+=Math.cos(angle)*0.004;
 }
 return [lat,lon];
}
function popupHtml(group){
 const sorted=closestFirst(group.events);
 const rows=sorted.map(e=>{
  const approximate=['settlement_center','municipality_center'].includes(e.location_precision);
  return '<li><strong>'+esc(e.title)+'</strong><span>'+esc(dateLabel(e.date_from))+' · '+esc(timeLabel(e))+'</span><small>'+esc(sourceLabel(e))+' · '+(e.status==='pending_review'?'Jāpārbauda':'Publicēts')+(approximate?' · aptuvena lokācija':'')+'</small></li>';
 }).join('');
 return '<div class="location-popup"><div class="location-popup-head"><strong>'+esc(group.label)+'</strong><span>'+group.events.length+' pasākumi</span></div><ol>'+rows+'</ol></div>';
}
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
  const [category,setCategory]=useState('');
 const [municipality,setMunicipality]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const {data,loading,error,refresh}=useEvents();
 const mapEl=useRef(null),mapRef=useRef(null),layerRef=useRef(null);
 const events=data?.events||[];
 const publicFrom=data?.window?.from||'';
 const publicTo=data?.window?.to||'';
 const categories=useMemo(()=>[...new Set(events.flatMap(e=>[e.primary_category,...(e.tags||[])].filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const municipalities=useMemo(()=>[...new Set(events.map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const filtered=useMemo(()=>events.filter(e=>
  (!category||e.primary_category===category||e.tags?.includes(category))&&
  (!municipality||e.municipality===municipality)&&
  (!from||(e.date_to||e.date_from)>=from)&&
  (!to||e.date_from<=to)
 ),[events,category,municipality,from,to]);
 const coordinateEvents=filtered.filter(e=>Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude)));
 const latvianEvents=coordinateEvents.filter(isLatvianEvent);
 const points=latvianEvents.filter(e=>insideBalticView(Number(e.latitude),Number(e.longitude)));
 const hiddenOutside=coordinateEvents.length-latvianEvents.length;
 const hiddenInvalid=latvianEvents.length-points.length;
 const locationGroups=useMemo(()=>groupEvents(points),[points]);
 const lffCount=points.filter(e=>sourceType(e)==='lff').length;
 const athleticsCount=points.filter(e=>sourceType(e)==='athletics').length;

 useEffect(()=>{
  let cancelled=false;
  loadLeaflet().then(L=>{
   if(cancelled||!mapEl.current)return;
   if(!mapRef.current){
    const fixedBounds=L.latLngBounds([BALTIC_VIEW.south,BALTIC_VIEW.west],[BALTIC_VIEW.north,BALTIC_VIEW.east]);
    mapRef.current=L.map(mapEl.current,{maxBounds:fixedBounds,maxBoundsViscosity:1,minZoom:5}).fitBounds(fixedBounds,{padding:[20,20]});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(mapRef.current);
   }
   if(layerRef.current)layerRef.current.remove();
   const layer=L.layerGroup().addTo(mapRef.current);layerRef.current=layer;
   const bounds=[],indexByCoordinate=new Map();
   for(const group of locationGroups){
    const [lat,lon]=groupPosition(group,indexByCoordinate);
    const ordered=closestFirst(group.events),first=ordered[0],type=groupType(group.events),hasPending=group.events.some(e=>e.status==='pending_review');
    let marker;
    if(group.events.length>1){
      const icon=L.divIcon({className:'event-count-marker-wrap',html:'<span class="event-count-marker '+type+(hasPending?' pending':'')+'">'+group.events.length+'</span>',iconSize:[38,38],iconAnchor:[19,19]});
      marker=L.marker([lat,lon],{icon});
    }else{
      marker=L.circleMarker([lat,lon],{...markerStyle(first),fillOpacity:.9});
    }
    marker.bindPopup(popupHtml(group),{maxWidth:390,maxHeight:360});
    marker.addTo(layer);bounds.push([lat,lon]);
   }
   const safeBounds=bounds.filter(([lat,lon])=>insideBalticView(lat,lon));
   const fixedBounds=L.latLngBounds([BALTIC_VIEW.south,BALTIC_VIEW.west],[BALTIC_VIEW.north,BALTIC_VIEW.east]);
   if(safeBounds.length)mapRef.current.fitBounds(safeBounds,{padding:[35,35],maxZoom:11});
   else mapRef.current.fitBounds(fixedBounds,{padding:[20,20]});
  }).catch(()=>{});return()=>{cancelled=true;};
 },[data,category,municipality,from,to,locationGroups]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;},[]);

 return <>
  <div className="map-controls">
   <label>Kategorija<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Visas</option>{categories.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Pašvaldība<select value={municipality} onChange={e=>setMunicipality(e.target.value)}><option value="">Visas</option>{municipalities.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Datums no<input type="date" min={publicFrom||undefined} max={publicTo||undefined} value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>Datums līdz<input type="date" min={publicFrom||undefined} max={publicTo||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  <div className="map-legend" aria-label="Kartes leģenda">
   <span><i className="legend-dot published"/>Publicēts</span>
   <span><i className="legend-dot lff"/>LFF futbols ({lffCount})</span>
   <span><i className="legend-dot athletics"/>Vieglatlētika ({athleticsCount})</span>
   <span><i className="legend-count">3</i>Vairāki pasākumi vienā vietā</span>
  </div>
  <div className="map-summary"><strong>{locationGroups.length}</strong> vietas kartē · {points.length} publicēti pasākumi ar punktu Latvijā · {filtered.length-coordinateEvents.length} bez koordinātām{hiddenOutside>0?' · '+hiddenOutside+' ārpus Latvijas paslēpti':''}{hiddenInvalid>0?' · '+hiddenInvalid+' ar kļūdainām koordinātām paslēpti':''}{publicFrom&&publicTo?' · periods '+publicFrom+'–'+publicTo:''} <button className="text-button" onClick={refresh}>{loading?'Ielādē…':'Pārlasīt'}</button></div>
  {error&&<div className="error-message">{error}</div>}
  <div ref={mapEl} className="osm-map" aria-label="Pasākumu karte"/>
 </>;
}

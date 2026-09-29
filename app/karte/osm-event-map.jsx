'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel} from '../../lib/catalog.js';

const LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const MAPLIBRE_CSS='https://unpkg.com/maplibre-gl@5.17.0/dist/maplibre-gl.css';
const OPENFREEMAP_STYLE='https://tiles.openfreemap.org/styles/positron';
const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};
const RADIUS_OPTIONS=[5,10,20,30,50,100,0];

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function norm(v=''){return String(v).toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function sourceType(e){
 if(String(e.sport_format||'').toLowerCase()==='basketball'||String(e.governing_body||'').toUpperCase()==='LBS')return 'basketball';
 if(String(e.governing_body||'').toUpperCase()==='LFF')return 'lff';
 const sources=(e.sources||[]).map(s=>String(s.source||'').toLowerCase());
 if(sources.includes('estlatbl.com')||sources.includes('basket.lv'))return 'basketball';
 if(sources.includes('lff.lv'))return 'lff';
 if(sources.includes('athletics.lv'))return 'athletics';
 return 'municipality';
}
function markerGlyph(type){return type==='lff'?'⚽':type==='basketball'?'🏀':type==='athletics'?'🏃':'📅';}
function markerTypeLabel(type){return type==='lff'?'Futbols':type==='basketball'?'Basketbols':type==='athletics'?'Vieglatlētika':'Pasākums';}
function sourceLabel(e){
 const type=sourceType(e);
 if(type==='lff')return e.competition_name?('LFF · '+e.competition_name):'LFF · Futbols';
 if(type==='basketball')return e.competition_name?('Basketbols · '+e.competition_name):'Basketbols';
 if(type==='athletics')return 'Athletics.lv · Vieglatlētika';
 return (e.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'MEETS';
}
function sourceLinksHtml(e){
 return (e.sources||[]).filter(s=>s?.url).map(s=>'<a class="popup-source-link" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Avots: '+esc(s.source||'avots')+' ↗</a>').join('');
}
function countryLabel(code){return ({LV:'Latvija',EE:'Igaunija',LT:'Lietuva'})[code]||'';}
function competitionMeta(e){return [e.competition_season,e.competition_group,e.competition_stage,e.age_group].filter(Boolean).join(' · ');}
function insideBalticView(lat,lon){return lat>=BALTIC_VIEW.south&&lat<=BALTIC_VIEW.north&&lon>=BALTIC_VIEW.west&&lon<=BALTIC_VIEW.east;}
function isSupportedMapEvent(e){
 const code=String(e.country_code||'').toUpperCase();
 if(['LV','EE','LT'].includes(code))return true;
 const municipality=String(e.municipality||'').trim();
 return municipality==='Ārpus Latvijas (Igaunija)'||municipality==='Vairākas pašvaldības'||municipality.endsWith(' novads')||municipality.endsWith(' valstspilsēta');
}
function locationKey(e){
 const lat=Number(e.latitude),lon=Number(e.longitude);
 const place=norm(e.venue_name||e.address_raw||e.settlement||e.municipality||'unknown');
 return place+'|'+lat.toFixed(5)+'|'+lon.toFixed(5);
}
function groupEvents(events){
 const groups=new Map();
 for(const e of events){
  const key=locationKey(e);
  const g=groups.get(key)||{key,lat:Number(e.latitude),lon:Number(e.longitude),label:e.venue_name||e.address_raw||e.settlement||e.municipality||'Norises vieta',events:[]};
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
 return types.length===1?types[0]:'municipality';
}
function groupPosition(group,indexByCoordinate){
 let lat=group.lat,lon=group.lon;
 const key=lat.toFixed(5)+','+lon.toFixed(5);
 const i=indexByCoordinate.get(key)||0;
 indexByCoordinate.set(key,i+1);
 if(i>0){
  const angle=(i*137.5)*Math.PI/180;
  lat+=Math.sin(angle)*0.0025;
  lon+=Math.cos(angle)*0.004;
 }
 return [lat,lon];
}
function popupHtml(group,activeIds){
 const sorted=closestFirst(group.events).sort((a,b)=>(activeIds.has(b.id)?1:0)-(activeIds.has(a.id)?1:0));
 const rows=sorted.map(e=>{
  const approximate=['settlement_center','municipality_center'].includes(e.location_precision);
  const meta=competitionMeta(e),country=countryLabel(e.country_code),active=activeIds.has(e.id);
  return '<li class="'+(active?'':'popup-event-muted')+'"><strong>'+esc(e.title)+'</strong><span>'+esc(dateLabel(e.date_from))+' · '+esc(timeLabel(e))+'</span><small>'+esc(sourceLabel(e))+(meta?' · '+esc(meta):'')+(country?' · '+esc(country):'')+(approximate?' · aptuvena lokācija':'')+'</small>'+sourceLinksHtml(e)+'</li>';
 }).join('');
 const activeCount=group.events.filter(e=>activeIds.has(e.id)).length;
 return '<div class="location-popup"><div class="location-popup-head"><strong>'+esc(group.label)+'</strong><span>'+activeCount+'/'+group.events.length+' atlasīti</span></div><ol>'+rows+'</ol></div>';
}
async function loadMapStack(){
 if(!document.querySelector('link[data-leaflet-css]')){
  const l=document.createElement('link');l.rel='stylesheet';l.href=LEAFLET_CSS;l.dataset.leafletCss='1';document.head.appendChild(l);
 }
 if(!document.querySelector('link[data-maplibre-css]')){
  const l=document.createElement('link');l.rel='stylesheet';l.href=MAPLIBRE_CSS;l.dataset.maplibreCss='1';document.head.appendChild(l);
 }
 const [leaflet,adapter]=await Promise.all([
  import('leaflet'),
  import('@maplibre/maplibre-gl-leaflet')
 ]);
 const L=leaflet.default||leaflet;
 window.L=L;
 return {L,maplibreGL:adapter.maplibreGL};
}
function distanceKm(aLat,aLon,bLat,bLon){
 const r=6371,toRad=v=>v*Math.PI/180;
 const dLat=toRad(bLat-aLat),dLon=toRad(bLon-aLon);
 const x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
 return 2*r*Math.asin(Math.sqrt(x));
}
function weekEndIso(iso){
 if(!iso)return '';
 const d=new Date(iso+'T12:00:00Z');
 const day=d.getUTCDay();
 d.setUTCDate(d.getUTCDate()+((7-day)%7));
 return d.toISOString().slice(0,10);
}

export default function OsmEventMap(){
 const [eventType,setEventType]=useState('');
 const [competition,setCompetition]=useState('');
 const [category,setCategory]=useState('');
 const [municipality,setMunicipality]=useState('');
 const [country,setCountry]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [radiusKm,setRadiusKm]=useState(30);
 const [userLocation,setUserLocation]=useState(null);
 const [locationQuery,setLocationQuery]=useState('');
 const [locationResults,setLocationResults]=useState([]);
 const [locationMessage,setLocationMessage]=useState('Nosakām atrašanās vietu…');
 const [locationSearching,setLocationSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const {data,loading,error,refresh}=useEvents();
 const mapEl=useRef(null),mapRef=useRef(null),backgroundLayerRef=useRef(null),activeLayerRef=useRef(null),focusLayerRef=useRef(null);
 const defaultsSetRef=useRef(false);

 const events=data?.events||[];
 const publicFrom=data?.window?.from||'';
 const publicTo=data?.window?.to||'';

 useEffect(()=>{
  if(defaultsSetRef.current||!publicFrom)return;
  defaultsSetRef.current=true;
  setFrom(publicFrom);
  const end=weekEndIso(publicFrom);
  setTo(end&&end<=publicTo?end:publicTo);
 },[publicFrom,publicTo]);

 useEffect(()=>{
  if(!navigator.geolocation){setLocationMessage('Pārlūks neatbalsta atrašanās vietas noteikšanu.');return;}
  navigator.geolocation.getCurrentPosition(
   pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    if(!insideBalticView(lat,lon)){setLocationMessage('Atrašanās vieta ir ārpus Baltijas kartes. Norādi vietu meklētājā.');return;}
    const next={lat,lon,label:'Mana atrašanās vieta',source:'browser'};
    setUserLocation(next);setLocationQuery('Mana atrašanās vieta');setLocationMessage('');
   },
   ()=>setLocationMessage('Atrašanās vieta nav pieejama. Norādi pilsētu vai vietu meklētājā.'),
   {enableHighAccuracy:true,timeout:8000,maximumAge:300000}
  );
 },[]);

 const typedEvents=useMemo(()=>eventType?events.filter(e=>sourceType(e)===eventType):events,[events,eventType]);
 const competitionOptions=useMemo(()=>{
  const counts=new Map();
  for(const e of typedEvents)if(e.competition_key&&e.competition_name)counts.set(e.competition_key,(counts.get(e.competition_key)||0)+1);
  const registry=Array.isArray(data?.competitions)?data.competitions:[];
  const relevantRegistry=registry.filter(c=>eventType==='basketball'?String(c.sport_format||'').toLowerCase()==='basketball':eventType==='lff'?String(c.governing_body||'').toUpperCase()==='LFF':false);
  const options=new Map();
  for(const c of relevantRegistry)if(c.competition_key&&c.name)options.set(c.competition_key,{key:c.competition_key,name:c.name,count:counts.get(c.competition_key)||0});
  for(const e of typedEvents)if(e.competition_key&&e.competition_name&&!options.has(e.competition_key))options.set(e.competition_key,{key:e.competition_key,name:e.competition_name,count:counts.get(e.competition_key)||0});
  return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name,'lv'));
 },[typedEvents,data?.competitions,eventType]);

 const scopedEvents=useMemo(()=>competition?typedEvents.filter(e=>e.competition_key===competition):typedEvents,[typedEvents,competition]);
 const categories=useMemo(()=>[...new Set(scopedEvents.flatMap(e=>[e.primary_category,...(e.tags||[])].filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'lv')),[scopedEvents]);
 const municipalities=useMemo(()=>[...new Set(scopedEvents.filter(e=>!country||e.country_code===country).map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[scopedEvents,country]);
 const countries=useMemo(()=>[...new Set(scopedEvents.map(e=>e.country_code).filter(Boolean))],[scopedEvents]);
 const sourceCounts=useMemo(()=>events.reduce((acc,e)=>{const type=sourceType(e);acc[type]=(acc[type]||0)+1;return acc;},{municipality:0,lff:0,athletics:0,basketball:0}),[events]);

 const locationChoices=useMemo(()=>{
  const map=new Map();
  for(const e of events){
   const lat=Number(e.latitude),lon=Number(e.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   const candidates=[
    [e.settlement,[e.settlement,countryLabel(e.country_code)].filter(Boolean).join(', ')],
    [e.municipality,[e.municipality,countryLabel(e.country_code)].filter(Boolean).join(', ')],
    [e.venue_name,[e.venue_name,e.settlement||e.municipality].filter(Boolean).join(', ')]
   ];
   for(const [raw,label] of candidates){
    if(!raw||!label)continue;
    const key=norm(label);
    if(!map.has(key))map.set(key,{id:'event:'+key,label,displayName:label,latitude:lat,longitude:lon,local:true});
   }
  }
  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'lv'));
 },[events]);

 const matchesEvent=useMemo(()=>e=>{
  if(eventType&&sourceType(e)!==eventType)return false;
  if(competition&&e.competition_key!==competition)return false;
  if(category&&e.primary_category!==category&&!e.tags?.includes(category))return false;
  if(municipality&&e.municipality!==municipality)return false;
  if(country&&e.country_code!==country)return false;
  if(from&&(e.date_to||e.date_from)<from)return false;
  if(to&&e.date_from>to)return false;
  if(userLocation&&radiusKm>0){
   const lat=Number(e.latitude),lon=Number(e.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
   if(distanceKm(userLocation.lat,userLocation.lon,lat,lon)>radiusKm)return false;
  }
  return true;
 },[eventType,competition,category,municipality,country,from,to,userLocation,radiusKm]);

 const activeEvents=useMemo(()=>events.filter(matchesEvent),[events,matchesEvent]);
 const activeIds=useMemo(()=>new Set(activeEvents.map(e=>e.id)),[activeEvents]);
 const mapEvents=useMemo(()=>events.filter(e=>Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude))&&isSupportedMapEvent(e)&&insideBalticView(Number(e.latitude),Number(e.longitude))),[events]);
 const locationGroups=useMemo(()=>groupEvents(mapEvents),[mapEvents]);
 const activeGroupCount=useMemo(()=>locationGroups.filter(g=>g.events.some(e=>activeIds.has(e.id))).length,[locationGroups,activeIds]);

 useEffect(()=>{
  let cancelled=false;
  loadMapStack().then(({L,maplibreGL})=>{
   if(cancelled||!mapEl.current||mapRef.current)return;
   const fixedBounds=L.latLngBounds([BALTIC_VIEW.south,BALTIC_VIEW.west],[BALTIC_VIEW.north,BALTIC_VIEW.east]);
   const map=L.map(mapEl.current,{maxBounds:fixedBounds,maxBoundsViscosity:1,minZoom:5}).fitBounds(fixedBounds,{padding:[20,20]});
   map.createPane('backgroundMarkers');map.getPane('backgroundMarkers').style.zIndex='410';
   map.createPane('activeMarkers');map.getPane('activeMarkers').style.zIndex='460';
   map.createPane('userLocation');map.getPane('userLocation').style.zIndex='520';
   maplibreGL({style:OPENFREEMAP_STYLE}).addTo(map);
   map.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © OpenMapTiles · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');
   mapRef.current=map;setMapReady(true);
  }).catch(error=>{console.error('map_stack_failed',error);});
  return()=>{cancelled=true;};
 },[]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=window.L,map=mapRef.current;
  backgroundLayerRef.current?.remove();activeLayerRef.current?.remove();
  const bg=L.layerGroup().addTo(map),active=L.layerGroup().addTo(map);
  backgroundLayerRef.current=bg;activeLayerRef.current=active;

  const indexByCoordinate=new Map();
  for(const group of locationGroups){
   const [displayLat,displayLon]=groupPosition(group,indexByCoordinate);
   const activeInGroup=group.events.filter(e=>activeIds.has(e.id));
   const isActive=activeInGroup.length>0;
   const chosenEvents=isActive?activeInGroup:group.events;
   const type=groupType(chosenEvents),glyph=markerGlyph(type),typeLabel=markerTypeLabel(type);
   const shownCount=isActive?activeInGroup.length:group.events.length;
   const grouped=shownCount>1;
   const dimmed=!isActive;
   const size=dimmed?(grouped?32:28):(grouped?44:38);
   let html;
   if(grouped){
    html='<span class="event-count-marker '+type+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+' · '+shownCount+' pasākumi"><span class="event-group-symbol" aria-hidden="true">'+glyph+'</span><strong>'+shownCount+'</strong></span>';
   }else{
    html='<span class="event-symbol-marker '+type+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+'"><span aria-hidden="true">'+glyph+'</span></span>';
   }
   const icon=L.divIcon({className:grouped?'event-count-marker-wrap':'event-symbol-marker-wrap',html,iconSize:[size,size],iconAnchor:[size/2,size/2]});
   const marker=L.marker([displayLat,displayLon],{icon,pane:isActive?'activeMarkers':'backgroundMarkers',keyboard:isActive,title:typeLabel});
   marker.bindPopup(popupHtml(group,activeIds),{maxWidth:390,maxHeight:360});
   marker.addTo(isActive?active:bg);
  }
 },[mapReady,locationGroups,activeIds]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=window.L,map=mapRef.current;
  focusLayerRef.current?.remove();
  const focus=L.layerGroup().addTo(map);focusLayerRef.current=focus;
  if(!userLocation)return;
  const center=[userLocation.lat,userLocation.lon];
  const icon=L.divIcon({className:'user-location-marker-wrap',html:'<span class="user-location-marker"><span></span></span>',iconSize:[24,24],iconAnchor:[12,12]});
  L.marker(center,{icon,pane:'userLocation',interactive:false}).addTo(focus);
  if(radiusKm>0){
   const circle=L.circle(center,{radius:radiusKm*1000,color:'#355f37',weight:2,dashArray:'6 5',fillColor:'#7fbf72',fillOpacity:.06,interactive:false}).addTo(focus);
   map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:13});
  }else{
   map.setView(center,11);
  }
 },[mapReady,userLocation,radiusKm]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;},[]);

 function changeEventType(value){
  setEventType(value);setCompetition('');setCategory('');setMunicipality('');setCountry('');
 }
 function resetFilters(){
  setEventType('');setCompetition('');setCategory('');setMunicipality('');setCountry('');setRadiusKm(30);
  if(publicFrom){setFrom(publicFrom);setTo(weekEndIso(publicFrom)<=publicTo?weekEndIso(publicFrom):publicTo);}
 }
 function useCurrentLocation(){
  setLocationMessage('Nosakām atrašanās vietu…');
  navigator.geolocation?.getCurrentPosition(
   pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    if(!insideBalticView(lat,lon)){setLocationMessage('Atrašanās vieta ir ārpus Baltijas kartes.');return;}
    setUserLocation({lat,lon,label:'Mana atrašanās vieta',source:'browser'});
    setLocationQuery('Mana atrašanās vieta');setLocationResults([]);setLocationMessage('');
   },
   ()=>setLocationMessage('Atrašanās vietu neizdevās noteikt.'),
   {enableHighAccuracy:true,timeout:8000,maximumAge:300000}
  );
 }
 function selectLocation(place){
  setUserLocation({lat:Number(place.latitude),lon:Number(place.longitude),label:place.displayName||place.label,source:place.local?'events':'search'});
  setLocationQuery(place.displayName||place.label);setLocationResults([]);setLocationMessage('');
 }
 async function searchLocation(){
  const q=locationQuery.trim();
  if(q.length<2){setLocationMessage('Ievadi vismaz 2 rakstzīmes.');return;}
  const local=locationChoices.filter(x=>norm(x.label).includes(norm(q))).slice(0,6);
  if(local.length===1&&norm(local[0].label)===norm(q)){selectLocation(local[0]);return;}
  setLocationSearching(true);setLocationMessage('');
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
   const data=await response.json();
   if(!response.ok)throw new Error(data?.error||'Meklēšana neizdevās.');
   const combined=[...local,...(Array.isArray(data.results)?data.results:[])];
   const unique=new Map();
   for(const item of combined){
    const key=Number(item.latitude).toFixed(4)+','+Number(item.longitude).toFixed(4)+'|'+norm(item.displayName||item.label);
    if(!unique.has(key))unique.set(key,item);
   }
   const results=[...unique.values()].slice(0,8);
   setLocationResults(results);
   if(!results.length)setLocationMessage('Vieta netika atrasta.');
  }catch(e){setLocationMessage(e?.message||'Vietu meklēšana neizdevās.');}
  finally{setLocationSearching(false);}
 }

 return <>
  <div className="map-shell">
   <div className="map-controls map-controls-overlay" aria-label="Kartes filtri">
    <div className="map-location-control">
     <span className="filter-caption">Atrašanās vieta</span>
     <div className="map-location-search">
      <input list="meets-location-options" value={locationQuery} onChange={e=>setLocationQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchLocation();}}} placeholder="Mana vieta vai meklēt…"/>
      <button type="button" className="map-icon-button" onClick={searchLocation} disabled={locationSearching} title="Meklēt vietu">{locationSearching?'…':'⌕'}</button>
      <button type="button" className="map-icon-button locate" onClick={useCurrentLocation} title="Izmantot manu atrašanās vietu">◎</button>
     </div>
     <datalist id="meets-location-options">{locationChoices.map(x=><option key={x.id} value={x.label}/>)}</datalist>
    </div>

    <label className="map-filter-radius"><span>Radiuss</span><select value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))}>
     {RADIUS_OPTIONS.map(v=><option key={v} value={v}>{v===0?'Visa karte':v+' km'}</option>)}
    </select></label>

    <label className="map-filter-date"><span>No</span><input aria-label="Datums no" type="date" min={publicFrom||undefined} max={publicTo||undefined} value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="map-filter-date"><span>Līdz</span><input aria-label="Datums līdz" type="date" min={publicFrom||undefined} max={publicTo||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>

    <label className="map-filter-type"><span>Tips</span><select value={eventType} onChange={e=>changeEventType(e.target.value)}>
     <option value="">Visi ({events.length})</option>
     <option value="municipality">Pašvaldības ({sourceCounts.municipality})</option>
     <option value="lff">LFF ({sourceCounts.lff})</option>
     <option value="athletics">Vieglatlētika ({sourceCounts.athletics})</option>
     <option value="basketball">Basketbols ({sourceCounts.basketball})</option>
    </select></label>

    {(eventType==='lff'||eventType==='basketball')&&<label className="map-filter-competition"><span>Turnīrs</span><select value={competition} onChange={e=>{setCompetition(e.target.value);setCategory('');setMunicipality('');}}>
     <option value="">{eventType==='lff'?'Visi LFF turnīri':'Visi basketbola turnīri'}</option>
     {competitionOptions.map(v=><option key={v.key} value={v.key}>{v.name} ({v.count})</option>)}
    </select></label>}

    <label className="map-filter-category"><span>Kategorija</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Visas</option>{categories.map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="map-filter-country"><span>Valsts</span><select value={country} onChange={e=>{setCountry(e.target.value);setMunicipality('');}}><option value="">Visas</option>{countries.map(code=><option key={code} value={code}>{countryLabel(code)}</option>)}</select></label>
    <label className="map-filter-municipality"><span>Pašvaldība</span><select value={municipality} onChange={e=>setMunicipality(e.target.value)}><option value="">Visas</option>{municipalities.map(v=><option key={v}>{v}</option>)}</select></label>
    <button className="map-clear-button" type="button" onClick={resetFilters}>Atiestatīt</button>
   </div>

   {locationResults.length>0&&<div className="map-location-results" role="listbox" aria-label="Atrastas vietas">
    {locationResults.map(place=><button key={place.id||place.displayName} type="button" onClick={()=>selectLocation(place)}>
     <strong>{place.label||place.displayName}</strong><span>{place.displayName||place.label}</span>
    </button>)}
   </div>}
   {locationMessage&&<div className="map-location-message">{locationMessage}</div>}

   <div ref={mapEl} className="osm-map" aria-label="Pasākumu karte"/>

   <div className="map-legend map-legend-overlay" aria-label="Kartes leģenda">
    <span><i className="legend-symbol municipality" aria-hidden="true">📅</i>Pašvaldības</span>
    <span><i className="legend-symbol lff" aria-hidden="true">⚽</i>Futbols</span>
    <span><i className="legend-symbol athletics" aria-hidden="true">🏃</i>Vieglatlētika</span>
    <span><i className="legend-symbol basketball" aria-hidden="true">🏀</i>Basketbols</span>
    <span className="legend-muted-example"><i>⚽</i>ārpus filtra</span>
   </div>
  </div>

  <div className="map-summary">
   <strong>{activeEvents.length}</strong> atlasīti pasākumi · <strong>{activeGroupCount}</strong> vietas
   {userLocation&&radiusKm>0?' · '+radiusKm+' km no '+userLocation.label:''}
   {from&&to?' · '+from+'–'+to:''}
   <button className="text-button" onClick={refresh}>{loading?'Ielādē…':'Pārlasīt'}</button>
  </div>
  {error&&<div className="error-message">{error}</div>}
 </>;
}

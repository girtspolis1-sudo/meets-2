'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel} from '../../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,groupDateTone,hasEventEnded} from '../../lib/event-date.js';

const MAP_STYLES={
 positron:{label:'Positron',url:'https://tiles.openfreemap.org/styles/positron'},
 liberty:{label:'Liberty',url:'https://tiles.openfreemap.org/styles/liberty'},
 bright:{label:'Bright',url:'https://tiles.openfreemap.org/styles/bright'},
 dark:{label:'Dark',url:'https://tiles.openfreemap.org/styles/dark'},
 fiord:{label:'Fiord',url:'https://tiles.openfreemap.org/styles/fiord'}
};
const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};
const DEFAULT_LOCATION={lat:56.9053,lon:24.0556,label:'Mārupes dome',source:'fallback'};
const RADIUS_OPTIONS=[5,10,25,50,0];

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
function popupHtml(group,activeIds,isAdminSession){
 const sorted=closestFirst(group.events).sort((a,b)=>(activeIds.has(b.id)?1:0)-(activeIds.has(a.id)?1:0));
 const rows=sorted.map(e=>{
  const approximate=['settlement_center','municipality_center'].includes(e.location_precision);
  const meta=competitionMeta(e),country=countryLabel(e.country_code),active=activeIds.has(e.id);
  const dateState=eventDateState(e);
  const rangeLabel=eventDateRangeLabel(e,dateLabel);
  const editLink=isAdminSession&&active?'<a class="admin-popup-edit" href="/admin?edit='+encodeURIComponent(e.id)+'">Labot</a>':'';
  return '<li class="'+(active?'':'popup-event-muted')+'"><strong>'+esc(e.title)+'</strong><span class="popup-date-row"><span class="event-date-indicator '+esc(dateState.tone)+'" aria-hidden="true">●</span><span class="event-date-badge '+esc(dateState.tone)+'" title="'+esc(dateState.label)+'">'+esc(dateState.badge)+'</span><span>'+esc(rangeLabel)+' · '+esc(timeLabel(e))+'</span></span><small>'+esc(sourceLabel(e))+(meta?' · '+esc(meta):'')+(country?' · '+esc(country):'')+(approximate?' · aptuvena lokācija':'')+'</small>'+sourceLinksHtml(e)+editLink+'</li>';
 }).join('');
 const activeCount=group.events.filter(e=>activeIds.has(e.id)).length;
 return '<div class="location-popup"><div class="location-popup-head"><strong>'+esc(group.label)+'</strong><span>'+activeCount+'/'+group.events.length+' atlasīti</span></div><ol>'+rows+'</ol></div>';
}
async function loadMapStack(){
 const leafletModule=await import('leaflet');
 const L=leafletModule.default||leafletModule;
 await import('@maplibre/maplibre-gl-leaflet');
 if(!L?.maplibreGL)throw new Error('MapLibre Leaflet adapter failed to load');
 return {L,maplibreGL:L.maplibreGL};
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
function addDaysIso(iso,days){
 if(!iso)return '';
 const d=new Date(iso+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
function monthEndIso(iso){
 if(!iso)return '';
 const d=new Date(iso+'T12:00:00Z');
 return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).toISOString().slice(0,10);
}
function minIso(a,b){return !a?b:!b?a:(a<b?a:b);}
function periodDates(mode,today,windowTo,currentFrom,currentTo){
 if(!today)return {from:currentFrom,to:currentTo};
 if(mode==='3days')return {from:today,to:minIso(addDaysIso(today,2),windowTo)};
 if(mode==='month')return {from:today,to:minIso(monthEndIso(today),windowTo)};
 if(mode==='week')return {from:today,to:minIso(weekEndIso(today),windowTo)};
 return {
  from:currentFrom&&currentFrom>=today?currentFrom:today,
  to:currentTo&&currentTo>=today&&(!windowTo||currentTo<=windowTo)?currentTo:minIso(weekEndIso(today),windowTo)
 };
}

export default function OsmEventMap(){
 const [eventType,setEventType]=useState('');
 const [competition,setCompetition]=useState('');
 const [category,setCategory]=useState('');
 const [municipality,setMunicipality]=useState('');
 const [country,setCountry]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [radiusKm,setRadiusKm]=useState(50);
 const [periodMode,setPeriodMode]=useState('week');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [mapStyle,setMapStyle]=useState('positron');
 const [userLocation,setUserLocation]=useState(DEFAULT_LOCATION);
 const [locationQuery,setLocationQuery]=useState(DEFAULT_LOCATION.label);
 const [locationResults,setLocationResults]=useState([]);
 const [locationMessage,setLocationMessage]=useState('');
 const [locationSearching,setLocationSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [isAdminSession,setIsAdminSession]=useState(false);
 const {data,loading,error,refresh}=useEvents();
 const mapEl=useRef(null),mapRef=useRef(null),leafletRef=useRef(null),baseMapLayerRef=useRef(null),backgroundLayerRef=useRef(null),activeLayerRef=useRef(null),focusLayerRef=useRef(null);
 const defaultsSetRef=useRef(false);

 const publicFrom=data?.window?.from||'';
 const publicTo=data?.window?.to||'';
 const events=useMemo(()=>((data?.events)||[]).filter(event=>!hasEventEnded(event)),[data]);

 useEffect(()=>{
  const syncAdminSession=()=>setIsAdminSession(Boolean(sessionStorage.getItem('meets_admin_access_token')));
  syncAdminSession();
  window.addEventListener('storage',syncAdminSession);
  window.addEventListener('meets-admin-session-change',syncAdminSession);
  return()=>{
   window.removeEventListener('storage',syncAdminSession);
   window.removeEventListener('meets-admin-session-change',syncAdminSession);
  };
 },[]);

 useEffect(()=>{
  if(defaultsSetRef.current||!publicFrom)return;
  defaultsSetRef.current=true;
  const next=periodDates('week',publicFrom,publicTo,'','');
  setFrom(next.from);setTo(next.to);
 },[publicFrom,publicTo]);

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
   if(map.getPane('popupPane'))map.getPane('popupPane').style.zIndex='920';
   baseMapLayerRef.current=maplibreGL({style:MAP_STYLES.positron.url}).addTo(map);
   map.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © OpenMapTiles · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');
   leafletRef.current=L;mapRef.current=map;setMapReady(true);
  }).catch(error=>{console.error('map_stack_failed',error);});
  return()=>{cancelled=true;};
 },[]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current||!leafletRef.current?.maplibreGL)return;
  const L=leafletRef.current;
  const style=MAP_STYLES[mapStyle]||MAP_STYLES.positron;
  if(baseMapLayerRef.current){
   try{baseMapLayerRef.current.remove();}catch{}
  }
  baseMapLayerRef.current=L.maplibreGL({style:style.url}).addTo(mapRef.current);
 },[mapReady,mapStyle]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=leafletRef.current,map=mapRef.current;
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
   const dateTone=groupDateTone(chosenEvents);
   const dateClass=dateTone?' date-'+dateTone:'';
   const shownCount=isActive?activeInGroup.length:group.events.length;
   const grouped=shownCount>1;
   const dimmed=!isActive;
   const size=dimmed?(grouped?32:28):(grouped?44:38);
   let html;
   if(grouped){
    html='<span class="event-count-marker '+type+dateClass+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+' · '+shownCount+' pasākumi"><span class="event-group-symbol" aria-hidden="true">'+glyph+'</span><strong>'+shownCount+'</strong></span>';
   }else{
    html='<span class="event-symbol-marker '+type+dateClass+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+'"><span aria-hidden="true">'+glyph+'</span></span>';
   }
   const icon=L.divIcon({className:grouped?'event-count-marker-wrap':'event-symbol-marker-wrap',html,iconSize:[size,size],iconAnchor:[size/2,size/2]});
   const marker=L.marker([displayLat,displayLon],{icon,pane:isActive?'activeMarkers':'backgroundMarkers',keyboard:isActive,title:typeLabel});
   const popupMaxHeight=Math.max(260,Math.min(560,map.getSize().y-150));
   marker.bindPopup(popupHtml(group,activeIds,isAdminSession),{
    maxWidth:430,
    maxHeight:popupMaxHeight,
    autoPan:true,
    keepInView:true,
    autoPanPaddingTopLeft:[28,118],
    autoPanPaddingBottomRight:[28,32]
   });
   marker.on('click',()=>{
    setFiltersOpen(false);
    setLocationResults([]);
    setLocationMessage('');
   });
   marker.on('popupopen',()=>{
    window.setTimeout(()=>{
     const popup=marker.getPopup();
     if(!popup?.isOpen?.())return;
     popup.update();
    },0);
   });
   marker.addTo(isActive?active:bg);
  }
 },[mapReady,locationGroups,activeIds,isAdminSession]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=leafletRef.current,map=mapRef.current;
  focusLayerRef.current?.remove();
  const focus=L.layerGroup().addTo(map);focusLayerRef.current=focus;
  if(!userLocation)return;
  const center=[userLocation.lat,userLocation.lon];
  const icon=L.divIcon({className:'user-location-marker-wrap',html:'<span class="user-location-marker"><span></span></span>',iconSize:[24,24],iconAnchor:[12,12]});
  L.marker(center,{icon,pane:'userLocation',interactive:false}).addTo(focus);
  if(radiusKm>0){
   const circle=L.circle(center,{radius:radiusKm*1000,color:'#7f00ff',weight:1.25,opacity:.88,fillColor:'#b56cff',fillOpacity:.025,interactive:false}).addTo(focus);
   map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:13});
  }else{
   map.setView(center,11);
  }
 },[mapReady,userLocation,radiusKm]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;},[]);

 const advancedFilterCount=[eventType,competition,category,country,municipality,mapStyle!=='positron'?'map-style':''].filter(Boolean).length;

 function changeEventType(value){
  setEventType(value);setCompetition('');setCategory('');setMunicipality('');setCountry('');
 }
 function changePeriod(value){
  setPeriodMode(value);
  if(value==='manual')return;
  const next=periodDates(value,publicFrom,publicTo,from,to);
  setFrom(next.from);setTo(next.to);
 }
 function resetFilters(){
  setEventType('');setCompetition('');setCategory('');setMunicipality('');setCountry('');setRadiusKm(50);setMapStyle('positron');setPeriodMode('week');
  if(publicFrom){const next=periodDates('week',publicFrom,publicTo,'','');setFrom(next.from);setTo(next.to);}
 }
 function useCurrentLocation(){
  if(!navigator.geolocation){setLocationMessage('Pārlūks neatbalsta atrašanās vietas noteikšanu.');return;}
  setLocationMessage('Nosakām atrašanās vietu…');
  navigator.geolocation.getCurrentPosition(
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
  setFiltersOpen(false);
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
    <div className="map-primary-controls">
     <button type="button" className="map-control-button locate-primary" onClick={useCurrentLocation} title="Mana atrašanās vieta" aria-label="Izmantot manu atrašanās vietu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
     </button>

     <div className="map-location-control">
      <input
       list="meets-location-options"
       value={locationQuery}
       onFocus={()=>setFiltersOpen(false)}
       onChange={e=>setLocationQuery(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchLocation();}}}
       placeholder="Meklēt vietu…"
       aria-label="Meklēt atrašanās vietu"
      />
      <button type="button" className="map-search-button" onClick={searchLocation} disabled={locationSearching} title="Meklēt vietu" aria-label="Meklēt vietu">
       {locationSearching?'…':<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>}
      </button>
      <datalist id="meets-location-options">{locationChoices.map(x=><option key={x.id} value={x.label}/>)}</datalist>
     </div>

     <select className="map-compact-select radius-select" value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))} aria-label="Meklēšanas radiuss" title="Radiuss">
      {RADIUS_OPTIONS.map(v=><option key={v} value={v}>{v===0?'Visa karte':v+' km'}</option>)}
     </select>

     <select className="map-compact-select period-select" value={periodMode} onChange={e=>changePeriod(e.target.value)} aria-label="Laika periods" title="Laika periods">
      <option value="3days">3 dienas</option>
      <option value="week">Šonedēļ</option>
      <option value="month">Šomēnes</option>
      <option value="manual">Manuāli</option>
     </select>

     <button type="button" className={'map-control-button filters-button'+(filtersOpen?' active':'')} onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen} aria-label="Paplašinātie filtri" title="Paplašinātie filtri">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>
      {advancedFilterCount>0&&<span className="filter-count">{advancedFilterCount}</span>}
     </button>
    </div>

    {periodMode==='manual'&&<div className="map-manual-period">
     <input aria-label="Datums no" title="Datums no" type="date" min={publicFrom||undefined} max={to||publicTo||undefined} value={from} onChange={e=>{const value=e.target.value;setFrom(value);if(to&&value>to)setTo(value);}}/>
     <span aria-hidden="true">–</span>
     <input aria-label="Datums līdz" title="Datums līdz" type="date" min={from||publicFrom||undefined} max={publicTo||undefined} value={to} onChange={e=>setTo(e.target.value)}/>
    </div>}

    {filtersOpen&&<div className="map-advanced-panel">
     <select value={eventType} onChange={e=>changeEventType(e.target.value)} aria-label="Pasākuma tips" title="Tips">
      <option value="">Visi tipi ({events.length})</option>
      <option value="municipality">Pašvaldības ({sourceCounts.municipality})</option>
      <option value="lff">LFF ({sourceCounts.lff})</option>
      <option value="athletics">Vieglatlētika ({sourceCounts.athletics})</option>
      <option value="basketball">Basketbols ({sourceCounts.basketball})</option>
     </select>

     {(eventType==='lff'||eventType==='basketball')&&<select value={competition} onChange={e=>{setCompetition(e.target.value);setCategory('');setMunicipality('');}} aria-label="Turnīrs" title="Turnīrs">
      <option value="">{eventType==='lff'?'Visi LFF turnīri':'Visi basketbola turnīri'}</option>
      {competitionOptions.map(v=><option key={v.key} value={v.key}>{v.name} ({v.count})</option>)}
     </select>}

     <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Kategorija" title="Kategorija">
      <option value="">Visas kategorijas</option>{categories.map(v=><option key={v}>{v}</option>)}
     </select>

     <select value={country} onChange={e=>{setCountry(e.target.value);setMunicipality('');}} aria-label="Valsts" title="Valsts">
      <option value="">Visas valstis</option>{countries.map(code=><option key={code} value={code}>{countryLabel(code)}</option>)}
     </select>

     <select value={municipality} onChange={e=>setMunicipality(e.target.value)} aria-label="Pašvaldība" title="Pašvaldība">
      <option value="">Visas pašvaldības</option>{municipalities.map(v=><option key={v}>{v}</option>)}
     </select>

     <select value={mapStyle} onChange={e=>setMapStyle(e.target.value)} aria-label="Kartes stils" title="Kartes stils">
      {Object.entries(MAP_STYLES).map(([key,style])=><option key={key} value={key}>{style.label}</option>)}
     </select>

     <button className="map-reset-icon" type="button" onClick={resetFilters} aria-label="Atiestatīt filtrus" title="Atiestatīt filtrus">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1-8.5L4 10"/></svg>
     </button>
    </div>}
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

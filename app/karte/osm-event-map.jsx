'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel,display} from '../../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,groupDateTone,hasEventEnded,rigaTodayIso} from '../../lib/event-date.js';
import {addRasterLayer,enableMapLibre,hasWebGL,loadLeaflet,removeLayerSafe,requestedMapMode} from '../../lib/leaflet-runtime.js';

const MAP_STYLES={
 positron:{label:'Positron',url:'https://tiles.openfreemap.org/styles/positron'},
 liberty:{label:'Liberty',url:'https://tiles.openfreemap.org/styles/liberty'},
 bright:{label:'Bright',url:'https://tiles.openfreemap.org/styles/bright'},
 dark:{label:'Dark',url:'https://tiles.openfreemap.org/styles/dark'},
 fiord:{label:'Fiord',url:'https://tiles.openfreemap.org/styles/fiord'}
};
const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};
const DEFAULT_LOCATION={lat:56.9053,lon:24.0556,label:'Mārupes dome',source:'fallback'};
const RADIUS_OPTIONS=[5,10,25,30,50,0];

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
function eventGlyph(e){
 const type=sourceType(e);
 if(type!=='municipality')return markerGlyph(type);
 const generic=String(e?.event_type||'');
 return ({
  concert:'♫',cinema:'🎬',performance:'🎭',exhibition:'◆',market:'●',
  workshop:'✦',education:'✎',health:'✚',community:'★',government:'◆'
 })[generic]||'●';
}
function markerTimeText(e,now){
 const state=eventDateState(e,rigaTodayIso(now),now);
 if(state.tone==='today'||state.tone==='ended-today')return 'ŠODIEN';
 if(state.tone==='tomorrow')return 'RĪT';
 if(Number.isFinite(state.days)&&state.days>1)return state.days+' d.';
 return state.badge||'—';
}
function markerTypeLabel(type){return type==='lff'?'Futbols':type==='basketball'?'Basketbols':type==='athletics'?'Vieglatlētika':'Pasākums';}
function sourceLabel(e){
 const type=sourceType(e);
 if(type==='lff')return e.competition_name?('LFF · '+e.competition_name):'LFF · Futbols';
 if(type==='basketball')return e.competition_name?('Basketbols · '+e.competition_name):'Basketbols';
 if(type==='athletics')return 'Athletics.lv · Vieglatlētika';
 return (e.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'MEETS';
}
function sourceLinksHtml(e){
 const links=(e.sources||[]).filter(s=>s?.url);
 if(!links.length)return '';
 const first=links[0];
 return '<a class="popup-source-link" href="'+esc(first.url)+'" target="_blank" rel="noopener noreferrer">Vairāk oficiālajā lapā ↗</a>';
}
function shortDescription(value,limit=15){
 const text=String(value||'').trim();
 if(!text)return '';
 return text.length>limit?text.slice(0,limit).trimEnd()+'…':text;
}
function countryLabel(code){return ({LV:'Latvija',EE:'Igaunija',LT:'Lietuva'})[code]||'';}
function competitionMeta(e){return [e.competition_season,e.competition_group,e.competition_stage,e.age_group].filter(Boolean).join(' · ');}
function popupEventType(e){
 const key=String(e.competition_key||'').toLowerCase();
 if(key.startsWith('ljbl:'))return 'LJBL';
 if(e.competition_name)return String(e.competition_name);
 const generic=display(e,'event_type');
 return generic&&generic!=='Sporta spēle'?generic:(generic||'');
}
function popupDayLabel(state){
 if(state.tone==='today'||state.tone==='ended-today')return 'ŠODIEN';
 if(state.tone==='tomorrow')return 'RĪT';
 if(Number.isFinite(state.days)&&state.days>1)return state.days+' DIENAS';
 return state.badge||'—';
}
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
function popupHtml(group,activeIds,isAdminSession,now){
 const sorted=closestFirst(group.events);
 const renderRow=(e,active)=>{
  const approximate=['settlement_center','municipality_center'].includes(e.location_precision);
  const meta=competitionMeta(e),country=countryLabel(e.country_code);
  const dateState=eventDateState(e,rigaTodayIso(now),now);
  const rangeLabel=eventDateRangeLabel(e,dateLabel);
  const editLink=isAdminSession&&active?'<a class="admin-popup-edit" href="/admin?edit='+encodeURIComponent(e.id)+'">Labot</a>':'';
  const rowClass=[active?'popup-event-active':'popup-event-muted',dateState.tone==='ended-today'?'popup-event-ended':''].filter(Boolean).join(' ');
  const eventType=popupEventType(e);
  const compactMeta=sourceType(e)==='basketball'
   ? [eventType,e.competition_group,e.age_group].filter(Boolean).join(' · ')
   : [eventType||sourceLabel(e),meta].filter(Boolean).join(' · ');
  return '<li class="'+rowClass+'">'+
   '<div class="popup-event-main">'+
    '<span class="event-date-badge event-date-badge-prominent '+esc(dateState.tone)+'" title="'+esc(dateState.label)+'">'+esc(popupDayLabel(dateState))+'</span>'+
    '<div class="popup-event-copy">'+
     '<strong>'+esc(e.title)+(eventType?' <span class="popup-event-type">('+esc(eventType)+')</span>':'')+'</strong>'+
     '<span class="popup-event-datetime">'+esc(rangeLabel)+' · '+esc(timeLabel(e))+'</span>'+
     (compactMeta?'<small>'+esc(compactMeta)+(country?' · '+esc(country):'')+(approximate?' · aptuvena lokācija':'')+'</small>':'')+
     (e.description?'<p class="popup-event-description">'+esc(shortDescription(e.description,15))+'</p>':'')+
     sourceLinksHtml(e)+editLink+
    '</div>'+
   '</div>'+
  '</li>';
 };
 const activeEvents=sorted.filter(e=>activeIds.has(e.id));
 const otherEvents=sorted.filter(e=>!activeIds.has(e.id));
 const activeRows=activeEvents.map(e=>renderRow(e,true)).join('');
 const otherRows=otherEvents.map(e=>renderRow(e,false)).join('');
 const activeCount=activeEvents.length;
 const activeSection=activeRows
  ? '<div class="popup-section-title active">ATBILST FILTRAM · '+activeCount+'</div><ol class="popup-active-list">'+activeRows+'</ol>'
  : '';
 const otherSection=otherRows
  ? '<div class="popup-section-title">CITI PASĀKUMI ŠAJĀ VIETĀ · '+otherEvents.length+'</div><ol class="popup-other-list">'+otherRows+'</ol>'
  : '';
 return '<div class="location-popup"><div class="location-popup-head"><strong>'+esc(group.label)+'</strong><span>'+activeCount+'/'+group.events.length+' atlasīti</span></div>'+activeSection+otherSection+'</div>';
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
 if(mode==='today')return {from:today,to:today};
 if(mode==='3days')return {from:today,to:minIso(addDaysIso(today,2),windowTo)};
 if(mode==='month')return {from:today,to:minIso(monthEndIso(today),windowTo)};
 if(mode==='week')return {from:today,to:minIso(weekEndIso(today),windowTo)};
 return {
  from:currentFrom&&currentFrom>=today?currentFrom:today,
  to:currentTo&&currentTo>=today&&(!windowTo||currentTo<=windowTo)?currentTo:minIso(weekEndIso(today),windowTo)
 };
}

export default function OsmEventMap(){
 const [eventTypes,setEventTypes]=useState([]);
 const [competition,setCompetition]=useState('');
 const [category,setCategory]=useState('');
 const [eventSearch,setEventSearch]=useState('');
 const [price,setPrice]=useState('');
 const [municipality,setMunicipality]=useState('');
 const [country,setCountry]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [radiusKm,setRadiusKm]=useState(30);
 const [periodMode,setPeriodMode]=useState('week');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [mapStyle,setMapStyle]=useState('positron');
 const [userLocation,setUserLocation]=useState(DEFAULT_LOCATION);
 const [locationQuery,setLocationQuery]=useState(DEFAULT_LOCATION.label);
 const [locationResults,setLocationResults]=useState([]);
 const [locationMessage,setLocationMessage]=useState('');
 const [locationSearching,setLocationSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [mapMode,setMapMode]=useState('loading');
 const [mapError,setMapError]=useState('');
 const [mapRetry,setMapRetry]=useState(0);
 const [isAdminSession,setIsAdminSession]=useState(false);
 const [clockNow,setClockNow]=useState(()=>new Date());
 const {data,loading,error,refresh}=useEvents();
 const mapEl=useRef(null),mapRef=useRef(null),leafletRef=useRef(null),baseMapLayerRef=useRef(null),baseLayerCleanupRef=useRef(null),backgroundLayerRef=useRef(null),activeLayerRef=useRef(null),focusLayerRef=useRef(null);
 const defaultsSetRef=useRef(false);

 const publicFrom=data?.window?.from||'';
 const publicTo=data?.window?.to||'';
 const events=useMemo(()=>((data?.events)||[]).filter(event=>!hasEventEnded(event)),[data]);

 useEffect(()=>{
  let cancelled=false;
  const syncAdminSession=async()=>{
   const token=sessionStorage.getItem('meets_admin_access_token')||'';
   if(!token){if(!cancelled)setIsAdminSession(false);return;}
   try{
    const response=await fetch('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const data=await response.json();
    if(cancelled)return;
    if(data?.valid===true)setIsAdminSession(true);
    else{
     sessionStorage.removeItem('meets_admin_access_token');
     setIsAdminSession(false);
    }
   }catch{
    if(!cancelled)setIsAdminSession(false);
   }
  };
  syncAdminSession();
  window.addEventListener('storage',syncAdminSession);
  window.addEventListener('meets-admin-session-change',syncAdminSession);
  return()=>{
   cancelled=true;
   window.removeEventListener('storage',syncAdminSession);
   window.removeEventListener('meets-admin-session-change',syncAdminSession);
  };
 },[]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setClockNow(new Date()),30000);
  return()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{
  if(defaultsSetRef.current||!publicFrom)return;
  defaultsSetRef.current=true;
  const next=periodDates('week',publicFrom,publicTo,'','');
  setFrom(next.from);setTo(next.to);
 },[publicFrom,publicTo]);

 const typedEvents=useMemo(()=>eventTypes.length?events.filter(e=>eventTypes.includes(sourceType(e))):events,[events,eventTypes]);
 const competitionOptions=useMemo(()=>{
  const counts=new Map();
  for(const e of typedEvents)if(e.competition_key&&e.competition_name)counts.set(e.competition_key,(counts.get(e.competition_key)||0)+1);
  const registry=Array.isArray(data?.competitions)?data.competitions:[];
  const singleType=eventTypes.length===1?eventTypes[0]:'';
  const relevantRegistry=registry.filter(c=>singleType==='basketball'?String(c.sport_format||'').toLowerCase()==='basketball':singleType==='lff'?String(c.governing_body||'').toUpperCase()==='LFF':false);
  const options=new Map();
  for(const c of relevantRegistry)if(c.competition_key&&c.name)options.set(c.competition_key,{key:c.competition_key,name:c.name,count:counts.get(c.competition_key)||0});
  for(const e of typedEvents)if(e.competition_key&&e.competition_name&&!options.has(e.competition_key))options.set(e.competition_key,{key:e.competition_key,name:e.competition_name,count:counts.get(e.competition_key)||0});
  return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name,'lv'));
 },[typedEvents,data?.competitions,eventTypes]);

 const scopedEvents=useMemo(()=>competition?typedEvents.filter(e=>e.competition_key===competition):typedEvents,[typedEvents,competition]);
 const categories=useMemo(()=>[...new Set(scopedEvents.map(e=>e.primary_category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[scopedEvents]);
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
  if(eventTypes.length&&!eventTypes.includes(sourceType(e)))return false;
  if(competition&&e.competition_key!==competition)return false;
  if(category&&e.primary_category!==category)return false;
  if(eventSearch&& !norm(e.title).includes(norm(eventSearch)))return false;
  if(price&&e.price_status!==price)return false;
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
 },[eventTypes,competition,category,eventSearch,price,municipality,country,from,to,userLocation,radiusKm]);

 const activeEvents=useMemo(()=>events.filter(matchesEvent),[events,matchesEvent]);
 const activeIds=useMemo(()=>new Set(activeEvents.map(e=>e.id)),[activeEvents]);
 const mapEvents=useMemo(()=>events.filter(e=>Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude))&&isSupportedMapEvent(e)&&insideBalticView(Number(e.latitude),Number(e.longitude))),[events]);
 const locationGroups=useMemo(()=>groupEvents(mapEvents),[mapEvents]);
 const activeGroupCount=useMemo(()=>locationGroups.filter(g=>g.events.some(e=>activeIds.has(e.id))).length,[locationGroups,activeIds]);

 useEffect(()=>{
  let cancelled=false;
  let rasterCleanup=null;

  async function init(){
   setMapReady(false);
   setMapMode('loading');
   setMapError('');

   removeLayerSafe(baseMapLayerRef.current);
   baseMapLayerRef.current=null;
   baseLayerCleanupRef.current?.();
   baseLayerCleanupRef.current=null;
   backgroundLayerRef.current?.remove();backgroundLayerRef.current=null;
   activeLayerRef.current?.remove();activeLayerRef.current=null;
   focusLayerRef.current?.remove();focusLayerRef.current=null;
   if(mapRef.current){
    try{mapRef.current.remove();}catch{}
    mapRef.current=null;
   }

   try{
    const L=await loadLeaflet();
    if(cancelled||!mapEl.current)return;

    const fixedBounds=L.latLngBounds([BALTIC_VIEW.south,BALTIC_VIEW.west],[BALTIC_VIEW.north,BALTIC_VIEW.east]);
    const map=L.map(mapEl.current,{maxBounds:fixedBounds,maxBoundsViscosity:1,minZoom:5}).fitBounds(fixedBounds,{padding:[20,20]});
    map.createPane('centerPane');map.getPane('centerPane').style.zIndex='390';
    map.createPane('backgroundMarkers');map.getPane('backgroundMarkers').style.zIndex='450';
    map.createPane('activeMarkers');map.getPane('activeMarkers').style.zIndex='490';
    if(map.getPane('popupPane'))map.getPane('popupPane').style.zIndex='920';
    leafletRef.current=L;
    mapRef.current=map;

    const requested=requestedMapMode();
    let vectorError=null;

    if(requested!=='raster'&&requested!=='fail'&&hasWebGL()){
     try{
      const maplibreGL=await enableMapLibre(L);
      if(cancelled)return;
      const style=MAP_STYLES[mapStyle]||MAP_STYLES.positron;
      baseMapLayerRef.current=maplibreGL({style:style.url}).addTo(map);
      map.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © OpenMapTiles · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');
      setMapMode('vector');
      setMapReady(true);
      return;
     }catch(error){
      vectorError=error;
      console.warn('map_vector_failed_using_raster',error);
      removeLayerSafe(baseMapLayerRef.current);
      baseMapLayerRef.current=null;
     }
    }else if(requested!=='raster'){
     vectorError=new Error(requested==='fail'?'Forced map failure':'WebGL is unavailable');
    }

    if(requested==='fail'){
     throw vectorError;
    }

    try{
     const raster=addRasterLayer(L,map,{
      onReady:()=>{
       if(cancelled)return;
       setMapMode('raster');
       setMapReady(true);
       setMapError('');
      },
      onFailure:error=>{
       if(cancelled)return;
       setMapMode('failed');
       setMapReady(false);
       setMapError('Karti neizdevās ielādēt. Pasākumu dati joprojām ir pieejami sarakstā.');
       console.error('map_raster_failed',error);
      }
     });
     baseMapLayerRef.current=raster.layer;
     rasterCleanup=raster.cleanup;
     baseLayerCleanupRef.current=raster.cleanup;
     setMapMode('raster');
     setMapReady(true);
    }catch(error){
     console.error('map_fallback_failed',error);
     throw error;
    }
   }catch(error){
    if(cancelled)return;
    console.error('map_stack_failed',error);
    setMapMode('failed');
    setMapReady(false);
    setMapError('Karti neizdevās ielādēt. Vari mēģināt vēlreiz vai atvērt pasākumu sarakstu.');
   }
  }

  init();

  return()=>{
   cancelled=true;
   rasterCleanup?.();
   baseLayerCleanupRef.current?.();
   baseLayerCleanupRef.current=null;
   removeLayerSafe(baseMapLayerRef.current);
   baseMapLayerRef.current=null;
   backgroundLayerRef.current?.remove();backgroundLayerRef.current=null;
   activeLayerRef.current?.remove();activeLayerRef.current=null;
   focusLayerRef.current?.remove();focusLayerRef.current=null;
   if(mapRef.current){
    try{mapRef.current.remove();}catch{}
    mapRef.current=null;
   }
   leafletRef.current=null;
  };
 },[mapRetry]);

 useEffect(()=>{
  if(!mapReady||mapMode!=='vector'||!mapRef.current||!leafletRef.current?.maplibreGL)return;
  const L=leafletRef.current;
  const style=MAP_STYLES[mapStyle]||MAP_STYLES.positron;
  removeLayerSafe(baseMapLayerRef.current);
  try{
   baseMapLayerRef.current=L.maplibreGL({style:style.url}).addTo(mapRef.current);
  }catch(error){
   console.warn('map_style_failed_switching_to_raster',error);
   setMapRetry(value=>value+1);
  }
 },[mapReady,mapMode,mapStyle]);

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
   const type=groupType(chosenEvents),typeLabel=markerTypeLabel(type);
   const nearest=closestFirst(chosenEvents)[0]||chosenEvents[0];
   const glyph=eventGlyph(nearest);
   const dateState=eventDateState(nearest,rigaTodayIso(clockNow),clockNow);
   const dateTone=dateState.tone;
   const shownCount=isActive?activeInGroup.length:group.events.length;
   const grouped=shownCount>1;
   const dimmed=!isActive;
   const size=dimmed?44:58;
   const timeText=markerTimeText(nearest,clockNow);
   const html='<span class="event-drop-marker '+esc(dateTone)+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+' · '+esc(timeText)+'">'+
     '<span class="event-drop-time">'+esc(timeText)+'</span>'+
     '<span class="event-drop-icon" aria-hidden="true">'+glyph+'</span>'+
     (grouped?'<span class="event-drop-count">'+shownCount+'</span>':'')+
   '</span>';
   const icon=L.divIcon({className:'event-drop-marker-wrap',html,iconSize:[size,size+12],iconAnchor:[size/2,size+10]});
   const marker=L.marker([displayLat,displayLon],{icon,pane:isActive?'activeMarkers':'backgroundMarkers',keyboard:isActive,title:typeLabel});
   const viewportWidth=typeof window!=='undefined'?window.innerWidth:1366;
   const isMobileViewport=viewportWidth<=700;
   const popupMaxWidth=isMobileViewport?Math.max(250,viewportWidth-32):430;
   const popupMaxHeight=isMobileViewport?Math.max(220,Math.min(420,map.getSize().y-120)):Math.max(260,Math.min(560,map.getSize().y-150));
   marker.bindPopup(popupHtml(group,activeIds,isAdminSession,clockNow),{
    maxWidth:popupMaxWidth,
    maxHeight:popupMaxHeight,
    autoPan:true,
    keepInView:true,
    autoPanPaddingTopLeft:isMobileViewport?[14,92]:[28,118],
    autoPanPaddingBottomRight:isMobileViewport?[14,18]:[28,32]
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
 },[mapReady,locationGroups,activeIds,isAdminSession,clockNow]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=leafletRef.current,map=mapRef.current;
  focusLayerRef.current?.remove();
  const focus=L.layerGroup().addTo(map);focusLayerRef.current=focus;
  if(!userLocation)return;
  const center=[userLocation.lat,userLocation.lon];
  L.circleMarker(center,{pane:'centerPane',radius:5,color:'#7f00ff',weight:1.5,opacity:.9,fillColor:'#fff',fillOpacity:.96,interactive:false}).addTo(focus);
  if(radiusKm>0){
   const circle=L.circle(center,{pane:'centerPane',radius:radiusKm*1000,color:'#7f00ff',weight:1.1,opacity:.62,fillColor:'#b56cff',fillOpacity:.018,interactive:false}).addTo(focus);
   map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:13});
  }else{
   map.setView(center,11);
  }
 },[mapReady,userLocation,radiusKm]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;},[]);

 const advancedFilterCount=[radiusKm!==30,periodMode!=='week',eventTypes.length>0,competition,category,eventSearch,price,country,municipality,mapStyle!=='positron'].filter(Boolean).length;
 const singleEventType=eventTypes.length===1?eventTypes[0]:'';
 const quickTypes=[
  {value:'municipality',label:'Pašvaldības',glyph:'📅'},
  {value:'lff',label:'Futbols',glyph:'⚽'},
  {value:'basketball',label:'Basketbols',glyph:'🏀'},
  {value:'athletics',label:'Vieglatlētika',glyph:'🏃'}
 ];

 function toggleEventType(value){
  setEventTypes(current=>{
   const next=current.includes(value)?current.filter(v=>v!==value):[...current,value];
   return next;
  });
  setCompetition('');setCategory('');setMunicipality('');setCountry('');
 }
 function changePeriod(value){
  setPeriodMode(value);
  if(value==='manual')return;
  const filterToday=publicFrom||rigaTodayIso(clockNow);
  const next=periodDates(value,filterToday,publicTo,from,to);
  setFrom(next.from);setTo(next.to);
 }
 function resetFilters(){
  setEventTypes([]);setCompetition('');setCategory('');setEventSearch('');setPrice('');setMunicipality('');setCountry('');setRadiusKm(30);setMapStyle('positron');setPeriodMode('week');
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
  if(place.eventTitle)setEventSearch(place.eventTitle);
  setLocationQuery(place.eventTitle||place.displayName||place.label);setLocationResults([]);setLocationMessage('');
 }
 async function searchLocation(){
  const q=locationQuery.trim();
  if(q.length<2){setLocationMessage('Ievadi vismaz 2 rakstzīmes.');return;}
  setFiltersOpen(false);
  const local=locationChoices.filter(x=>norm(x.label).includes(norm(q))).slice(0,5);
  const eventMatches=events.filter(e=>norm(e.title).includes(norm(q))&&Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude))).slice(0,4).map(e=>({id:'event-search:'+e.id,label:e.title,displayName:e.venue_name||e.address_raw||e.settlement||e.municipality||e.title,latitude:Number(e.latitude),longitude:Number(e.longitude),local:true,eventTitle:e.title}));
  if(local.length===1&&norm(local[0].label)===norm(q)){selectLocation(local[0]);return;}
  setLocationSearching(true);setLocationMessage('');
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
   const data=await response.json();
   if(!response.ok)throw new Error(data?.error||'Meklēšana neizdevās.');
   const combined=[...eventMatches,...local,...(Array.isArray(data.results)?data.results:[])];
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
      <span className="map-search-leading" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></span>
      <input
       list="meets-location-options"
       value={locationQuery}
       onFocus={()=>setFiltersOpen(false)}
       onChange={e=>setLocationQuery(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchLocation();}}}
       placeholder="Meklēt lokāciju vai pasākumu…"
       aria-label="Meklēt lokāciju vai pasākumu"
      />
      <button type="button" className="map-search-button" onClick={searchLocation} disabled={locationSearching} title="Meklēt" aria-label="Meklēt">
       {locationSearching?'…':<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>}
      </button>
      <button type="button" className={'map-control-button filters-button'+(filtersOpen?' active':'')} onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen} aria-label="Paplašinātie filtri" title="Paplašinātie filtri">
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>
       {advancedFilterCount>0&&<span className="filter-count">{advancedFilterCount}</span>}
      </button>
      <datalist id="meets-location-options">{locationChoices.map(x=><option key={x.id} value={x.label}/>)}</datalist>
     </div>
    </div>

    <div className="map-quick-settings" aria-label="Ātrie kartes filtri">
     <label>
      <span>Radiuss</span>
      <select className="map-compact-select radius-select" value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))} aria-label="Meklēšanas radiuss">
       {RADIUS_OPTIONS.map(v=><option key={v} value={v}>{v===0?'Visa karte':v+' km'}</option>)}
      </select>
     </label>
     <label>
      <span>Datums</span>
      <select className="map-compact-select period-select" value={periodMode} onChange={e=>changePeriod(e.target.value)} aria-label="Laika periods">
       <option value="today">Šodien</option>
       <option value="3days">3 dienas</option>
       <option value="week">Šonedēļ</option>
       <option value="month">Šomēnes</option>
       <option value="manual">Manuāli</option>
      </select>
     </label>
    </div>

    {periodMode==='manual'&&<div className="map-primary-manual-period">
     <input aria-label="Datums no" title="Datums no" type="date" min={publicFrom||undefined} max={to||publicTo||undefined} value={from} onChange={e=>{const value=e.target.value;setFrom(value);if(to&&value>to)setTo(value);}}/>
     <span aria-hidden="true">–</span>
     <input aria-label="Datums līdz" title="Datums līdz" type="date" min={from||publicFrom||undefined} max={publicTo||undefined} value={to} onChange={e=>setTo(e.target.value)}/>
    </div>}

    <div className="map-quick-filters" aria-label="Ātrie pasākumu filtri">
     {quickTypes.map(item=><button
      key={item.value}
      type="button"
      className={'map-quick-chip'+(eventTypes.includes(item.value)?' active':'')}
      aria-pressed={eventTypes.includes(item.value)}
      onClick={()=>toggleEventType(item.value)}
     ><span aria-hidden="true">{item.glyph}</span>{item.label}</button>)}
    </div>

    {filtersOpen&&<div className="map-advanced-panel" role="dialog" aria-label="Paplašinātie filtri">
     <div className="map-filter-head">
      <strong>Filtri</strong>
      <button type="button" className="map-filter-close" onClick={()=>setFiltersOpen(false)} aria-label="Aizvērt filtrus">×</button>
     </div>

     <fieldset className="map-type-options">
      <legend>Tips</legend>
      {quickTypes.map(item=><label key={item.value} className={eventTypes.includes(item.value)?'active':''}>
       <input type="checkbox" checked={eventTypes.includes(item.value)} onChange={()=>toggleEventType(item.value)}/>
       <span aria-hidden="true">{item.glyph}</span>{item.label} <small>({sourceCounts[item.value]||0})</small>
      </label>)}
     </fieldset>

     {(singleEventType==='lff'||singleEventType==='basketball')&&<label className="map-filter-field"><span>Turnīrs</span>
      <select value={competition} onChange={e=>{setCompetition(e.target.value);setCategory('');setMunicipality('');}} aria-label="Turnīrs">
       <option value="">{singleEventType==='lff'?'Visi LFF turnīri':'Visi basketbola turnīri'}</option>
       {competitionOptions.map(v=><option key={v.key} value={v.key}>{v.name} ({v.count})</option>)}
      </select>
     </label>}

     <label className="map-filter-field"><span>Kategorija</span>
      <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Kategorija">
       <option value="">Visas kategorijas</option>{categories.map(v=><option key={v}>{v}</option>)}
      </select>
     </label>

     <label className="map-filter-field"><span>Pasākums</span>
      <input className="map-event-search" type="search" value={eventSearch} onChange={e=>setEventSearch(e.target.value)} placeholder="Meklēt pasākumu…" aria-label="Meklēt pēc pasākuma nosaukuma"/>
     </label>

     <label className="map-filter-field"><span>Maksa</span>
      <select value={price} onChange={e=>setPrice(e.target.value)} aria-label="Maksas statuss">
       <option value="">Visas maksas</option><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option><option value="unknown">Nav zināms</option>
      </select>
     </label>

     <label className="map-filter-field"><span>Valsts</span>
      <select value={country} onChange={e=>{setCountry(e.target.value);setMunicipality('');}} aria-label="Valsts">
       <option value="">Visas valstis</option>{countries.map(code=><option key={code} value={code}>{countryLabel(code)}</option>)}
      </select>
     </label>

     <label className="map-filter-field"><span>Pašvaldība</span>
      <select value={municipality} onChange={e=>setMunicipality(e.target.value)} aria-label="Pašvaldība">
       <option value="">Visas pašvaldības</option>{municipalities.map(v=><option key={v}>{v}</option>)}
      </select>
     </label>

     <label className="map-filter-field"><span>Kartes stils</span>
      <select value={mapStyle} onChange={e=>setMapStyle(e.target.value)} aria-label="Kartes stils" disabled={mapMode==='raster'}>
       {mapMode==='raster'?<option value={mapStyle}>Rastra rezerves karte</option>:Object.entries(MAP_STYLES).map(([key,style])=><option key={key} value={key}>{style.label}</option>)}
      </select>
     </label>

     <button className="map-reset-button" type="button" onClick={resetFilters}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1-8.5L4 10"/></svg>
      Atiestatīt filtrus
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
   {mapMode==='raster'&&<div className="map-fallback-note" role="status">Rastra rezerves karte</div>}
   {mapError&&<div className="map-render-error" role="alert">
    <strong>Karti neizdevās attēlot.</strong>
    <span>{mapError}</span>
    <div>
     <button type="button" className="button compact" onClick={()=>setMapRetry(value=>value+1)}>Mēģināt vēlreiz</button>
     <a className="button compact" href="/pasakumi">Atvērt pasākumu sarakstu</a>
    </div>
   </div>}

   <div className="map-legend map-legend-overlay" aria-label="Kartes leģenda">
    <span className="legend-ended-example"><i aria-hidden="true"></i>iespējams noslēdzies</span>
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

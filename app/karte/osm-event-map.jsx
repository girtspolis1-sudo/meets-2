'use client';
import {track} from '../../lib/analytics.js';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import MobileEventSheet from './mobile-event-sheet.jsx';
import NearbyList from './nearby-list.jsx';
import CategoryIcon from '../components/category-icon.jsx';
import {eventTerm} from '../../lib/event-term.js';
import {durationKind,isBackgroundLong,untilBadge} from '../../lib/event-duration.js';
import ChipScroller from './chip-scroller.jsx';
// Narrow screens: the period buttons get shorter names.
const SHORT_PERIOD={weekend:'Brīvdienas','7days':'7 d.','30days':'30 d.',manual:'Datumi'};
import {categoryIconSvg} from '../../lib/category-icons.js';
import {groupedSportIcon} from '../../lib/event-map-icons.js';
import {calendarDescription} from '../../lib/catalog-wire.js';
import {PERIODS,RADII,DEFAULT_PERIOD,DEFAULT_RADIUS,periodKey,periodRange,periodPhrase,radiusLabel,nearbyGroups,widerOptions,countLabel,markerLabel} from '../../lib/map-nearby.js';
import {CLUSTER_MAX_ZOOM,radiusForView} from '../../lib/map-cluster.js';
import {useAdminSession} from '../use-admin-session.js';
import {placeFromEvent} from '../../lib/location-follow.js';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import {eventGroup,HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS,AUDIENCE_FILTERS,audienceKey,matchesAudience,homeCategoryKey,matchesHomeCategory,sourceType,SOURCE_TYPES,SOURCE_TYPE_BODY} from '../../lib/home-category-filters.js';
import {useEvents} from '../../lib/use-events.js';
import {eventDateState,hasEventEnded,rigaClockMinutes,rigaTodayIso} from '../../lib/event-date.js';
import {addRasterLayer,enableMapLibre,hasWebGL,loadLeaflet,removeLayerSafe,requestedMapMode} from '../../lib/leaflet-runtime.js';
import {eventPath} from '../../lib/seo.js';
import {suggestionAction,matchesText,eventSuggestions,placeSuggestions,whatFilterCount,shortWhen} from '../../lib/map-search.js';
import {SearchBar,WhatPanel,WherePanel,NovadsCard,usePanelDismiss} from './map-search.jsx';
import MunicipalityHeatmap from './municipality-heatmap.jsx';
import {municipalityCounts,parseMunicipalityParam,municipalityParam,municipalityByName,regionTitle,areaOf,areaGroups} from '../../lib/lv-municipalities.js';

const MAP_STYLES={
 positron:{label:'Positron',url:'https://tiles.openfreemap.org/styles/positron'},
 liberty:{label:'Liberty',url:'https://tiles.openfreemap.org/styles/liberty'},
 bright:{label:'Bright',url:'https://tiles.openfreemap.org/styles/bright'},
 dark:{label:'Dark',url:'https://tiles.openfreemap.org/styles/dark'},
 fiord:{label:'Fiord',url:'https://tiles.openfreemap.org/styles/fiord'}
};
const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};
const DEFAULT_LOCATION={lat:56.9496,lon:24.1052,label:'Rīgas centrs',source:'fallback'};
const LOCATION_CHOICE_KEY='meets_location_choice_v1';
const FAVORITES_KEY='meets_favorites_v1';
// Quick picks on first visit; the search box finds any other place.
const CITIES=[
 {label:'Rīga',latitude:56.9496,longitude:24.1052},{label:'Jūrmala',latitude:56.968,longitude:23.77},
 {label:'Liepāja',latitude:56.5047,longitude:21.0108},{label:'Daugavpils',latitude:55.8747,longitude:26.5362},
 {label:'Jelgava',latitude:56.6511,longitude:23.7214},{label:'Valmiera',latitude:57.5385,longitude:25.4264},
 {label:'Ventspils',latitude:57.3894,longitude:21.5606},{label:'Rēzekne',latitude:56.5099,longitude:27.3332},
 {label:'Ogre',latitude:56.8162,longitude:24.614},{label:'Cēsis',latitude:57.3119,longitude:25.2706}
];

const FAR_DAYS=15;
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function norm(v=''){return String(v).toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function countryLabel(code){return ({LV:'Latvija',EE:'Igaunija',LT:'Lietuva'})[code]||'';}
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
 return periodRange(mode,today,windowTo,{from:currentFrom,to:currentTo});
}

export default function OsmEventMap(){
 const searchParams=useSearchParams();
 const router=useRouter();
 const pathname=usePathname();
 const homeCategory=homeCategoryKey(searchParams.get('category'));
 const audience=audienceKey(searchParams.get('audience'));
 const eventTypeFilter=searchParams.get('event_type')||'';
 const placeFilter=searchParams.get('place')||'';
 // ?org=<id>: one organizer's events are active, everything else stays grey in the background.
 const [orgFilter,setOrgFilter]=useState(()=>{const v=searchParams.get('org')||'';return /^[0-9a-f-]{36}$/i.test(v)?v:'';});
 const orgFitRef=useRef(false),orgDatesRef=useRef(false);
 // Running exhibitions and season programmes can be switched off (?long=0).
 const [showLong,setShowLong]=useState(()=>searchParams.get('long')!=='0');
 // Only events that can be joined online (?online=1).
 const [onlineOnly,setOnlineOnly]=useState(()=>searchParams.get('online')==='1');
 function setDiscoveryFilter(key,value){
  const params=new URLSearchParams(searchParams.toString());
  if(value)params.set(key,value);else params.delete(key);
  router.push(pathname+(params.size?'?'+params.toString():''),{scroll:false});
 }
 function clearHomeCategory(){
  const params=new URLSearchParams(searchParams.toString());
  params.delete('category');
  router.push(pathname+(params.size?'?'+params.toString():''),{scroll:false});
 }

 const [eventTypes,setEventTypes]=useState(()=>searchParams.get('types')?.split(',').filter(x=>SOURCE_TYPES.includes(x))||[]);
 const [competition,setCompetition]=useState(searchParams.get('competition')||'');
 const [category,setCategory]=useState(searchParams.get('subcategory')||'');
 const [eventSearch,setEventSearch]=useState(searchParams.get('q')||'');
 // What is typed in "Ko"; it filters the map a moment after typing stops.
 const [whatQuery,setWhatQuery]=useState(()=>searchParams.get('q')||'');
 useEffect(()=>{const t=setTimeout(()=>setEventSearch(current=>current===whatQuery.trim()?current:whatQuery.trim()),220);return()=>clearTimeout(t);},[whatQuery]);
 useEffect(()=>{setWhatQuery(current=>current.trim()===eventSearch?current:eventSearch);},[eventSearch]);
 const [price,setPrice]=useState(searchParams.get('price')||'');
 // ?municipality= holds one local government or several, separated by commas.
 const [placeList,setPlaceList]=useState(()=>parseMunicipalityParam(searchParams.get('municipality')));
 const municipality=municipalityParam(placeList);
 const setMunicipality=useCallback(value=>setPlaceList(parseMunicipalityParam(value)),[]);
 const placeSet=useMemo(()=>new Set(placeList),[municipality]);
 // ?area=: one town or parish inside the single chosen local government ("Citur" = no known place).
 const [areaFilter,setAreaFilter]=useState(()=>searchParams.get('area')||'');
 useEffect(()=>{if(placeList.length!==1)setAreaFilter('');},[municipality]);
 const [mapZoom,setMapZoom]=useState(0);
 const hidePinsRef=useRef(false),areaLayerRef=useRef(null);
 const [country,setCountry]=useState(searchParams.get('country')||'');
 const [from,setFrom]=useState(searchParams.get('from')||'');
 const [to,setTo]=useState(searchParams.get('to')||'');
 // null until we know whether a place was chosen: then 30 km around it, otherwise all of Latvia.
 const [radiusKm,setRadiusKm]=useState(()=>{const q=searchParams.get('radius'),n=Number(q);return q!==null&&[0,5,10,20,25,30,50].includes(n)?n:null;});
 const [periodMode,setPeriodMode]=useState(()=>periodKey(searchParams.get('period')));
 const [locationPrompt,setLocationPrompt]=useState(false);
 const [highlightedId,setHighlightedId]=useState('');
 const [styleMenuOpen,setStyleMenuOpen]=useState(false);
 const listRef=useRef(null),hoveredMarkerRef=useRef(null),shownMarkerRef=useRef(new Map());
 const [areaMoved,setAreaMoved]=useState(false);
 // Open search panel: 'where' (Kur), 'what' (Ko filters) or none.
 const [panel,setPanel]=useState('');
 const whereButtonRef=useRef(null),whatButtonRef=useRef(null),wherePanelRef=useRef(null),whatPanelRef=useRef(null);
 const [mapStyle,setMapStyle]=useState(()=>Object.hasOwn(MAP_STYLES,searchParams.get('style'))?searchParams.get('style'):'positron');
 const [userLocation,setUserLocation]=useState(DEFAULT_LOCATION);

 const [favorites,setFavorites]=useState(()=>new Set());
 useEffect(()=>{track('map_open');},[]);
 // Hover previews only where a pointer can hover (not on touch screens).
 const [canHover,setCanHover]=useState(false);
 useEffect(()=>{
  const query=window.matchMedia('(hover: hover) and (pointer: fine)');
  const update=()=>setCanHover(query.matches);
  update();query.addEventListener?.('change',update);
  return()=>query.removeEventListener?.('change',update);
 },[]);
 const [locationQuery,setLocationQuery]=useState('');
 const [locationResults,setLocationResults]=useState([]);
 const [locationMessage,setLocationMessage]=useState('');
 const [locationSearching,setLocationSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [mapMode,setMapMode]=useState('loading');
 const [mapError,setMapError]=useState('');
 // The map place whose events are open: side panel on desktop, sheet on phones.
 const [placeKey,setPlaceKey]=useState('');
 const [isPhone,setIsPhone]=useState(false);
 const [mapRetry,setMapRetry]=useState(0);
 const {isAdmin:isAdminSession}=useAdminSession();
 const [clockNow,setClockNow]=useState(()=>new Date());
 const {data,loading,error,refresh}=useEvents();
 const mapEl=useRef(null),mapRef=useRef(null),leafletRef=useRef(null),baseMapLayerRef=useRef(null),baseLayerCleanupRef=useRef(null),backgroundLayerRef=useRef(null),activeLayerRef=useRef(null),focusLayerRef=useRef(null);
 const defaultsSetRef=useRef(false);
 const focusEventId=searchParams.get('event')||'';
 const focusDatesSetRef=useRef(false),focusOpenedRef=useRef(false),markerByEventRef=useRef(new Map());

 useEffect(()=>{
  try{
   const sharedLat=Number(searchParams.get('lat')),sharedLon=Number(searchParams.get('lon'));
   const hasShared=searchParams.has('lat')&&searchParams.has('lon')&&Number.isFinite(sharedLat)&&Number.isFinite(sharedLon)&&insideBalticView(sharedLat,sharedLon);
   // known: a shared or remembered place; "Visa Latvija" is remembered as the fallback centre.
   let known=hasShared,wholeCountry=false;
   if(hasShared){setUserLocation({lat:sharedLat,lon:sharedLon,label:'Izvēlētā vieta',source:'shared'});setLocationQuery('Izvēlētā vieta');}
   const saved=hasShared?null:JSON.parse(window.localStorage.getItem(LOCATION_CHOICE_KEY)||'null');
   if(saved&&Number.isFinite(saved.lat)&&Number.isFinite(saved.lon)&&insideBalticView(saved.lat,saved.lon)){
    known=true;wholeCountry=saved.source==='fallback';
    setUserLocation(saved);setLocationQuery(wholeCountry?'':saved.label);
   }
   setRadiusKm(current=>current??(known&&!wholeCountry?DEFAULT_RADIUS:0));
   // First visit: offer a place. If the browser already allows location, use it without asking.
   if(searchParams.has('org'))setRadiusKm(0);
   if(!known&&!searchParams.has('municipality')&&!searchParams.has('event')&&!searchParams.has('org')){
    setLocationPrompt(true);
    navigator.permissions?.query({name:'geolocation'}).then(status=>{if(status.state==='granted')useCurrentLocation();}).catch(()=>{});
   }
  }catch{setRadiusKm(current=>current??0);/* Default to browsing all locations without a permission prompt. */}
  try{const ids=JSON.parse(window.localStorage.getItem(FAVORITES_KEY)||'[]');if(Array.isArray(ids))setFavorites(new Set(ids.map(String)));}catch{/* Browser storage can be disabled. */}
 },[]);

 async function toggleFavorite(eventId){
  const id=String(eventId);
  const selected=!favorites.has(id);
  const next=new Set(favorites);
  if(selected)next.add(id);else next.delete(id);
  setFavorites(next);
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...next]));}catch{}
  try{
   const session=JSON.parse(localStorage.getItem('meets_user_session_v1')||'null');
   if(session?.access_token){
    const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:selected?'add':'remove',token:session.access_token,eventId:id})});
    if(!response.ok)throw Error('Neizdevās saglabāt kontā.');
   }
  }catch{/* Local favorites remain available until account session is renewed. */}
 }
 // "Visa Latvija": no centre point, no radius.
 function chooseRiga(){setUserLocation(DEFAULT_LOCATION);setRadiusKm(0);setLocationQuery('');setLocationResults([]);setLocationPrompt(false);try{localStorage.setItem(LOCATION_CHOICE_KEY,JSON.stringify(DEFAULT_LOCATION));}catch{}}
 function calendarDownload(event){
  const from=String(event.date_from||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(from))return;
  const escapeIcs=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const day=value=>value.replace(/-/g,'');
  const nextDay=value=>{const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);};
  const time=String(event.time_from||'').match(/^(\d{1,2}):(\d{2})/);
  const endTime=String(event.time_to||'').match(/^(\d{1,2}):(\d{2})/);
  const startDate=day(from),endDate=day(event.date_to&&event.date_to>=from?event.date_to:from);
  let dates;
  if(time){const clock=t=>t[1].padStart(2,'0')+t[2]+'00';const start=startDate+'T'+clock(time);const end=endTime?endDate+'T'+clock(endTime):startDate+'T'+String((Number(time[1])+1)%24).padStart(2,'0')+time[2]+'00';dates='DTSTART;TZID=Europe/Riga:'+start+'\r\nDTEND;TZID=Europe/Riga:'+end;}
  else{dates='DTSTART;VALUE=DATE:'+startDate+'\r\nDTEND;VALUE=DATE:'+day(nextDay(event.date_to&&event.date_to>=from?event.date_to:from));}
  const location=[event.venue_name,event.address_raw,event.settlement||event.municipality].filter(Boolean).join(', ');
  const url=event.sources?.find(s=>s.url)?.url||'';
  const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MEETS//LV','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+encodeURIComponent(String(event.id))+'@meets.lv','DTSTAMP:'+now,dates,'SUMMARY:'+escapeIcs(event.title),'LOCATION:'+escapeIcs(location),'DESCRIPTION:'+escapeIcs(calendarDescription(event,window.location.origin)),'URL:'+escapeIcs(url),'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
  const blob=new Blob([content],{type:'text/calendar;charset=utf-8'});const objectUrl=URL.createObjectURL(blob);const link=document.createElement('a');link.href=objectUrl;link.download='meets-'+String(event.id).replace(/[^a-zA-Z0-9-]/g,'')+'.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
 }
 const publicFrom=data?.window?.from||'';
 const publicTo=data?.window?.to||'';
 const events=useMemo(()=>((data?.events)||[]).filter(event=>!hasEventEnded(event)),[data]);
 // Keep the discovery state in the address bar so a filtered map can be shared.
 // Exact browser GPS coordinates are deliberately never written into a URL.
 useEffect(()=>{
  const url=new URL(window.location.href);
  const params=url.searchParams;
  const state={radius:radiusKm>0?String(radiusKm):radiusKm===0&&userLocation.source!=='fallback'?'0':'',period:periodMode===DEFAULT_PERIOD?'':periodMode,
   types:eventTypes.join(','),competition,subcategory:category,q:eventSearch,price,municipality,country,
   from:periodMode==='manual'?from:'',to:periodMode==='manual'?to:'',style:mapStyle==='positron'?'':mapStyle,org:orgFilter,long:showLong?'':'0',online:onlineOnly?'1':'',area:areaFilter};
  for(const [key,value] of Object.entries(state)){if(value)params.set(key,value);else params.delete(key);}
  if(['search','events','shared'].includes(userLocation?.source)&&insideBalticView(userLocation.lat,userLocation.lon)){
   params.set('lat',String(Number(userLocation.lat.toFixed(4))));
   params.set('lon',String(Number(userLocation.lon.toFixed(4))));
  }else{params.delete('lat');params.delete('lon');}
  const next=url.pathname+(params.size?'?'+params.toString():'')+url.hash;
  if(next!==window.location.pathname+window.location.search+window.location.hash)window.history.replaceState(null,'',next);
 },[radiusKm,periodMode,eventTypes,competition,category,eventSearch,price,municipality,areaFilter,country,from,to,mapStyle,userLocation,orgFilter,showLong,onlineOnly]);


 useEffect(()=>{
  const timer=window.setInterval(()=>setClockNow(new Date()),30000);
  return()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{
  if(defaultsSetRef.current||!publicFrom)return;
  defaultsSetRef.current=true;
  const next=periodDates(periodMode,rigaTodayIso(clockNow),publicTo,from,to);
  setFrom(next.from);setTo(next.to);
 },[publicFrom,publicTo]);

 // A shared /karte?event=… link must show that event even outside the default week.
 useEffect(()=>{
  if(focusDatesSetRef.current||!focusEventId||!events.length)return;
  focusDatesSetRef.current=true;
  const target=events.find(e=>String(e.id)===focusEventId);
  if(!target?.date_from)return;
  setPeriodMode('manual');setFrom(target.date_from);setTo(target.date_to||target.date_from);
 },[events,focusEventId]);

 // The organizer view covers all of the organizer's coming events, whatever their dates.
 const orgEvents=useMemo(()=>orgFilter?events.filter(e=>e.organization_id===orgFilter):[],[events,orgFilter]);
 const orgName=orgEvents[0]?.organizer_name||'';
 useEffect(()=>{
  if(orgDatesRef.current||!orgFilter||!orgEvents.length)return;
  orgDatesRef.current=true;
  const today=rigaTodayIso(clockNow);
  const starts=orgEvents.map(e=>e.date_from).filter(Boolean).sort();
  const ends=orgEvents.map(e=>e.date_to||e.date_from).filter(Boolean).sort();
  setPeriodMode('manual');setFrom(starts[0]<today?today:starts[0]);setTo(ends.at(-1));
 },[orgEvents,orgFilter]);

 const typedEvents=useMemo(()=>eventTypes.length?events.filter(e=>eventTypes.includes(sourceType(e))):events,[events,eventTypes]);
 const competitionOptions=useMemo(()=>{
  const counts=new Map();
  for(const e of typedEvents)if(e.competition_key&&e.competition_name)counts.set(e.competition_key,(counts.get(e.competition_key)||0)+1);
  const registry=Array.isArray(data?.competitions)?data.competitions:[];
  const singleType=eventTypes.length===1?eventTypes[0]:'';
  const relevantRegistry=registry.filter(c=>singleType==='basketball'?String(c.sport_format||'').toLowerCase()==='basketball':SOURCE_TYPE_BODY[singleType]?String(c.governing_body||'').toUpperCase()===SOURCE_TYPE_BODY[singleType]:false);
  const options=new Map();
  for(const c of relevantRegistry)if(c.competition_key&&c.name)options.set(c.competition_key,{key:c.competition_key,name:c.name,count:counts.get(c.competition_key)||0});
  for(const e of typedEvents)if(e.competition_key&&e.competition_name&&!options.has(e.competition_key))options.set(e.competition_key,{key:e.competition_key,name:e.competition_name,count:counts.get(e.competition_key)||0});
  return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name,'lv'));
 },[typedEvents,data?.competitions,eventTypes]);

 const scopedEvents=useMemo(()=>competition?typedEvents.filter(e=>e.competition_key===competition):typedEvents,[typedEvents,competition]);
 const categories=useMemo(()=>[...new Set(scopedEvents.map(e=>e.primary_category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[scopedEvents]);
 const countries=useMemo(()=>[...new Set(scopedEvents.map(e=>e.country_code).filter(Boolean))],[scopedEvents]);
 const sourceCounts=useMemo(()=>events.reduce((acc,e)=>{const type=sourceType(e);acc[type]=(acc[type]||0)+1;return acc;},Object.fromEntries(SOURCE_TYPES.map(t=>[t,0]))),[events]);

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

 const matchesWith=useMemo(()=>(e,{radius=radiusKm,from:start=from,to:end=to,anyPrice=false,anyOnline=false,anyPlace=false,anyArea=false}={})=>{
  if(!matchesHomeCategory(e,homeCategory)||!matchesAudience(e,audience))return false;
  if(placeFilter&&placeFromEvent(e)?.key!==placeFilter)return false;
  if(orgFilter&&e.organization_id!==orgFilter)return false;
  if(!showLong&&isBackgroundLong(e,rigaTodayIso()))return false;
  if(!anyOnline&&onlineOnly&&!['online','hybrid'].includes(e.attendance_mode))return false;
  if(eventTypeFilter&&e.event_type!==eventTypeFilter)return false;
  if(eventTypes.length&&!eventTypes.includes(sourceType(e)))return false;
  if(competition&&e.competition_key!==competition)return false;
  if(category&&e.primary_category!==category)return false;
  if(eventSearch&&!matchesText(e,eventSearch))return false;
  // The quick "Maksas" choice also covers partly paid events.
  if(!anyPrice&&price&&e.price_status!==price&&!(price==='paid'&&e.price_status==='mixed'))return false;
  if(!anyPlace&&placeSet.size&&!placeSet.has(e.municipality))return false;
  if(!anyPlace&&!anyArea&&areaFilter&&(areaOf(e)||'Citur')!==areaFilter)return false;
  if(country&&e.country_code!==country)return false;
  if(start&&(e.date_to||e.date_from)<start)return false;
  if(end&&e.date_from>end)return false;
  if(userLocation&&radius>0){
   const lat=Number(e.latitude),lon=Number(e.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
   if(distanceKm(userLocation.lat,userLocation.lon,lat,lon)>radius)return false;
  }
  return true;
 },[homeCategory,audience,placeFilter,orgFilter,showLong,onlineOnly,eventTypeFilter,eventTypes,competition,category,eventSearch,price,municipality,areaFilter,country,from,to,userLocation,radiusKm]);
 const matchesEvent=useMemo(()=>e=>matchesWith(e),[matchesWith]);
 // How many events each price choice leaves; most sources do not state a price.
 const priceCounts=useMemo(()=>{
  const counts={'':0,free:0,paid:0};
  for(const e of events){if(!matchesWith(e,{anyPrice:true}))continue;counts['']++;
   if(e.price_status==='free')counts.free++;else if(e.price_status==='paid'||e.price_status==='mixed')counts.paid++;}
  return counts;
 },[events,matchesWith]);
 const onlineCount=useMemo(()=>events.filter(e=>['online','hybrid'].includes(e.attendance_mode)&&matchesWith(e,{anyOnline:true})).length,[events,matchesWith]);

 const catalogHref=useMemo(()=>{
  const params=new URLSearchParams();
  if(homeCategory)params.set('category',homeCategory);
  if(placeFilter)params.set('place',placeFilter);
  if(audience)params.set('audience',audience);
  if(eventTypeFilter)params.set('event_type',eventTypeFilter);
  if(eventTypes.length)params.set('types',eventTypes.join(','));
  if(competition)params.set('competition',competition);
  if(category)params.set('subcategory',category);
  if(eventSearch)params.set('q',eventSearch);
  if(price)params.set('price',price);
  if(placeList.length===1)params.set('municipality',placeList[0]);
  if(country)params.set('country',country);
  if(radiusKm)params.set('radius',String(radiusKm));
  params.set('period','manual');
  if(from)params.set('from',from);if(to)params.set('to',to);
  if(['search','events','shared'].includes(userLocation?.source)&&insideBalticView(userLocation.lat,userLocation.lon)){
   params.set('lat',String(Number(userLocation.lat.toFixed(4))));
   params.set('lon',String(Number(userLocation.lon.toFixed(4))));
  }
  return '/pasakumi'+(params.size?'?'+params.toString():'');
 },[homeCategory,audience,placeFilter,eventTypeFilter,eventTypes,competition,category,eventSearch,price,municipality,country,radiusKm,periodMode,from,to,userLocation]);
 const activeEvents=useMemo(()=>events.filter(matchesEvent),[events,matchesEvent]);
 const activeIds=useMemo(()=>new Set(activeEvents.map(e=>e.id)),[activeEvents]);
 const mapEvents=useMemo(()=>events.filter(e=>matchesHomeCategory(e,homeCategory)&&matchesAudience(e,audience)&&(!placeFilter||placeFromEvent(e)?.key===placeFilter)&&Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude))&&isSupportedMapEvent(e)&&insideBalticView(Number(e.latitude),Number(e.longitude))),[events,homeCategory,audience,placeFilter]);
 const locationGroups=useMemo(()=>groupEvents(mapEvents),[mapEvents]);
 const openPlace=useMemo(()=>locationGroups.find(g=>g.key===placeKey)||null,[locationGroups,placeKey]);
 useEffect(()=>{
  const query=window.matchMedia('(max-width:1000px)');
  const sync=()=>setIsPhone(query.matches);
  sync();query.addEventListener('change',sync);
  return()=>query.removeEventListener('change',sync);
 },[]);
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
    if(map.zoomControl?.setPosition)map.zoomControl.setPosition('bottomright');
    map.createPane('centerPane');map.getPane('centerPane').style.zIndex='390';
    map.createPane('backgroundMarkers');map.getPane('backgroundMarkers').style.zIndex='450';
    map.createPane('farMarkers');map.getPane('farMarkers').style.zIndex='470';
    map.createPane('activeMarkers');map.getPane('activeMarkers').style.zIndex='490';
    if(map.getPane('popupPane'))map.getPane('popupPane').style.zIndex='920';
    leafletRef.current=L;
    mapRef.current=map;
    setMapZoom(map.getZoom());
    // Only a drag by the visitor offers "Meklēt šajā apgabalā", not our own zooming.
    map.on('dragend',()=>setAreaMoved(true));
    map.on('zoomend',()=>setMapZoom(map.getZoom()));

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
  const bg=L.layerGroup(),active=L.layerGroup();
  if(!hidePinsRef.current){bg.addTo(map);active.addTo(map);}
  backgroundLayerRef.current=bg;activeLayerRef.current=active;

  const indexByCoordinate=new Map();
  markerByEventRef.current=new Map();
  const built=[];
  for(const group of locationGroups){
   const [displayLat,displayLon]=groupPosition(group,indexByCoordinate);
   const activeInGroup=group.events.filter(e=>activeIds.has(e.id));
   const isActive=activeInGroup.length>0;
   const chosenEvents=isActive?activeInGroup:group.events;
   const todayIso=rigaTodayIso(clockNow);
   // The day's own events lead the pin; a running exhibition only when nothing else is there.
   const foreground=chosenEvents.filter(e=>!isBackgroundLong(e,todayIso));
   const nearest=closestFirst(foreground.length?foreground:chosenEvents)[0]||chosenEvents[0];
   const longPin=!foreground.length;
   const running=String(nearest.date_from||'')<todayIso&&durationKind(nearest)!=='short';
   const term=eventTerm(nearest,rigaTodayIso(clockNow),clockNow);
   const shownCount=isActive?activeInGroup.length:group.events.length;
   const dimmed=!isActive;
   // More than 15 days ahead: kept in the background, faint and grey, so the near events stand out.
   const far=term.days!=null&&term.days>FAR_DAYS;
   const saved=group.events.some(e=>favorites.has(String(e.id)));
   const group0=eventGroup(nearest);
   // A pin whose events are all one sport shows that sport (⚽ 🏀 🏒 …).
   const sport=groupedSportIcon(chosenEvents);
   const pinIcon=sport?'<span class="c3-pin-sport" title="'+esc(sport.label)+'">'+esc(sport.glyph)+'</span>':categoryIconSvg(group0,22);
   // C3 "minimal duo icon": the category icon leads, the days badge is a small
   // accent. Only events at the very same place share a pin (with a count).
   // Exhibitions and other long events: a framed pin with no countdown, kept below the rest.
   // Festival weeks and an exhibition's last days show until when instead of "0d".
   const badge=longPin?'':running?'<span class="c3-pin-days c3-pin-until">'+esc(untilBadge(nearest))+'</span>':null;
   const html='<span class="c3-pin tone-'+esc(term.tone)+(dimmed?' dimmed':'')+(far?' far':'')+(longPin?' long':'')+'">'+
     (longPin?'<svg class="c3-pin-shape" width="44" height="56" viewBox="0 0 44 56" aria-hidden="true"><path d="M9 6h26a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6h-8l-5 10-5-10H9a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z"/></svg>'
      :'<svg class="c3-pin-shape" width="44" height="56" viewBox="0 0 44 56" aria-hidden="true"><path d="M22 54C22 54 4 35 4 21.5A18 18 0 1 1 40 21.5C40 35 22 54 22 54Z"/></svg>')+
     '<span class="c3-pin-icon">'+pinIcon+'</span>'+
     (badge!==null?badge:term.days===0?'<span class="c3-pin-days c3-pin-now'+(term.tone==='ended'?' ended':'')+'" aria-hidden="true"></span>':'<span class="c3-pin-days">'+esc(term.badge)+'</span>')+
     (saved?'<span class="c3-pin-saved" title="Saglabāts"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg></span>':'')+
     (shownCount>1?'<span class="c3-pin-count">'+shownCount+'</span>':'')+
   '</span>';
   const size=dimmed?[34,44]:[44,56];
   const icon=L.divIcon({className:'c3-pin-wrap',html,iconSize:size,iconAnchor:[size[0]/2,size[1]-2],tooltipAnchor:[size[0]/2,-size[1]/2]});
   const label=nearest.title+', '+term.label+(shownCount>1?', vēl '+(shownCount-1)+' šajā vietā':'');
   const marker=L.marker([displayLat,displayLon],{icon,pane:!isActive?'backgroundMarkers':far||longPin?'farMarkers':'activeMarkers',keyboard:isActive,title:label,alt:label,riseOnHover:true});
   if(canHover){
    const place=[nearest.venue_name,nearest.settlement||nearest.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
    const image=String(nearest.cover_image_url||'').startsWith('https://')?nearest.cover_image_url:'';
    const category=sport?.label||HOME_CATEGORY_FILTERS[group0]?.title||nearest.primary_category||'';
    const time=String(nearest.time_from||'').slice(0,5);
    marker.bindTooltip('<div class="c3-preview">'+
     (image?'<img src="'+esc(image)+'" alt="" loading="lazy">':'')+
     '<div class="c3-preview-body"><span class="c3-preview-term tone-'+esc(term.tone)+'">'+esc(term.label)+'</span>'+
     '<strong>'+esc(nearest.title)+'</strong>'+
     (time?'<span>'+esc(time)+'</span>':'')+(place?'<span>'+esc(place)+'</span>':'')+
     (shownCount>1?'<span class="c3-preview-more">Vēl '+(shownCount-1)+' šajā vietā</span>':'')+
     '</div>'+(category?'<div class="c3-preview-category">'+categoryIconSvg(group0,15)+esc(category)+'</div>':'')+
    '</div>',{direction:'right',offset:[10,0],opacity:1,className:'c3-preview-tooltip'});
   }
   marker.on('click',()=>{
    marker.closeTooltip?.();
    setHighlightedId(String(nearest?.id||''));
    setPlaceKey(group.key);
    setLocationPrompt(false);
    setPanel('');
    setLocationResults([]);
    setLocationMessage('');
   });
   for(const e of group.events)markerByEventRef.current.set(String(e.id),marker);
   built.push({marker,isActive,events:group.events});
  }

  // Every place keeps its own pin at every zoom level: no count bubbles that
  // merge different places.
  const shown=new Map();
  for(const item of built){
   item.marker.addTo(item.isActive?active:bg);
   for(const e of item.events)shown.set(String(e.id),item.marker);
  }
  shownMarkerRef.current=shown;
 },[mapReady,locationGroups,activeIds,clockNow,favorites,canHover]);

 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=leafletRef.current,map=mapRef.current;
  focusLayerRef.current?.remove();
  const focus=L.layerGroup().addTo(map);focusLayerRef.current=focus;
  if(!userLocation)return;
  const center=[userLocation.lat,userLocation.lon];
  L.circleMarker(center,{pane:'centerPane',radius:5,color:'#9e3039',weight:1.5,opacity:.9,fillColor:'#fff',fillOpacity:.96,interactive:false}).addTo(focus);
  if(placeSet.size&&radiusKm===0)return;
  if(radiusKm>0){
   const circle=L.circle(center,{pane:'centerPane',radius:radiusKm*1000,color:'#9e3039',weight:1.1,opacity:.62,fillColor:'#de8d95',fillOpacity:.018,interactive:false}).addTo(focus);
   map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:13,animate:false});
  }else{
   if(userLocation.source==='fallback')map.fitBounds([[54.5,19.5],[59.5,29.5]],{animate:false,padding:[25,25]});
   else map.setView(center,11,{animate:false});
  }
 },[mapReady,userLocation,radiusKm,placeSet]);

 // Organizer view: show straight away where the organizer's events are.
 useEffect(()=>{
  if(orgFitRef.current||!orgFilter||!mapReady||!mapRef.current)return;
  const points=orgEvents.map(e=>[Number(e.latitude),Number(e.longitude)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&insideBalticView(a,b));
  if(!points.length)return;
  orgFitRef.current=true;
  // Leave room for the filter panel that floats over the top of the map.
  const height=mapRef.current.getSize().y;
  const top=Math.min(340,Math.round(height*0.45));
  mapRef.current.fitBounds(points.length===1?[points[0],points[0]]:points,{animate:false,paddingTopLeft:[50,top],paddingBottomRight:[50,60],maxZoom:14});
 },[mapReady,orgEvents,orgFilter,userLocation,radiusKm]);

 // One chosen local government: its events grouped by town or parish.
 const novadsAreas=useMemo(()=>placeList.length===1?areaGroups(events.filter(e=>matchesWith(e,{anyArea:true}))):[],[placeList,events,matchesWith]);
 const AREA_ZOOM=12;
 const showAreas=placeList.length===1&&!areaFilter&&mapZoom>0&&mapZoom<AREA_ZOOM&&novadsAreas.filter(g=>g.lat!=null).length>1;
 hidePinsRef.current=showAreas;
 function chooseArea(name){setAreaFilter(current=>current===name?'':name);}
 // Fit the map to the chosen local government (or the chosen town in it).
 useEffect(()=>{
  if(!mapReady||!mapRef.current||!placeSet.size)return;
  const points=events.filter(e=>placeSet.has(e.municipality)&&(!areaFilter||(areaOf(e)||'Citur')===areaFilter))
   .map(e=>[Number(e.latitude),Number(e.longitude)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&insideBalticView(a,b));
  if(!points.length)return;
  const height=mapRef.current.getSize().y;
  const top=Math.min(isPhone?170:250,Math.round(height*0.42));
  mapRef.current.fitBounds(points.length===1?[points[0],points[0]]:points,{animate:false,paddingTopLeft:[40,top],paddingBottomRight:[40,50],maxZoom:areaFilter?14:AREA_ZOOM-1});
  setMapZoom(mapRef.current.getZoom());
 },[mapReady,municipality,areaFilter]);
 // Zoomed out over one local government: circles per town or parish instead of single pins.
 useEffect(()=>{
  if(!mapReady||!mapRef.current)return;
  const L=leafletRef.current,map=mapRef.current;
  areaLayerRef.current?.remove();areaLayerRef.current=null;
  for(const layer of [backgroundLayerRef.current,activeLayerRef.current]){
   if(!layer)continue;
   if(showAreas)map.removeLayer(layer);else if(!map.hasLayer(layer))layer.addTo(map);
  }
  if(!showAreas)return;
  const layer=L.layerGroup().addTo(map);areaLayerRef.current=layer;
  const max=Math.max(...novadsAreas.map(g=>g.count),1);
  novadsAreas.forEach((g,i)=>{
   if(g.lat==null)return;
   const size=Math.round(36+20*Math.sqrt(g.count/max));
   const name=g.name.replace(/ pagasts$/,' pag.');
   const html='<span class="marea'+(i===0?' top':'')+'" style="width:'+size+'px;height:'+size+'px"><b>'+g.count+'</b><span class="marea-name">'+esc(name)+'</span></span>';
   const icon=L.divIcon({className:'marea-wrap',html,iconSize:[size,size],iconAnchor:[size/2,size/2]});
   L.marker([g.lat,g.lon],{icon,pane:'activeMarkers',title:g.name+', '+countLabel(g.count),alt:g.name,keyboard:true,riseOnHover:true}).on('click',()=>chooseArea(g.name)).addTo(layer);
  });
 },[mapReady,showAreas,novadsAreas,locationGroups,activeIds,clockNow,favorites,canHover]);

 useEffect(()=>{
  if(focusOpenedRef.current||!focusEventId||!mapReady||!mapRef.current)return;
  // Wait until the event's own dates are applied, so the marker is not rebuilt right after opening.
  if(!activeIds.has(focusEventId)&&periodMode!=='manual')return;
  const marker=markerByEventRef.current.get(focusEventId);
  if(!marker)return;
  focusOpenedRef.current=true;
  mapRef.current.setView(marker.getLatLng(),CLUSTER_MAX_ZOOM,{animate:false});
  setHighlightedId(focusEventId);
  setPlaceKey(locationGroups.find(g=>g.events.some(e=>String(e.id)===focusEventId))?.key||'');
 },[mapReady,locationGroups,activeIds,focusEventId,periodMode]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;},[]);

 // Radius, period, group and audience are visible outside the panel, so the badge skips them.
 // Everything inside "Vairāk filtru"; time, distance and the chip rows are visible outside it.
 const filterCount=whatFilterCount({category:homeCategory,audience,eventTypes,competition,subcategory:category,price,onlineOnly,showLong,country});
 const audienceOptions=Object.entries(AUDIENCE_FILTERS).filter(([key])=>key===audience||events.some(e=>matchesAudience(e,key)));
 const singleEventType=eventTypes.length===1?eventTypes[0]:'';
 const quickTypes=[
  {value:'municipality',label:'Pašvaldības',glyph:'📅'},
  {value:'lff',label:'Futbols',glyph:'⚽'},
  {value:'basketball',label:'Basketbols',glyph:'🏀'},
  {value:'hockey',label:'Hokejs',glyph:'🏒'},
  {value:'volleyball',label:'Volejbols',glyph:'🏐'},
  {value:'floorball',label:'Florbols',glyph:'🏑'},
  {value:'handball',label:'Handbols',glyph:'🤾'},
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
  const filterToday=rigaTodayIso(clockNow);
  const next=periodDates(value,filterToday,publicTo,from,to);
  setFrom(next.from);setTo(next.to);
 }
 function resetFilters(){
  const params=new URLSearchParams(searchParams.toString());params.delete('category');params.delete('audience');params.delete('event_type');params.delete('place');
  router.push(pathname+(params.size?'?'+params.toString():''),{scroll:false});
  setEventTypes([]);setCompetition('');setCategory('');setEventSearch('');setPrice('');setMunicipality('');setCountry('');setOrgFilter('');setShowLong(true);setOnlineOnly(false);setRadiusKm(userLocation.source==='fallback'?0:DEFAULT_RADIUS);setPeriodMode(DEFAULT_PERIOD);
  {const filterToday=rigaTodayIso(clockNow);const next=periodDates(DEFAULT_PERIOD,filterToday,publicTo,'','');setFrom(next.from);setTo(next.to);}
 }
 function useCurrentLocation(){
  if(!navigator.geolocation){setLocationMessage('Pārlūks neatbalsta atrašanās vietas noteikšanu. Izvēlies pilsētu.');setLocationPrompt(true);return;}
  setLocationMessage('Nosakām atrašanās vietu…');
  navigator.geolocation.getCurrentPosition(
   pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    if(!insideBalticView(lat,lon)){setLocationMessage('Atrašanās vieta ir ārpus Baltijas. Izvēlies pilsētu.');setLocationPrompt(true);return;}
    const chosen={lat,lon,label:'Mana atrašanās vieta',source:'browser'};setUserLocation(chosen);setRadiusKm(DEFAULT_RADIUS);try{localStorage.setItem(LOCATION_CHOICE_KEY,JSON.stringify(chosen));}catch{}
    setLocationQuery('Mana atrašanās vieta');setLocationResults([]);setLocationMessage('');setLocationPrompt(false);
   },
   ()=>{setLocationMessage('Atrašanās vietu neizdevās noteikt. Izvēlies pilsētu vai ieraksti vietu.');setLocationPrompt(true);},
   {enableHighAccuracy:true,timeout:8000,maximumAge:300000}
  );
 }
 function selectLocation(place){
  const action=suggestionAction(place);
  setLocationResults([]);setLocationMessage('');setLocationPrompt(false);
  // An event only searches for itself; the place distances are counted from stays as it was.
  if(action.kind==='event'){
   setEventSearch(action.search);setLocationQuery('');
   if(action.view&&mapRef.current)mapRef.current.setView(action.view,Math.max(mapRef.current.getZoom(),CLUSTER_MAX_ZOOM),{animate:false});
   return;
  }
  if(action.kind!=='place')return;
  setUserLocation(action.location);
  try{localStorage.setItem(LOCATION_CHOICE_KEY,JSON.stringify(action.location));}catch{}
  setRadiusKm(DEFAULT_RADIUS);setLocationQuery(action.location.label);
 }
 async function searchLocation(){
  const q=locationQuery.trim();
  if(q.length<2){setLocationMessage('Ievadi vismaz 2 rakstzīmes.');return;}
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

 const today=rigaTodayIso(clockNow);
 const origin=userLocation&&userLocation.source!=='fallback'?userLocation:null;
 const nearby=useMemo(()=>nearbyGroups(activeEvents,today,origin),[activeEvents,today,origin]);
 const placeName=origin?(userLocation.label||'izvēlētā vieta'):'';
 const periodText=periodPhrase(periodMode,from,to);
 const summary=(periodText.charAt(0).toUpperCase()+periodText.slice(1))+
  (placeList.length?' · '+(areaFilter&&areaFilter!=='Citur'?areaFilter+', ':'')+placeList.join(', '):radiusKm>0&&origin?' · līdz '+radiusKm+' km no: '+placeName:origin?' · visa Latvija, attālums no: '+placeName:' · visa Latvija');
 // When nothing matches, offer the next wider search together with how many it would show.
 const wider=useMemo(()=>{
  if(activeEvents.length)return [];
  return widerOptions(origin?radiusKm:0,periodMode).map(option=>{
   const range=option.period?periodDates(option.period,today,publicTo,from,to):{from,to};
   const count=events.filter(e=>matchesWith(e,{radius:option.radius??radiusKm,from:range.from,to:range.to})).length;
   return {...option,count};
  }).filter(option=>option.count>0);
 },[activeEvents.length,origin,radiusKm,periodMode,today,publicTo,from,to,events,matchesWith]);
 const activeChips=[
  homeCategory&&{key:'category',label:HOME_CATEGORY_FILTERS[homeCategory].title,clear:clearHomeCategory},
  audience&&{key:'audience',label:AUDIENCE_FILTERS[audience],clear:()=>setDiscoveryFilter('audience','')},
  ...eventTypes.map(type=>({key:'type-'+type,label:quickTypes.find(t=>t.value===type)?.label||type,clear:()=>toggleEventType(type)})),
  competition&&{key:'competition',label:competitionOptions.find(c=>c.key===competition)?.name||'Turnīrs',clear:()=>setCompetition('')},
  category&&{key:'subcategory',label:category,clear:()=>setCategory('')},
  eventSearch&&{key:'q',label:'„'+eventSearch+'”',clear:()=>setEventSearch('')},
  price&&price!=='paid'&&{key:'price',label:{free:'Bezmaksas',paid:'Maksas',mixed:'Daļēji maksas',unknown:'Maksa nav zināma'}[price]||price,clear:()=>setPrice('')},
  municipality&&{key:'municipality',label:placeList.join(', '),clear:()=>setMunicipality('')},
  country&&{key:'country',label:countryLabel(country),clear:()=>setCountry('')},
  orgFilter&&{key:'org',label:'Rīkotājs: '+(orgName||'izvēlētais'),clear:()=>setOrgFilter('')}
 ].filter(Boolean);

 // A list item opens its place: on desktop in the panel with the map centred on it.
 function showOnMap(event){
  const marker=markerByEventRef.current.get(String(event.id));
  const group=locationGroups.find(g=>g.events.some(e=>String(e.id)===String(event.id)));
  setHighlightedId(String(event.id));
  if(!group){window.location.assign(eventPath(event));return;}
  setPlaceKey(group.key);
  if(!isPhone&&marker&&mapRef.current)mapRef.current.setView(marker.getLatLng(),Math.max(mapRef.current.getZoom(),CLUSTER_MAX_ZOOM),{animate:false});
 }
 const distanceFrom=useMemo(()=>origin?e=>{
  const lat=Number(e.latitude),lon=Number(e.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)?distanceKm(origin.lat,origin.lon,lat,lon):null;
 }:()=>null,[origin]);
 useEffect(()=>{setAreaMoved(false);},[userLocation,radiusKm]);
 function searchThisArea(){
  const map=mapRef.current;if(!map)return;
  const c=map.getCenter(),b=map.getBounds();
  const halfKm=Math.min(distanceKm(c.lat,c.lng,b.getNorth(),c.lng),distanceKm(c.lat,c.lng,c.lat,b.getEast()));
  setUserLocation({lat:c.lat,lon:c.lng,label:'kartes apgabals',source:'search'});
  setLocationQuery('');setLocationPrompt(false);
  setRadiusKm(radiusForView(halfKm));
 }
 function hoverEvent(event){
  hoveredMarkerRef.current?.getElement()?.classList.remove('is-hovered');
  const marker=event?shownMarkerRef.current.get(String(event.id)):null;
  marker?.getElement()?.classList.add('is-hovered');
  hoveredMarkerRef.current=marker||null;
 }

 // "Kur": a chosen local government wins over a centre point; nothing chosen means all of Latvia.
 const whereActive=Boolean(municipality||origin);
 const whereLabel=placeList.length?placeList[0]+(placeList.length>1?' +'+(placeList.length-1):''):origin?(userLocation.label+(radiusKm>0?' · '+radiusKm+' km':'')):'Visa Latvija';
 function clearWhere(){if(municipality)setMunicipality('');else chooseRiga();}
 function submitWhat(){setEventSearch(whatQuery.trim());setPanel('');}
 function pickSuggestedEvent(event){setPanel('');showOnMap(event);}
 // Suggestions stay inside the chosen local government, if there is one.
 const whatSuggestions=useMemo(()=>eventSuggestions(placeSet.size?events.filter(e=>placeSet.has(e.municipality)):events,whatQuery),[events,whatQuery,placeSet]);
 const closePanel=useCallback(()=>setPanel(''),[]);
 // On phones a panel covers the whole screen, above the list sheet and the bottom navigation.
 const onTop=node=>isPhone&&typeof document!=='undefined'?createPortal(node,document.body):node;
 // The heat map counts events under the current "Ko" filters, whatever place is chosen.
 const placeScopeEvents=useMemo(()=>panel==='where'?events.filter(e=>matchesWith(e,{radius:0,anyPlace:true})):[],[panel,events,matchesWith]);
 const heatCounts=useMemo(()=>municipalityCounts(placeScopeEvents),[placeScopeEvents]);
 const heatTopics=useMemo(()=>{
  const by=new Map();
  for(const e of placeScopeEvents){const g=eventGroup(e);if(!g||!HOME_CATEGORY_FILTERS[g])continue;const m=by.get(e.municipality)||new Map();m.set(g,(m.get(g)||0)+1);by.set(e.municipality,m);}
  return new Map([...by].map(([name,m])=>[name,[...m].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([g])=>HOME_CATEGORY_FILTERS[g].title)]));
 },[placeScopeEvents]);
 function openMunicipality(name){setMunicipality(name);setRadiusKm(0);setPanel('');}
 function toggleMunicipality(name){setPlaceList(list=>list.includes(name)?list.filter(x=>x!==name):[...list,name]);setRadiusKm(0);}
 usePanelDismiss(panel==='what',closePanel,whatPanelRef,whatButtonRef);
 usePanelDismiss(panel==='where',closePanel,wherePanelRef,whereButtonRef);

 const emptyState=<div className="nearby-empty" role="status">
  <strong>{radiusKm>0&&origin?'Šajā laikā līdz '+radiusKm+' km pasākumu nav.':'Šajos filtros pasākumu nav.'}</strong>
  {wider.length>0?<div className="nearby-empty-actions">{wider.map(option=><button key={option.label} type="button" className="button compact"
   onClick={()=>{if(option.radius!==undefined)setRadiusKm(option.radius);if(option.period)changePeriod(option.period);}}>
   {option.label} <span>({countLabel(option.count)})</span></button>)}</div>
   :<span>Pamēģini citu laiku vai noņem kādu filtru.</span>}
  {activeChips.length>0&&<button type="button" className="text-button" onClick={resetFilters}>Notīrīt filtrus</button>}
 </div>;

 return <>
  <div className="map-layout">
  <NearbyList groups={nearby} total={activeEvents.length} today={today} clock={rigaClockMinutes(clockNow)} summary={summary} loading={loading&&!events.length}
   favorites={favorites} highlightedId={highlightedId} onSelect={showOnMap} onHover={hoverEvent} onFavorite={toggleFavorite}
   onCalendar={calendarDownload} empty={emptyState} listRef={listRef} activeIds={activeIds} distance={distanceFrom} isAdmin={isAdminSession}
   place={!isPhone?openPlace:null} onClosePlace={()=>setPlaceKey('')} collapsed={locationPrompt}/>
  <div className="map-shell">
   <div className="map-controls map-controls-overlay msearch" aria-label="Meklēšana un filtri">
    <SearchBar whereLabel={whereLabel} whereActive={whereActive} onClearWhere={clearWhere} panel={panel} setPanel={setPanel}
     whatQuery={whatQuery} setWhatQuery={setWhatQuery} filterCount={filterCount} onSubmit={submitWhat}
     whereRef={whereButtonRef} whatRef={whatButtonRef} suggestions={whatSuggestions} onPickEvent={pickSuggestedEvent}
     formatWhen={e=>shortWhen(e,today)}/>

    {!panel&&placeList.length===1&&<NovadsCard name={placeList[0]} region={regionTitle(municipalityByName(placeList[0])?.region)}
     count={countLabel(novadsAreas.reduce((sum,g)=>sum+g.count,0))} areas={novadsAreas.filter(g=>g.name!=='Citur').slice(0,6)} area={areaFilter}
     onArea={chooseArea} onBack={()=>setPanel('where')} onClear={()=>setMunicipality('')}/>}

    {panel==='what'&&onTop(<WhatPanel portal={isPhone} panelRef={whatPanelRef} onClose={()=>setPanel('')} count={countLabel(activeEvents.length)}
     f={{category:homeCategory,audience,price,onlineOnly,showLong,eventTypes,competition,subcategory:category,country}}
     set={{category:v=>setDiscoveryFilter('category',v),audience:v=>setDiscoveryFilter('audience',v),price:setPrice,onlineOnly:setOnlineOnly,showLong:setShowLong,
      toggleType:toggleEventType,competition:v=>{setCompetition(v);setCategory('');},subcategory:setCategory,country:v=>{setCountry(v);setMunicipality('');}}}
     periodMode={periodMode} changePeriod={changePeriod} from={from} to={to} today={today} publicTo={publicTo} setFrom={setFrom} setTo={setTo} setPeriodMode={setPeriodMode}
     audienceOptions={audienceOptions} quickTypes={quickTypes} sourceCounts={sourceCounts} singleEventType={singleEventType} competitionOptions={competitionOptions}
     categories={categories} countries={countries} countryLabel={countryLabel} onReset={resetFilters} onlineCount={onlineCount}/>)}

    {panel==='where'&&onTop(<WherePanel portal={isPhone} panelRef={wherePanelRef} onClose={()=>setPanel('')} query={locationQuery} setQuery={v=>{setLocationQuery(v);setLocationResults([]);}}
     onSearch={searchLocation} searching={locationSearching} places={placeSuggestions(locationChoices,locationQuery)} results={locationResults}
     onPick={place=>{selectLocation(place);setPanel('');}} message={locationMessage} onLocate={()=>{useCurrentLocation();setPanel('');}}
     onWholeCountry={()=>{chooseRiga();setMunicipality('');setPanel('');}} origin={placeList.length?null:origin} radiusKm={radiusKm} setRadius={setRadiusKm} count={countLabel(activeEvents.length)}>
     {!locationQuery.trim()&&!locationResults.length&&<MunicipalityHeatmap counts={heatCounts} topics={heatTopics} selected={placeList}
      onOpen={openMunicipality} onToggle={toggleMunicipality} tapFirst={!canHover}/>}
    </WherePanel>)}

    {!panel&&<ChipScroller label="Kad" className="map-quick-scroller msearch-quick">
     <div className="map-segment map-segment-when" role="group" aria-label="Kad">
      {PERIODS.map(p=><button key={p.key} type="button" aria-pressed={periodMode===p.key} className={periodMode===p.key?'active':''} onClick={()=>changePeriod(p.key)}
       title={p.label}><span className="long">{p.label}</span><span className="short">{SHORT_PERIOD[p.key]||p.label}</span></button>)}
     </div>
    </ChipScroller>}
    {!panel&&periodMode==='manual'&&<div className="map-primary-manual-period">
     <input aria-label="Datums no" title="Datums no" type="date" min={today} max={to||publicTo||undefined} value={from} onChange={e=>{const value=e.target.value;setPeriodMode('manual');setFrom(value);if(!to||value>to)setTo(value);}}/>
     <span aria-hidden="true">–</span>
     <input aria-label="Datums līdz" title="Datums līdz" type="date" min={from||today} max={publicTo||undefined} value={to} onChange={e=>{setPeriodMode('manual');setTo(e.target.value);}}/>
    </div>}
    {!panel&&activeChips.filter(c=>c.key!=='q'&&c.key!=='municipality').length>0&&<div className="map-active-filters" aria-label="Aktīvie filtri">
     {activeChips.filter(c=>c.key!=='q'&&c.key!=='municipality').map(chip=><span key={chip.key} className="map-inline-filter-chip"><span>{chip.label}</span><button type="button" onClick={chip.clear} aria-label={'Noņemt filtru: '+chip.label}>×</button></span>)}
     <button type="button" className="text-button" onClick={resetFilters}>Notīrīt visu</button>
    </div>}
   </div>

   {locationMessage&&!locationPrompt&&<div className="map-location-message" role="status">{locationMessage}</div>}

   {locationPrompt&&locationResults.length===0&&<section className="map-location-prompt" aria-labelledby="map-location-prompt-title">
    <strong id="map-location-prompt-title">Kur meklēt pasākumus?</strong>
    <p>Parādīsim tuvākos pasākumus {DEFAULT_RADIUS} km rādiusā.</p>
    {locationMessage&&<p className="map-location-prompt-note" role="status">{locationMessage}</p>}
    <button type="button" className="button primary" onClick={useCurrentLocation}>
     <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
     Mana atrašanās vieta
    </button>
    <div className="map-city-chips" role="group" aria-label="Pilsētas">
     {CITIES.map(city=><button key={city.label} type="button" onClick={()=>selectLocation({...city,displayName:city.label})}>{city.label}</button>)}
    </div>
    <small>Cita vieta? Spied „Kur” meklētājā augšā.</small>
    <button type="button" className="text-button" onClick={chooseRiga}>Rādīt visu Latviju</button>
   </section>}

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

   {areaMoved&&!locationPrompt&&<button type="button" className="map-search-area" onClick={searchThisArea}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg> Meklēt šajā apgabalā
   </button>}

   <button type="button" className="map-list-jump" onClick={()=>listRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>
    Saraksts · {activeEvents.length}
   </button>

   <div className="map-legend map-legend-overlay" aria-label="Kartes leģenda">
    <span><i className="legend-dot today" aria-hidden="true"></i>Šodien</span>
    <span><i className="legend-dot tomorrow" aria-hidden="true"></i>Rīt</span>
    <span><i className="legend-dot future" aria-hidden="true"></i>2–15 d</span>
    <span><i className="legend-dot far" aria-hidden="true"></i>Pēc 15 d</span>
    <span><i className="legend-dot outside" aria-hidden="true"></i>Neatbilst filtriem (mazāka)</span>
    {mapMode!=='raster'&&<span className="map-style-switch">
     <button type="button" aria-expanded={styleMenuOpen} onClick={()=>setStyleMenuOpen(v=>!v)}>Kartes stils</button>
     {styleMenuOpen&&<span className="map-style-menu" role="group" aria-label="Kartes stils">
      {Object.entries(MAP_STYLES).map(([key,style])=><button key={key} type="button" aria-pressed={mapStyle===key} className={mapStyle===key?'active':''}
       onClick={()=>{setMapStyle(key);setStyleMenuOpen(false);}}>{style.label}</button>)}
     </span>}
    </span>}
   </div>
  </div>
  </div>

  {isPhone&&openPlace&&<MobileEventSheet group={openPlace} activeIds={activeIds} favorites={favorites} onFavorite={toggleFavorite} onCalendar={calendarDownload}
   onClose={()=>setPlaceKey('')} today={today} clock={rigaClockMinutes(clockNow)} distance={distanceFrom} isAdmin={isAdminSession}/>}
  {audience&&!loading&&!error&&activeEvents.length===0&&<p className="data-note" role="status">Izvēlētajai auditorijai šajā laikā un rādiusā nav pasākumu ar pārbaudītu piemērotību. Izvēlies citu auditoriju vai maini laiku un rādiusu.</p>}
  {homeCategory&&!audience&&!loading&&!error&&activeEvents.length===0&&<p className="data-note" role="status">
   {HOME_CATEGORY_FILTERS[homeCategory].emptyMessage||'Šajā kategorijā izvēlētajā laikā un rādiusā pasākumi nav atrasti. Maini datumu vai rādiusu, vai noņem kategorijas filtru.'}
  </p>}
  <div className="map-summary">
   <span>{countLabel(activeEvents.length)} · {activeGroupCount} {activeGroupCount%10===1&&activeGroupCount%100!==11?'vietā':'vietās'}</span>
   <button className="text-button" onClick={refresh} disabled={loading}>{loading?'Ielādē…':'Atjaunot datus'}</button>
   <button className="text-button" type="button" onClick={()=>{navigator.clipboard?.writeText(window.location.href).then(()=>setLocationMessage('Atlases saite nokopēta.'),()=>setLocationMessage('Nokopē saiti no pārlūka adreses joslas.'));}}>↗ Kopīgot atlasi</button>
   <a className="text-button" href={catalogHref}>Tabulas skats ↗</a>
  </div>
  {error&&<div className="error-message">{error}</div>}
 </>;
}

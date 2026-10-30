'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import MobileEventSheet from './mobile-event-sheet.jsx';
import NearbyList from './nearby-list.jsx';
import {PERIODS,RADII,DEFAULT_PERIOD,DEFAULT_RADIUS,periodKey,periodRange,periodPhrase,radiusLabel,nearbyGroups,widerOptions,countLabel,markerLabel} from '../../lib/map-nearby.js';
import {CLUSTER_MAX_ZOOM,clusterPoints,clusterTone,radiusForView} from '../../lib/map-cluster.js';
import {useAdminSession} from '../use-admin-session.js';
import {placeFromEvent} from '../../lib/location-follow.js';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS,AUDIENCE_FILTERS,audienceKey,matchesAudience,homeCategoryKey,matchesHomeCategory,sourceType} from '../../lib/home-category-filters.js';
import {groupedMapIcon} from '../../lib/event-map-icons.js';
import {useEvents} from '../../lib/use-events.js';
import {dateLabel,timeLabel,display} from '../../lib/catalog.js';
import {eventShareUrl,eventShareTargets,officialEventUrl} from '../../lib/event-sharing.js';
import {eventDateRangeLabel,eventDateState,groupDateTone,hasEventEnded,rigaClockMinutes,rigaTodayIso} from '../../lib/event-date.js';
import {addRasterLayer,enableMapLibre,hasWebGL,loadLeaflet,removeLayerSafe,requestedMapMode} from '../../lib/leaflet-runtime.js';

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

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function norm(v=''){return String(v).toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function markerTimeText(e,now){
 const state=eventDateState(e,rigaTodayIso(now),now);
 if(state.tone==='ended-today')return 'BEIDZIES?';
 return markerLabel(e,rigaTodayIso(now));
}
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
function shortDescription(value,limit=170){
 const text=String(value||'').replace(/\s+/g,' ').trim();
 if(!text)return '';
 if(text.length<=limit)return text;
 const cut=text.lastIndexOf(' ',limit);
 return text.slice(0,cut>limit/2?cut:limit).trimEnd()+'…';
}
function navigationLinksHtml(e){
 const accurate=!['municipality_center','settlement_center','unresolved','approximate'].includes(e.location_precision);
 const lat=Number(e.latitude),lon=Number(e.longitude);
 const hasPoint=accurate&&e.latitude!=null&&e.longitude!=null&&insideBalticView(lat,lon);
 const query=hasPoint?lat+','+lon:String(e.address_raw||e.venue_name||'').trim();
 if(!query)return '';
 const google='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
 const waze=hasPoint?'https://waze.com/ul?ll='+encodeURIComponent(lat+','+lon)+'&navigate=yes':'';
 return '<a class="popup-navigation-link" href="'+esc(google)+'" target="_blank" rel="noopener noreferrer" aria-label="Atvērt pasākuma maršrutu Google Maps">⌖ Maršruts</a>'+
   (waze?'<a class="popup-navigation-link" href="'+esc(waze)+'" target="_blank" rel="noopener noreferrer">Waze ↗</a>':'');
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
 if(state.tone==='ended-today')return 'BEIDZIES?';
 if(state.tone==='today')return 'ŠODIEN';
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
function popupActionIcon(name){
 const icons={
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
  list:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h10M8 14h10M5 9h.01M5 14h.01"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  external:'<path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  share:'<circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-5m-8 8 8 4"/>'
 };
 return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||'')+'</svg>';
}
function popupActionsHtml(e,favorites,editLink){
 const id=esc(e.id),saved=favorites.has(String(e.id));
 const official=officialEventUrl(e);
 const verified=!['municipality_center','settlement_center','unresolved','approximate'].includes(e.location_precision);
 const lat=Number(e.latitude),lon=Number(e.longitude);
 const hasPoint=verified&&e.latitude!=null&&e.longitude!=null&&insideBalticView(lat,lon);
 const query=hasPoint?lat+','+lon:String(e.address_raw||e.venue_name||'').trim();
 const google=query?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query):'';
 const waze=hasPoint?'https://waze.com/ul?ll='+encodeURIComponent(lat+','+lon)+'&navigate=yes':'';
 const shareUrl=eventShareUrl(e,window.location.origin);
 const targets=eventShareTargets(e,shareUrl);
 const favoriteLabel=saved?'Noņemt no saglabātajiem':'Saglabāt pasākumu';
 const button=(name,label,extra='',short=label)=>'<button type="button" class="meets-circle-action '+extra+'" data-event-id="'+id+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+popupActionIcon(name)+'<small class="meets-quiet-label">'+esc(short)+'</small></button>';
 const social=[['WhatsApp',targets.whatsapp],['Messenger',targets.messenger],
  ['Telegram',targets.telegram],['Facebook',targets.facebook],['X',targets.x]]
  .map(([name,url])=>'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(name)+'</a>').join('');
 return '<div class="popup-event-actions meets-event-action-grid meets-circle-actions" role="group" aria-label="Pasākuma darbības">'+
  '<button type="button" class="meets-circle-action popup-save-favorite" data-event-id="'+id+'" aria-label="'+favoriteLabel+'" title="'+favoriteLabel+'" aria-pressed="'+saved+'">'+popupActionIcon('heart')+'<small class="meets-quiet-label">Favorīts</small></button>'+
  button('calendar','Pievienot kalendāram','popup-save-calendar','Kalendārs')+
  (google?'<details class="meets-popup-route"><summary class="meets-circle-action" aria-label="Maršruts" title="Maršruts">'+popupActionIcon('pin')+'<small class="meets-quiet-label">Norādes</small></summary><div class="meets-event-action-choices"><a target="_blank" rel="noopener noreferrer" href="'+esc(google)+'">Google Maps ↗</a>'+(waze?'<a target="_blank" rel="noopener noreferrer" href="'+esc(waze)+'">Waze ↗</a>':'')+'</div></details>'
   :'<button type="button" class="meets-circle-action" disabled aria-label="Nav adreses maršrutam" title="Nav adreses maršrutam">'+popupActionIcon('pin')+'<small class="meets-quiet-label">Norādes</small></button>')+
  (official?'<a class="meets-circle-action" href="'+esc(official)+'" aria-label="Oficiālā pasākuma lapa" title="Oficiālā lapa" target="_blank" rel="noopener noreferrer">'+popupActionIcon('external')+'<small class="meets-quiet-label">Atvērt</small></a>'
   :'<span class="meets-circle-action disabled" aria-label="Nav oficiālās saites" title="Nav oficiālās saites">'+popupActionIcon('external')+'<small class="meets-quiet-label">Atvērt</small></span>')+
  button('share','Dalīties ar pasākumu','popup-share-event','Dalīties')+
  '</div><div class="meets-circle-options meets-popup-share-options" hidden>'+social+
  '<button type="button" class="popup-share-copy" data-event-id="'+id+'">Kopēt saiti ⧉</button></div>'+

  (editLink?'<div class="popup-admin-actions">'+editLink+'</div>':'');
}
function popupHtml(group,activeIds,isAdminSession,now,favorites){
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
  const description=String(e.description||'').replace(/\s+/g,' ').trim();
  const summary=shortDescription(description);
  const address=[e.address_raw,e.settlement||e.municipality].filter(Boolean).join(', ');
  const price=e.price_status&&e.price_status!=='unknown'?(e.price_text||display(e,'price_status')):'';
  return '<li class="'+rowClass+'">'+
   '<div class="popup-event-main">'+
    '<span class="event-date-badge event-date-badge-prominent '+esc(dateState.tone)+'" title="'+esc(dateState.label)+'">'+esc(popupDayLabel(dateState))+'</span>'+
    '<div class="popup-event-copy">'+
     '<strong>'+esc(e.title)+'</strong>'+
     '<span class="popup-event-datetime">'+esc(rangeLabel)+' · '+esc(timeLabel(e))+'</span>'+
     (address?'<span class="popup-event-address">'+esc(address)+'</span>':'')+
     (address?'<a class="meets-popup-venue-inline" href="/pasakumi/'+encodeURIComponent(e.id)+'">⌖ Sekot vietai ↗</a>':'')+
     (compactMeta?'<small>'+esc(compactMeta)+(country?' · '+esc(country):'')+(approximate?' · aptuvena lokācija':'')+'</small>':'')+
     (price?'<span class="popup-event-price">'+esc(price)+'</span>':'')+
     (description?'<div class="popup-description"><p class="popup-event-description">'+esc(summary)+'</p>'+
      (description.length>170?'<details><summary>Pilns apraksts</summary><p class="popup-event-description">'+esc(description)+'</p></details>':'')+'</div>':
      '<p class="popup-event-description popup-description-empty">Apraksts nav norādīts.'+(e.sources?.some(s=>s.url)?' Vairāk informācijas pasākuma avotā.':'')+'</p>')+
     popupActionsHtml(e,favorites,editLink)+
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
  ? '<details class="popup-other-events"'+(!activeCount?' open':'')+'><summary>Citi pasākumi šajā vietā ('+otherEvents.length+')</summary><p class="popup-other-note">Neatbilst pašreizējiem filtriem</p><ol class="popup-other-list">'+otherRows+'</ol></details>'
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

 const [eventTypes,setEventTypes]=useState(()=>searchParams.get('types')?.split(',').filter(x=>['municipality','lff','basketball','athletics'].includes(x))||[]);
 const [competition,setCompetition]=useState(searchParams.get('competition')||'');
 const [category,setCategory]=useState(searchParams.get('subcategory')||'');
 const [eventSearch,setEventSearch]=useState(searchParams.get('q')||'');
 const [price,setPrice]=useState(searchParams.get('price')||'');
 const [municipality,setMunicipality]=useState(searchParams.get('municipality')||'');
 const [country,setCountry]=useState(searchParams.get('country')||'');
 const [from,setFrom]=useState(searchParams.get('from')||'');
 const [to,setTo]=useState(searchParams.get('to')||'');
 // null until we know whether a place was chosen: then 30 km around it, otherwise all of Latvia.
 const [radiusKm,setRadiusKm]=useState(()=>{const q=searchParams.get('radius'),n=Number(q);return q!==null&&[0,5,10,25,30,50].includes(n)?n:null;});
 const [periodMode,setPeriodMode]=useState(()=>periodKey(searchParams.get('period')));
 const [locationPrompt,setLocationPrompt]=useState(false);
 const [highlightedId,setHighlightedId]=useState('');
 const [styleMenuOpen,setStyleMenuOpen]=useState(false);
 const listRef=useRef(null),hoveredMarkerRef=useRef(null),shownMarkerRef=useRef(new Map());
 const [areaMoved,setAreaMoved]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [mapStyle,setMapStyle]=useState(()=>Object.hasOwn(MAP_STYLES,searchParams.get('style'))?searchParams.get('style'):'positron');
 const [userLocation,setUserLocation]=useState(DEFAULT_LOCATION);

 const [favorites,setFavorites]=useState(()=>new Set());
 const [locationQuery,setLocationQuery]=useState('');
 const [locationResults,setLocationResults]=useState([]);
 const [locationMessage,setLocationMessage]=useState('');
 const [locationSearching,setLocationSearching]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [mapMode,setMapMode]=useState('loading');
 const [mapError,setMapError]=useState('');
 const [mobileGroupKey,setMobileGroupKey]=useState('');
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
   if(!known&&!searchParams.has('municipality')&&!searchParams.has('event')){
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
  const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MEETS//LV','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+encodeURIComponent(String(event.id))+'@meets.lv','DTSTAMP:'+now,dates,'SUMMARY:'+escapeIcs(event.title),'LOCATION:'+escapeIcs(location),'DESCRIPTION:'+escapeIcs(event.description||''),'URL:'+escapeIcs(url),'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
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
   from:periodMode==='manual'?from:'',to:periodMode==='manual'?to:'',style:mapStyle==='positron'?'':mapStyle};
  for(const [key,value] of Object.entries(state)){if(value)params.set(key,value);else params.delete(key);}
  if(['search','events','shared'].includes(userLocation?.source)&&insideBalticView(userLocation.lat,userLocation.lon)){
   params.set('lat',String(Number(userLocation.lat.toFixed(4))));
   params.set('lon',String(Number(userLocation.lon.toFixed(4))));
  }else{params.delete('lat');params.delete('lon');}
  const next=url.pathname+(params.size?'?'+params.toString():'')+url.hash;
  if(next!==window.location.pathname+window.location.search+window.location.hash)window.history.replaceState(null,'',next);
 },[radiusKm,periodMode,eventTypes,competition,category,eventSearch,price,municipality,country,from,to,mapStyle,userLocation]);


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

 const matchesWith=useMemo(()=>(e,{radius=radiusKm,from:start=from,to:end=to}={})=>{
  if(!matchesHomeCategory(e,homeCategory)||!matchesAudience(e,audience))return false;
  if(placeFilter&&placeFromEvent(e)?.key!==placeFilter)return false;
  if(eventTypeFilter&&e.event_type!==eventTypeFilter)return false;
  if(eventTypes.length&&!eventTypes.includes(sourceType(e)))return false;
  if(competition&&e.competition_key!==competition)return false;
  if(category&&e.primary_category!==category)return false;
  if(eventSearch&& !norm(e.title).includes(norm(eventSearch)))return false;
  if(price&&e.price_status!==price)return false;
  if(municipality&&e.municipality!==municipality)return false;
  if(country&&e.country_code!==country)return false;
  if(start&&(e.date_to||e.date_from)<start)return false;
  if(end&&e.date_from>end)return false;
  if(userLocation&&radius>0){
   const lat=Number(e.latitude),lon=Number(e.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
   if(distanceKm(userLocation.lat,userLocation.lon,lat,lon)>radius)return false;
  }
  return true;
 },[homeCategory,audience,placeFilter,eventTypeFilter,eventTypes,competition,category,eventSearch,price,municipality,country,from,to,userLocation,radiusKm]);
 const matchesEvent=useMemo(()=>e=>matchesWith(e),[matchesWith]);

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
  if(municipality)params.set('municipality',municipality);
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
 const mobileSheetGroup=useMemo(()=>locationGroups.find(g=>g.key===mobileGroupKey)||null,[locationGroups,mobileGroupKey]);
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
    map.createPane('activeMarkers');map.getPane('activeMarkers').style.zIndex='490';
    if(map.getPane('popupPane'))map.getPane('popupPane').style.zIndex='920';
    leafletRef.current=L;
    mapRef.current=map;
    // Only a drag by the visitor offers "Meklēt šajā apgabalā", not our own zooming.
    map.on('dragend',()=>setAreaMoved(true));

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
  markerByEventRef.current=new Map();
  const built=[];
  for(const group of locationGroups){
   const [displayLat,displayLon]=groupPosition(group,indexByCoordinate);
   const activeInGroup=group.events.filter(e=>activeIds.has(e.id));
   const isActive=activeInGroup.length>0;
   const chosenEvents=isActive?activeInGroup:group.events;
   const nearest=closestFirst(chosenEvents)[0]||chosenEvents[0];
   const {glyph,label:typeLabel}=groupedMapIcon(chosenEvents);
   const dateState=eventDateState(nearest,rigaTodayIso(clockNow),clockNow);
   const dateTone=dateState.tone;
   const shownCount=isActive?activeInGroup.length:group.events.length;
   const grouped=shownCount>1;
   const dimmed=!isActive;
   const size=dimmed?44:58;
   const timeText=markerTimeText(nearest,clockNow);
   const html='<span class="event-drop-marker '+esc(dateTone)+(dimmed?' dimmed':'')+'" title="'+esc(typeLabel)+' · '+esc(timeText)+'">'+
     '<span class="event-drop-time">'+esc(timeText)+'</span>'+
     '<span class="event-drop-icon" aria-hidden="true">'+esc(glyph)+'</span>'+
     (grouped?'<span class="event-drop-count">'+shownCount+'</span>':'')+
   '</span>';
   const icon=L.divIcon({className:'event-drop-marker-wrap',html,iconSize:[size,size+12],iconAnchor:[size/2,size+10]});
   const marker=L.marker([displayLat,displayLon],{icon,pane:isActive?'activeMarkers':'backgroundMarkers',keyboard:isActive,title:typeLabel});
   const viewportWidth=typeof window!=='undefined'?window.innerWidth:1366;
   const isMobileViewport=viewportWidth<=700;
   const controlsHeight=mapEl.current?.parentElement?.querySelector('.map-controls-overlay')?.getBoundingClientRect().height||118;
   const popupTopPadding=isMobileViewport?18:controlsHeight+16;
   const popupMaxWidth=Math.min(430,Math.max(220,map.getSize().x-64));
   const popupMaxHeight=Math.max(180,Math.min(isMobileViewport?420:520,map.getSize().y-popupTopPadding-64,window.innerHeight-160));
   // Keep the same DOM nodes when Leaflet updates the popup dimensions, so
   // native details retain their expanded state instead of being recreated.
   const popupContent=document.createElement('div');
   popupContent.innerHTML=popupHtml(group,activeIds,isAdminSession,clockNow,favorites);
   marker.bindPopup(popupContent,{
    className:'meets-event-popup',
    minWidth:popupMaxWidth,
    maxWidth:popupMaxWidth,
    maxHeight:popupMaxHeight,
    autoPan:true,
    keepInView:true,
    autoPanPaddingTopLeft:[isMobileViewport?14:28,popupTopPadding],
    autoPanPaddingBottomRight:isMobileViewport?[14,18]:[28,32]
   });
   marker.on('click',()=>{
    setHighlightedId(String(nearest?.id||''));
    setLocationPrompt(false);
    setFiltersOpen(false);
    setLocationResults([]);
    setLocationMessage('');
   });
   const updatePopup=()=>{
    const popup=marker.getPopup();
    if(!popup?.isOpen?.())return;
    const scrollContainer=popup.getElement()?.querySelector('.leaflet-popup-content');
    const scrollTop=scrollContainer?.scrollTop||0;
    popup.update();
    if(scrollContainer)scrollContainer.scrollTop=scrollTop;
   };
   marker.on('popupopen',()=>{
    if(window.innerWidth<=700){
     marker.closePopup();
     setMobileGroupKey(group.key);
     return;
    }
    // Leaflet auto-pans only when the popup opens, before it is resized here or
    // grows upwards (share options), so it could end up under the filter overlay.
    const keepClearOfControls=()=>{
     const overlayBottom=mapEl.current?.parentElement?.querySelector('.map-controls-overlay')?.getBoundingClientRect().bottom;
     const popupTop=marker.getPopup()?.getElement()?.getBoundingClientRect().top;
     if(Number.isFinite(overlayBottom)&&Number.isFinite(popupTop)&&popupTop<overlayBottom+12){
      map.panBy([0,popupTop-overlayBottom-12],{animate:false});
     }
    };
    const actions=async event=>{
     const button=event.target.closest('button[data-event-id]');
     if(!button)return;
     const item=group.events.find(e=>String(e.id)===button.dataset.eventId);
     if(!item)return;
     if(button.classList.contains('popup-save-calendar')){calendarDownload(item);return;}
     if(button.classList.contains('popup-save-favorite')){
      toggleFavorite(item.id);
      const selected=button.getAttribute('aria-pressed')!=='true';
      button.setAttribute('aria-pressed',String(selected));
      const label=selected?'Noņemt no saglabātajiem':'Saglabāt pasākumu';
      button.setAttribute('aria-label',label);button.title=label;
      return;
     }
     const panel=button.closest('.popup-event-copy')?.querySelector('.meets-popup-share-options');
     if(button.classList.contains('popup-share-event')){
      const url=eventShareUrl(item,window.location.origin);
      if(navigator.share){
       try{await navigator.share({title:item.title||'MEETS pasākums',url});if(panel)panel.hidden=true;return;}
       catch(e){if(e?.name==='AbortError')return;}
      }
      if(panel)panel.hidden=!panel.hidden;
      marker.getPopup()?.update();keepClearOfControls();
      return;
     }
     if(button.classList.contains('popup-share-copy')){
      const url=eventShareUrl(item,window.location.origin);
      try{await navigator.clipboard.writeText(url);if(panel){panel.hidden=true;}}
      catch{if(panel){const hint=document.createElement('span');hint.textContent='Kopē saiti: '+url;panel.appendChild(hint);}}
     }
    };
    if(popupContent._actionHandler)popupContent.removeEventListener('click',popupContent._actionHandler);
    popupContent._actionHandler=actions;
    popupContent.addEventListener('click',actions);
    const popup=marker.getPopup();
    const mobile=window.innerWidth<=700;
    const width=Math.min(430,Math.max(220,map.getSize().x-64));
    const topPadding=mobile?18:(mapEl.current?.parentElement?.querySelector('.map-controls-overlay')?.getBoundingClientRect().height||118)+16;
    const maxHeight=Math.max(180,Math.min(mobile?420:520,map.getSize().y-topPadding-64,window.innerHeight-160));
    const resized=popup.options.maxWidth!==width||popup.options.maxHeight!==maxHeight;
    popup.options.minWidth=width;
    popup.options.maxWidth=width;
    popup.options.maxHeight=maxHeight;
    popup.options.autoPanPaddingTopLeft=[mobile?14:28,topPadding];
    popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label','Aizvērt pasākumu logu');
    popup.getElement()?.addEventListener('toggle',updatePopup,true);
    if(resized)popup.update();
    keepClearOfControls();
   });
   marker.on('popupclose',()=>marker.getPopup()?.getElement()?.removeEventListener('toggle',updatePopup,true));
   for(const e of group.events)markerByEventRef.current.set(String(e.id),marker);
   built.push({marker,isActive,events:group.events,latlng:[displayLat,displayLon],tone:dateTone,count:shownCount});
  }

  // Below CLUSTER_MAX_ZOOM nearby places join into one bubble with a count.
  const layout=()=>{
   active.clearLayers();bg.clearLayers();
   const shown=new Map();
   const place=(item,marker)=>{marker.addTo(item.isActive?active:bg);for(const e of item.events)shown.set(String(e.id),marker);};
   if(map.getZoom()>=CLUSTER_MAX_ZOOM){for(const item of built)place(item,item.marker);shownMarkerRef.current=shown;return;}
   const points=built.map((item,i)=>{const p=map.latLngToLayerPoint(item.latlng);return {i,x:p.x,y:p.y,weight:item.count,layer:item.isActive?'active':'other'};});
   for(const cluster of clusterPoints(points,52)){
    const items=cluster.members.map(m=>built[m.i]);
    if(items.length===1){place(items[0],items[0].marker);continue;}
    const isActive=items[0].isActive,count=items.reduce((sum,item)=>sum+item.count,0);
    const bounds=L.latLngBounds(items.map(item=>item.latlng));
    const size=count>=100?54:count>=10?46:40;
    const icon=L.divIcon({className:'map-cluster-wrap',iconSize:[size,size],iconAnchor:[size/2,size/2],
     html:'<span class="map-cluster '+clusterTone(items.map(item=>item.tone))+(isActive?'':' dimmed')+'" style="width:'+size+'px;height:'+size+'px"><b>'+count+'</b></span>'});
    const bubble=L.marker(bounds.getCenter(),{icon,pane:isActive?'activeMarkers':'backgroundMarkers',keyboard:isActive,title:countLabel(count)+' · pietuvināt'});
    bubble.on('click',()=>map.fitBounds(bounds.pad(.35),{maxZoom:CLUSTER_MAX_ZOOM,animate:true}));
    for(const item of items)place(item,bubble);
   }
   shownMarkerRef.current=shown;
  };
  layout();
  map.on('zoomend',layout);
  return()=>{map.off('zoomend',layout);};
 },[mapReady,locationGroups,activeIds,isAdminSession,clockNow,favorites]);

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
   map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:13,animate:false});
  }else{
   if(userLocation.source==='fallback')map.fitBounds([[54.5,19.5],[59.5,29.5]],{animate:false,padding:[25,25]});
   else map.setView(center,11,{animate:false});
  }
 },[mapReady,userLocation,radiusKm]);

 useEffect(()=>{
  if(focusOpenedRef.current||!focusEventId||!mapReady||!mapRef.current)return;
  // Wait until the event's own dates are applied, so the marker is not rebuilt right after opening.
  if(!activeIds.has(focusEventId)&&periodMode!=='manual')return;
  const marker=markerByEventRef.current.get(focusEventId);
  if(!marker)return;
  focusOpenedRef.current=true;
  mapRef.current.setView(marker.getLatLng(),14,{animate:false});
  marker.openPopup();
 },[mapReady,locationGroups,activeIds,focusEventId,periodMode]);

 useEffect(()=>()=>{mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;},[]);

 // Radius, period, group and audience are visible outside the panel, so the badge skips them.
 // Everything inside "Vairāk filtru"; time, distance and the chip rows are visible outside it.
 const advancedFilterCount=[placeFilter,audience,eventTypes.length>0,competition,category,eventSearch,price&&price!=='free',country,municipality].filter(Boolean).length;
 const audienceOptions=Object.entries(AUDIENCE_FILTERS).filter(([key])=>key===audience||events.some(e=>matchesAudience(e,key)));
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
  const filterToday=rigaTodayIso(clockNow);
  const next=periodDates(value,filterToday,publicTo,from,to);
  setFrom(next.from);setTo(next.to);
 }
 function resetFilters(){
  const params=new URLSearchParams(searchParams.toString());params.delete('category');params.delete('audience');params.delete('event_type');params.delete('place');
  router.push(pathname+(params.size?'?'+params.toString():''),{scroll:false});
  setEventTypes([]);setCompetition('');setCategory('');setEventSearch('');setPrice('');setMunicipality('');setCountry('');setRadiusKm(userLocation.source==='fallback'?0:DEFAULT_RADIUS);setPeriodMode(DEFAULT_PERIOD);
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
  const chosen={lat:Number(place.latitude),lon:Number(place.longitude),label:place.label||place.displayName,source:place.local?'events':'search'};
  setUserLocation(chosen);
  if(place.eventTitle)setEventSearch(place.eventTitle);
  else try{localStorage.setItem(LOCATION_CHOICE_KEY,JSON.stringify(chosen));}catch{}
  setRadiusKm(DEFAULT_RADIUS);setLocationQuery(place.eventTitle||place.label||place.displayName);setLocationResults([]);setLocationMessage('');setLocationPrompt(false);
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

 const today=rigaTodayIso(clockNow);
 const origin=userLocation&&userLocation.source!=='fallback'?userLocation:null;
 const nearby=useMemo(()=>nearbyGroups(activeEvents,today,origin),[activeEvents,today,origin]);
 const placeName=origin?(userLocation.label||'izvēlētā vieta'):'';
 const periodText=periodPhrase(periodMode,from,to);
 const summary=(periodText.charAt(0).toUpperCase()+periodText.slice(1))+
  (radiusKm>0&&origin?' · līdz '+radiusKm+' km no: '+placeName:origin?' · visa Latvija, attālums no: '+placeName:' · visa Latvija');
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
  price&&price!=='free'&&{key:'price',label:{paid:'Maksas',mixed:'Daļēji maksas',unknown:'Maksa nav zināma'}[price]||price,clear:()=>setPrice('')},
  municipality&&{key:'municipality',label:municipality,clear:()=>setMunicipality('')},
  country&&{key:'country',label:countryLabel(country),clear:()=>setCountry('')}
 ].filter(Boolean);

 function showOnMap(event){
  const marker=markerByEventRef.current.get(String(event.id));
  setHighlightedId(String(event.id));
  if(window.innerWidth<=1000){
   const group=locationGroups.find(g=>g.events.some(e=>String(e.id)===String(event.id)));
   if(group){setMobileGroupKey(group.key);return;}
   window.location.assign('/pasakumi/'+encodeURIComponent(event.id));
   return;
  }
  if(!marker||!mapRef.current){window.location.assign('/pasakumi/'+encodeURIComponent(event.id));return;}
  mapRef.current.setView(marker.getLatLng(),Math.max(mapRef.current.getZoom(),CLUSTER_MAX_ZOOM),{animate:false});
  marker.openPopup();
 }
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
   empty={emptyState} listRef={listRef}/>
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
       placeholder={userLocation.source==='fallback'?'Pilsēta, adrese vai pasākums…':'Meklēt vietu vai pasākumu…'}
       aria-label="Meklēt vietu vai pasākumu"
      />
      <button type="button" className="map-search-button" onClick={searchLocation} disabled={locationSearching} title="Meklēt" aria-label="Meklēt">
       {locationSearching?'…':<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>}
      </button>
      <button type="button" className={'map-control-button filters-button'+(filtersOpen?' active':'')} onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen} aria-label="Vairāk filtru" title="Vairāk filtru">
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>
       {advancedFilterCount>0&&<span className="filter-count">{advancedFilterCount}</span>}
      </button>
      <datalist id="meets-location-options">{locationChoices.map(x=><option key={x.id} value={x.label}/>)}</datalist>
     </div>
    </div>

    <div className="map-chip-row" role="group" aria-label="Kad">
     {PERIODS.map(p=><button key={p.key} type="button" aria-pressed={periodMode===p.key} className={periodMode===p.key?'active':''} onClick={()=>changePeriod(p.key)}>{p.label}</button>)}
    </div>
    {periodMode==='manual'&&<div className="map-primary-manual-period">
     <input aria-label="Datums no" title="Datums no" type="date" min={today} max={to||publicTo||undefined} value={from} onChange={e=>{const value=e.target.value;setPeriodMode('manual');setFrom(value);if(!to||value>to)setTo(value);}}/>
     <span aria-hidden="true">–</span>
     <input aria-label="Datums līdz" title="Datums līdz" type="date" min={from||today} max={publicTo||undefined} value={to} onChange={e=>{setPeriodMode('manual');setTo(e.target.value);}}/>
    </div>}
    <div className="map-chip-row" role="group" aria-label="Cik tālu">
     {RADII.map(km=><button key={km} type="button" aria-pressed={radiusKm===km} className={radiusKm===km?'active':''}
      onClick={()=>{if(km>0&&!origin){setLocationPrompt(true);setLocationMessage('Vispirms izvēlies vietu, no kuras skaitīt attālumu.');return;}setRadiusKm(km);}}>{radiusLabel(km)}</button>)}
    </div>
    <div className="map-chip-row map-chip-row-what" role="group" aria-label="Ko darīt">
     {HOME_GROUP_KEYS.map(key=><button key={key} type="button" aria-pressed={homeCategory===key} className={homeCategory===key?'active':''}
      onClick={()=>setDiscoveryFilter('category',homeCategory===key?'':key)}><span aria-hidden="true">{HOME_CATEGORY_FILTERS[key].icon}</span> {HOME_CATEGORY_FILTERS[key].title}</button>)}
     <button type="button" aria-pressed={price==='free'} className={price==='free'?'active':''} onClick={()=>setPrice(price==='free'?'':'free')}>Bezmaksas</button>
    </div>
    {activeChips.filter(c=>c.key!=='category').length>0&&<div className="map-active-filters" aria-label="Aktīvie filtri">
     {activeChips.filter(c=>c.key!=='category').map(chip=><span key={chip.key} className="map-inline-filter-chip"><span>{chip.label}</span><button type="button" onClick={chip.clear} aria-label={'Noņemt filtru: '+chip.label}>×</button></span>)}
     <button type="button" className="text-button" onClick={resetFilters}>Notīrīt visu</button>
    </div>}

    {filtersOpen&&<div className="map-advanced-panel" role="dialog" aria-label="Vairāk filtru">
     <div className="map-filter-head">
      <strong>Vairāk filtru</strong>
      <button type="button" className="map-filter-close" onClick={()=>setFiltersOpen(false)} aria-label="Aizvērt filtrus">×</button>
     </div>

     {audienceOptions.length>0&&<label className="map-filter-field"><span>Kam piemērots?</span><select aria-label="Auditorija" value={audience} onChange={e=>setDiscoveryFilter('audience',e.target.value)}>
      <option value="">Jebkura auditorija</option>
      {audienceOptions.map(([key,title])=><option key={key} value={key}>{title}</option>)}
     </select></label>}

     <fieldset className="map-type-options">
      <legend>Sporta līgas un avoti</legend>
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

     <button className="map-reset-button" type="button" onClick={resetFilters}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1-8.5L4 10"/></svg>
      Atiestatīt filtrus
     </button>
    </div>}
   </div>

   {locationResults.length>0&&<div className="map-location-results" role="group" aria-label="Atrastas vietas">
    {locationResults.map(place=><button key={place.id||place.displayName} type="button" onClick={()=>selectLocation(place)}>
     <strong>{place.label||place.displayName}</strong><span>{place.displayName||place.label}</span>
    </button>)}
   </div>}
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
    <small>Cita vieta? Ieraksti to meklēšanas laukā augšā.</small>
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
    <span><i className="legend-dot future" aria-hidden="true"></i>Vēlāk</span>
    <span><i className="legend-dot outside" aria-hidden="true"></i>Neatbilst filtriem</span>
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

  {mobileSheetGroup&&<MobileEventSheet group={mobileSheetGroup} activeIds={activeIds} favorites={favorites} onFavorite={toggleFavorite} onCalendar={calendarDownload} onClose={()=>setMobileGroupKey('')}/>}
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

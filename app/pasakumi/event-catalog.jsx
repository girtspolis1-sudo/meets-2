'use client';
import Icon from '../components/line-icon.jsx';
import {track} from '../../lib/analytics.js';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {columns,display,filterEventsByColumns,prices} from '../../lib/catalog.js';
import {useEvents} from '../../lib/use-events.js';
import EventQuickActions from '../components/event-quick-actions.jsx';
import DiscoveryEventCard from '../components/discovery-event-card.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';
import CategoryIcon from '../components/category-icon.jsx';
import {WhatPanel,LevelSwitch,usePanelDismiss} from '../karte/map-search.jsx';
import {placeFromEvent,placesFromEvents} from '../../lib/location-follow.js';
import {rigaTodayIso,rigaClockMinutes,addIsoDays} from '../../lib/event-date.js';
import {AUDIENCE_FILTERS,HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS,SOURCE_TYPE_LABELS,SPORT_TYPES,eventGroup,matchesAudience,sourceType} from '../../lib/home-category-filters.js';
import {DEFAULT_LEVEL,LEVEL_CHIPS,levelKey,matchesLevel} from '../../lib/sport-level.js';
import {DEFAULT_RADIUS,RADII,countLabel,dayHeading,periodRange} from '../../lib/map-nearby.js';
import {whatFilterCount} from '../../lib/map-search.js';
import {isOver,listDay,splitForList} from '../../lib/catalog-list.js';
import {NEAR_PLACES,distanceKm,nearPlace,withinRadius} from '../../lib/event-calendar.js';
import {eventPath} from '../../lib/seo.js';
import EventCalendar from './event-calendar.jsx';

// The same time windows as the map.
const PERIOD_CHIPS=[['all','Visi'],['today','Šodien'],['tomorrow','Rīt'],['weekend','Brīvdienās'],['7days','7 dienas'],['30days','30 dienas']];
const PERIODS=new Set(PERIOD_CHIPS.map(([key])=>key));
// Older shared links used other names.
const LEGACY_PERIODS={'3days':'7days',week:'7days',month:'30days'};
const CARD_PAGE=40;
// The table stays reachable by old ?view=table links; the switch offers the list
// and the calendar, and the result line offers the Excel file.
const VIEWS=[['cards','Saraksts'],['calendar','Kalendārs']];
// The public table: no review status, no map point column.
const TABLE_COLUMNS=columns.filter(([key])=>!['status','map_status'].includes(key));
const GROUPS=HOME_GROUP_KEYS.map(key=>({key,...HOME_CATEGORY_FILTERS[key]}));
const LOCATION_CHOICE_KEY='meets_location_choice_v1';

const pageSize=50;
const mobileFilterKeys=new Set(['date_from','title','municipality','primary_category','price_status']);

// "1 pasākums", "21 pasākums", "2 pasākumi", "11 pasākumi" (Latvian plural follows the last digit).
// The big number already shows the day of the month, so the label beside it
// names the day ("Šodien, pirmdiena") and the line below names the month.
const dayFormat=(options)=>new Intl.DateTimeFormat('lv',{timeZone:'UTC',...options});
function dayParts(day,today){
 const date=new Date(day+'T12:00:00Z');
 if(Number.isNaN(date.getTime()))return null;
 const weekday=dayFormat({weekday:'long'}).format(date).toLocaleLowerCase('lv');
 const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+864e5).toISOString().slice(0,10);
 const prefix=day===today?'Šodien, ':day===tomorrow?'Rīt, ':'';
 return {number:date.getUTCDate(),label:prefix+(prefix?weekday:weekday.charAt(0).toUpperCase()+weekday.slice(1)),month:dayFormat({month:'long'}).format(date)};
}

function eventCountLabel(n){
 const count=Number(n)||0;
 const word=count===0?'pasākumu':count%10===1&&count%100!==11?'pasākums':'pasākumi';
 return count+' '+word;
}

// fallback = the server-rendered nearest events, shown until the catalogue loads here.
export default function EventCatalog({fallback=null}){
 const {data,loading,error,refresh}=useEvents();
 const [columnFilters,setColumnFilters]=useState({});
 const [page,setPage]=useState(0);
 const [sort,setSort]=useState('date_from');
 const [direction,setDirection]=useState(1);
 const [exporting,setExporting]=useState(false);
 const [exportStatus,setExportStatus]=useState('');
 const [viewMode,setViewMode]=useState('cards');
 const [period,setPeriod]=useState('all');
 const [shared,setShared]=useState({});
 const [sharedOrigin,setSharedOrigin]=useState(null);
 const [placeFilter,setPlaceFilter]=useState('');
 const [shown,setShown]=useState(CARD_PAGE);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [showLong,setShowLong]=useState(false);
 const [onlineOnly,setOnlineOnly]=useState(false);
 const [isPhone,setIsPhone]=useState(false);
 const filtersRef=useRef(null),filtersButtonRef=useRef(null);
 useEffect(()=>{
  const query=window.matchMedia('(max-width:760px)');
  const update=()=>setIsPhone(query.matches);update();
  query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update);
 },[]);
 usePanelDismiss(filtersOpen,()=>setFiltersOpen(false),filtersRef,filtersButtonRef);
 // Sports competition level (?level=all|youth); adults by default, as on the map.
 const [level,setLevel]=useState(DEFAULT_LEVEL);
 const [nearMessage,setNearMessage]=useState('');
 // Minutes in Riga, so today's events drop off the list once they are over.
 const [clock,setClock]=useState(()=>rigaClockMinutes());
 useEffect(()=>{const t=setInterval(()=>setClock(rigaClockMinutes()),60000);return()=>clearInterval(t);},[]);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  setPlaceFilter(p.get('place')||'');
  setLevel(levelKey(p.get('level')));
  setOnlineOnly(p.get('online')==='1');
  if(['calendar','table'].includes(p.get('view')))setViewMode(p.get('view'));
  const filters={};
  for(const [from,to] of [['q','title'],['price','price_status'],['municipality','municipality'],['country','country_code'],['subcategory','primary_category'],['type','event_type']]){
   if(p.get(from))filters[to]=p.get(from);
  }
  setColumnFilters(filters);
  const chosen=LEGACY_PERIODS[p.get('period')]||p.get('period');
  setPeriod(PERIODS.has(chosen)?chosen:'all');
  const radius=Number(p.get('radius')||0);
  setShared({
   group:p.get('category')||'',
   audience:p.get('audience')||'',
   types:(p.get('types')||'').split(',').filter(Boolean),
   competition:p.get('competition')||'',
   radius:Number.isFinite(radius)&&radius>=0&&radius<=100?radius:0,
   from:p.get('from')||'',to:p.get('to')||''
  });
  if(p.has('lat')&&p.has('lon')){
   const lat=Number(p.get('lat')),lon=Number(p.get('lon'));
   if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=53.5&&lat<=60.8&&lon>=16&&lon<=31.5){
    setSharedOrigin({lat,lon});return;
   }
  }
  try{
   const raw=JSON.parse(localStorage.getItem('meets_location_choice_v1')||'null');
   if(Number.isFinite(raw?.lat)&&Number.isFinite(raw?.lon))setSharedOrigin(raw);
  }catch{}
 },[]);

 // Filters are kept in the address, so a search can be shared and survives going back.
 const urlReady=useRef(false);
 useEffect(()=>{
  if(!urlReady.current){urlReady.current=true;return;}
  const url=new URL(window.location.href);
  const set=(key,value)=>value?url.searchParams.set(key,value):url.searchParams.delete(key);
  set('q',columnFilters.title);set('municipality',columnFilters.municipality);set('type',columnFilters.event_type);
  set('price',columnFilters.price_status);set('period',period==='all'?'':period);set('place',placeFilter);
  set('view',viewMode==='cards'?'':viewMode);
  set('level',level===DEFAULT_LEVEL?'':level);
  set('category',shared.group);set('audience',shared.audience);set('types',(shared.types||[]).join(','));
  set('competition',shared.competition);set('subcategory',columnFilters.primary_category);set('country',columnFilters.country_code);
  set('online',onlineOnly?'1':'');
  // A town and radius go in the address; the browser's own position does not.
  const near=shared.radius>0&&sharedOrigin;
  set('radius',near?String(shared.radius):'');
  set('lat',near&&sharedOrigin.source!=='browser'?String(Number(sharedOrigin.lat.toFixed(4))):'');
  set('lon',near&&sharedOrigin.source!=='browser'?String(Number(sharedOrigin.lon.toFixed(4))):'');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 },[columnFilters,period,placeFilter,viewMode,shared,sharedOrigin,level,onlineOnly]);

 const allRows=data?.events||[];
 // Youth competitions are out of the list, the calendar, the table and every count unless chosen.
 const rows=useMemo(()=>allRows.filter(event=>matchesLevel(event,level)),[allRows,level]);
 const availablePlaces=useMemo(()=>placesFromEvents(rows),[rows]);
 const options=useMemo(()=>({
  municipalities:[...new Set(rows.map(event=>event.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),
  countries:[...new Set(rows.map(event=>event.country_code).filter(Boolean))].sort(),
  prices:[...new Set(rows.map(event=>event.price_status).filter(Boolean))].sort(),
  eventTypes:[...new Set(rows.map(event=>event.event_type).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'lv'))
 }),[rows]);

 // Every filter except the time window: the calendar picks its own days.
 const matching=useMemo(()=>{
 const query=String(columnFilters.title||'').trim().toLocaleLowerCase('lv');
 const otherFilters={...columnFilters};
 delete otherFilters.title;
 return filterEventsByColumns(rows,otherFilters).filter(event=>{
  if(query&&![event.title,event.venue_name,event.address_raw,event.settlement,event.municipality]
   .some(value=>String(value||'').toLocaleLowerCase('lv').includes(query)))return false;
  if(placeFilter&&placeFromEvent(event)?.key!==placeFilter)return false;
  if(shared.group&&eventGroup(event)!==shared.group)return false;
  // Council and committee meetings only when that group is chosen, as on the map and the home page.
  if(!shared.group&&eventGroup(event)==='civic')return false;
  if(shared.audience&&!matchesAudience(event,shared.audience))return false;
  if(shared.types?.length&&!shared.types.includes(sourceType(event)))return false;
  if(shared.competition&&event.competition_key!==shared.competition)return false;
  if(onlineOnly&&!['online','hybrid'].includes(event.attendance_mode))return false;
  if(shared.from&&String(event.date_to||event.date_from||'')<shared.from)return false;
  if(shared.to&&String(event.date_from||'')>shared.to)return false;
  if(shared.radius>0&&!withinRadius(event,sharedOrigin||nearPlace('riga'),shared.radius))return false;
  return true;
 });
 },[rows,columnFilters,shared,sharedOrigin,placeFilter,onlineOnly]);
 const filtered=useMemo(()=>{
 return matching.filter(event=>{
  if(period==='all')return true;
  const today=rigaTodayIso(),range=periodRange(period,today);
  return String(event.date_from||'')<=range.to&&String(event.date_to||event.date_from||'')>=range.from;
 }).sort((a,b)=>{
  const av=sort==='date_from'?a.date_from:display(a,sort);
  const bv=sort==='date_from'?b.date_from:display(b,sort);
  if(!av)return bv?1:0;
  if(!bv)return -1;
  return String(av).localeCompare(String(bv),'lv',{numeric:true})*direction||a.id.localeCompare(b.id);
 });
 },[matching,sort,direction,period]);

 const today=rigaTodayIso();
 // Cards: what is still ahead, today's events by start time; long exhibitions apart.
 const listed=useMemo(()=>{
  const split=splitForList(filtered,today,clock);
  if(sort!=='date_from')split.current=filtered.filter(event=>split.current.includes(event));
  return split;
 },[filtered,today,clock,sort]);
 // The calendar counts what is still ahead, whatever the time chips say.
 const calendarSplit=useMemo(()=>splitForList(matching,today,clock),[matching,today,clock]);
 const tableRows=useMemo(()=>filtered.filter(event=>!isOver(event,today,clock)),[filtered,today,clock]);
 const dayCounts=useMemo(()=>{const counts=new Map();for(const event of listed.current){const day=listDay(event,today);counts.set(day,(counts.get(day)||0)+1);}return counts;},[listed,today]);
 const pages=Math.max(1,Math.ceil(tableRows.length/pageSize));
 const current=Math.min(page,pages-1);
 const visible=tableRows.slice(current*pageSize,(current+1)*pageSize);
 const cards=listed.current.slice(0,shown);
 const activeFilterCount=Object.values(columnFilters).filter(value=>String(value||'').trim()).length;

 function changeColumn(key,value){
  setColumnFilters(filters=>({...filters,[key]:value}));
  setPage(0);setShown(CARD_PAGE);
  setExportStatus('');
 }

 function filterControl(key,label){
  const value=columnFilters[key]||'';
  const common={value,onChange:event=>changeColumn(key,event.target.value),'aria-label':'Filtrēt: '+label,title:'Filtrēt '+label};

  if(key==='date_from'||key==='date_to'){
   return <input {...common} type="date" min={data?.window?.from||undefined} max={data?.window?.to||undefined}/>;
  }
  if(key==='municipality'){
   return <select {...common}><option value="">Visas</option>{options.municipalities.map(item=><option key={item} value={item}>{item}</option>)}</select>;
  }
  if(key==='country_code'){
   return <select {...common}><option value="">Visas</option>{options.countries.map(item=><option key={item} value={item}>{display({country_code:item},'country_code')}</option>)}</select>;
  }
  if(key==='price_status'){
   return <select {...common}><option value="">Visi</option>{options.prices.map(item=><option key={item} value={item}>{prices[item]||item}</option>)}</select>;
  }
  if(key==='event_type'){
   return <select {...common}><option value="">Visi</option>{options.eventTypes.map(item=><option key={item} value={item}>{display({event_type:item},'event_type')}</option>)}</select>;
  }
  return <input {...common} type="search" placeholder="Filtrēt…"/>;
 }

 async function exportExcel(){
  setExporting(true);
  setExportStatus('');
  try{
   const {createWorkbook}=await import('../../lib/excel.js');
   // The export has every public field, so it reads the full catalogue and keeps
   // the rows (and order) the table currently shows.
   const response=await fetch('/api/events?full=1',{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error('full catalogue unavailable');
   const fullById=new Map(((await response.json()).events||[]).map(event=>[event.id,event]));
   const exportRows=tableRows.map(event=>({...event,...(fullById.get(event.id)||{})}));
   const buffer=await createWorkbook(exportRows,data.fetchedAt);
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');
   a.href=url;
   a.download=`Meets-2-pasakumi-${new Date().toISOString().slice(0,10)}.xlsx`;
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setExportStatus(`Eksportēti ${exportRows.length} ieraksti.`);
  }catch{
   setExportStatus('Eksports neizdevās. Mēģini vēlreiz.');
  }finally{
   setExporting(false);
  }
 }

 const mapHref=useMemo(()=>{
  const p=new URLSearchParams();
  if(shared.group)p.set('category',shared.group);
  if(shared.audience)p.set('audience',shared.audience);
  if(level!==DEFAULT_LEVEL)p.set('level',level);
  if(shared.types?.length)p.set('types',shared.types.join(','));
  if(shared.competition)p.set('competition',shared.competition);
  if(columnFilters.primary_category)p.set('subcategory',columnFilters.primary_category);
  if(columnFilters.title)p.set('q',columnFilters.title);
  if(columnFilters.municipality)p.set('municipality',columnFilters.municipality);
  if(columnFilters.country_code)p.set('country',columnFilters.country_code);
  if(columnFilters.price_status)p.set('price',columnFilters.price_status);
  if(columnFilters.event_type)p.set('event_type',columnFilters.event_type);
  if(placeFilter)p.set('place',placeFilter);
  if(shared.radius)p.set('radius',String(shared.radius));
  if(period!=='all')p.set('period',period);
  else{p.set('period','manual');p.set('from',shared.from||rigaTodayIso());p.set('to',shared.to||data?.window?.to||addIsoDays(rigaTodayIso(),90));}
  if(sharedOrigin&&!['browser'].includes(sharedOrigin.source)){
   p.set('lat',String(Number(sharedOrigin.lat.toFixed(4))));
   p.set('lon',String(Number(sharedOrigin.lon.toFixed(4))));
  }
  return '/karte'+(p.size?'?'+p.toString():'');
 },[shared,sharedOrigin,columnFilters,period,data?.window?.to,placeFilter,level]);
 // Measurement: a search once typing stops.
 useEffect(()=>{
  const term=String(columnFilters.title||'').trim();
  if(term.length<3)return;
  const timer=setTimeout(()=>track('search',{search_term:term}),1200);
  return()=>clearTimeout(timer);
 },[columnFilters.title]);
 // Old links opened an event in a dialog here (?event=<id>): they now go to its page.
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('event');
  const event=id&&allRows.find(e=>e.id===id);
  if(event)window.location.replace(eventPath(event));
 },[allRows]);

 // "Kur", the same choices as the map: all of Latvia, the browser's position, a
 // town (with the map's radii) or a local government.
 const nearKey=columnFilters.municipality?'novads:'+columnFilters.municipality
  :!(shared.radius>0)||!sharedOrigin?'':sharedOrigin.source==='browser'?'me'
  :NEAR_PLACES.find(place=>distanceKm(place,sharedOrigin)<1)?.key||'custom';
 const nearLabel=nearKey&&nearKey!=='custom'&&nearKey!=='me'&&!nearKey.startsWith('novads:')?nearPlace(nearKey).label:sharedOrigin?.label||'Izvēlētā vieta';
 function chooseNear(origin,radius){
  setSharedOrigin(origin);
  setShared(current=>({...current,radius:origin?(radius||current.radius||DEFAULT_RADIUS):0}));
  if(origin)setColumnFilters(filters=>({...filters,municipality:''}));
  setShown(CARD_PAGE);setPage(0);setNearMessage('');
  if(origin)try{localStorage.setItem(LOCATION_CHOICE_KEY,JSON.stringify(origin));}catch{}
 }
 function changeNear(value){
  if(!value){chooseNear(null);changeColumn('municipality','');return;}
  if(value.startsWith('novads:')){chooseNear(null);changeColumn('municipality',value.slice(7));return;}
  if(value==='me'){
   if(!navigator.geolocation){setNearMessage('Pārlūks nevar noteikt atrašanās vietu. Izvēlies pilsētu.');return;}
   setNearMessage('Nosaka atrašanās vietu…');
   navigator.geolocation.getCurrentPosition(
    position=>chooseNear({lat:position.coords.latitude,lon:position.coords.longitude,label:'Mana atrašanās vieta',source:'browser'}),
    ()=>setNearMessage('Atrašanās vietu neizdevās noteikt. Izvēlies pilsētu.'),
    {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
   return;
  }
  const place=nearPlace(value);
  if(place)chooseNear({lat:place.lat,lon:place.lon,label:place.label,source:'place'});
 }
 const resetPage=()=>{setPage(0);setShown(CARD_PAGE);};
 const changeLevel=key=>{setLevel(key);resetPage();};
 const changeShared=patch=>{setShared(current=>({...current,...patch}));resetPage();};
 const toggleType=value=>changeShared({types:(shared.types||[]).includes(value)?(shared.types||[]).filter(t=>t!==value):[...(shared.types||[]),value],competition:''});

 // The filter panel: the map's panel with the catalogue's own choices under "Vēl".
 const sourceCounts=useMemo(()=>rows.reduce((acc,e)=>{const t=sourceType(e);acc[t]=(acc[t]||0)+1;return acc;},{}),[rows]);
 const audienceOptions=Object.entries(AUDIENCE_FILTERS).filter(([key])=>key===shared.audience||rows.some(e=>matchesAudience(e,key)));
 const singleType=(shared.types||[]).length===1?shared.types[0]:'';
 const competitionOptions=useMemo(()=>{
  if(!singleType)return [];
  const counts=new Map();
  for(const e of rows)if(sourceType(e)===singleType&&e.competition_key&&e.competition_name){
   const item=counts.get(e.competition_key)||{key:e.competition_key,name:e.competition_name,count:0};item.count++;counts.set(e.competition_key,item);
  }
  return [...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'lv'));
 },[rows,singleType]);
 const subcategories=useMemo(()=>[...new Set(rows.filter(e=>!shared.group||eventGroup(e)===shared.group).map(e=>e.primary_category).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,'lv')),[rows,shared.group]);
 const onlineCount=useMemo(()=>rows.filter(e=>['online','hybrid'].includes(e.attendance_mode)).length,[rows]);
 const panelValues={category:shared.group||'',audience:shared.audience||'',level,price:columnFilters.price_status||'',onlineOnly,showLong,
  eventTypes:shared.types||[],competition:shared.competition||'',subcategory:columnFilters.primary_category||'',country:columnFilters.country_code||''};
 const filterCount=whatFilterCount({...panelValues,showLong:true})+(placeFilter?1:0)+(sort!=='date_from'?1:0);
 const resetAll=()=>{setColumnFilters({});setPeriod('all');setPlaceFilter('');setShared({});setSharedOrigin(null);setLevel(DEFAULT_LEVEL);setOnlineOnly(false);setSort('date_from');setDirection(1);resetPage();};
 // Chips for each active choice, so one can be removed without opening the filters.
 const activeChips=[
  columnFilters.municipality&&{label:columnFilters.municipality,clear:()=>changeColumn('municipality','')},
  columnFilters.event_type&&{label:display({event_type:columnFilters.event_type},'event_type'),clear:()=>changeColumn('event_type','')},
  columnFilters.price_status&&{label:prices[columnFilters.price_status]||columnFilters.price_status,clear:()=>changeColumn('price_status','')},
  columnFilters.primary_category&&{label:columnFilters.primary_category,clear:()=>changeColumn('primary_category','')},
  shared.audience&&{label:AUDIENCE_FILTERS[shared.audience]||shared.audience,clear:()=>changeShared({audience:''})},
  ...(shared.types||[]).map(type=>({label:SOURCE_TYPE_LABELS[type]||type,clear:()=>toggleType(type)})),
  shared.competition&&{label:competitionOptions.find(c=>c.key===shared.competition)?.name||'Turnīrs',clear:()=>changeShared({competition:''})},
  onlineOnly&&{label:'Tiešsaistē',clear:()=>{setOnlineOnly(false);resetPage();}},
  level!==DEFAULT_LEVEL&&{label:LEVEL_CHIPS[level],clear:()=>changeLevel(DEFAULT_LEVEL)},
  placeFilter&&{label:availablePlaces.find(place=>place.key===placeFilter)?.name||'Norises vieta',clear:()=>{setPlaceFilter('');setShown(CARD_PAGE);}},
  shared.radius>0&&{label:(nearKey==='me'?'Mana vieta':nearLabel)+' · līdz '+shared.radius+' km',clear:()=>chooseNear(null)},
  (shared.from||shared.to)&&{label:'Datumi no kartes',clear:()=>changeShared({from:'',to:''})}
 ].filter(Boolean);
 const resultCount=viewMode==='calendar'?calendarSplit.current.length:viewMode==='table'?tableRows.length:listed.current.length;
 const sortSelect=<label><span>Kārtot</span><select value={sort} onChange={event=>{setSort(event.target.value);setDirection(1);setPage(0);}}>
  <option value="date_from">Pēc datuma un laika</option><option value="title">Pēc nosaukuma</option><option value="municipality">Pēc pašvaldības</option></select></label>;
 const panel=filtersOpen&&<WhatPanel portal={isPhone} panelRef={filtersRef} onClose={()=>setFiltersOpen(false)} count={countLabel(resultCount)}
  f={panelValues}
  set={{category:v=>changeShared({group:v}),audience:v=>changeShared({audience:v}),level:changeLevel,price:v=>changeColumn('price_status',v),
   onlineOnly:v=>{setOnlineOnly(v);resetPage();},showLong:setShowLong,toggleType,competition:v=>changeShared({competition:v}),
   subcategory:v=>changeColumn('primary_category',v),country:v=>changeColumn('country_code',v)}}
  periods={PERIOD_CHIPS.map(([key,label])=>({key,label}))} periodMode={period} changePeriod={v=>{setPeriod(v);resetPage();}}
  audienceOptions={audienceOptions} sportTypes={SPORT_TYPES} sourceCounts={sourceCounts} singleEventType={singleType} competitionOptions={competitionOptions}
  categories={subcategories} countries={options.countries} countryLabel={code=>display({country_code:code},'country_code')} onReset={resetAll} onlineCount={onlineCount}
  more={<>
   <label><span>Pašvaldība</span>{filterControl('municipality','Pašvaldība')}</label>
   <label><span>Norises vieta</span><select value={placeFilter} onChange={e=>{setPlaceFilter(e.target.value);resetPage();}}><option value="">Visas vietas</option>
    {availablePlaces.map(place=><option key={place.key} value={place.key}>{place.name} · {place.municipality} ({place.count})</option>)}</select></label>
   {sortSelect}
  </>}/>;

 return <>
  {error&&<div className="error-message" role="alert">{error} {data&&'Zemāk saglabāti pēdējie veiksmīgi ielādētie dati.'}</div>}

  <div className="catalog-search" role="search">
   <label className="catalog-search-field">
    <span className="sr-only">Meklēt pasākumu</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/></svg>
    <input type="search" value={columnFilters.title||''} onChange={e=>changeColumn('title',e.target.value)}
     placeholder="Ko meklē?" enterKeyHint="search" aria-label="Meklēt pasākumu, vietu vai pilsētu"/>
   </label>
   <button type="button" ref={filtersButtonRef} className={'catalog-filter-toggle'+(filterCount?' has-filters':'')} aria-expanded={filtersOpen}
    aria-controls="msearch-what-panel" onClick={()=>setFiltersOpen(open=>!open)}><Icon name="sliders" size={18}/>Filtri{filterCount?<span>{filterCount}</span>:null}</button>
  </div>
  {panel&&(isPhone&&typeof document!=='undefined'?createPortal(panel,document.body):<div className="catalog-filter-panel">{panel}</div>)}

  {/* The same eight themes as the map and the home page (?category=). */}
  <div className="map-chip-row catalog-theme-chips" role="group" aria-label="Tēma">
   <button type="button" aria-pressed={!shared.group} className={!shared.group?'active':''} onClick={()=>changeShared({group:''})}>Visas tēmas</button>
   {GROUPS.map(group=><button key={group.key} type="button" aria-pressed={shared.group===group.key} className={shared.group===group.key?'active':''}
    onClick={()=>changeShared({group:shared.group===group.key?'':group.key})}><CategoryIcon name={group.key}/>{group.title}</button>)}
  </div>

  {viewMode!=='calendar'&&<div className="map-chip-row catalog-period-chips" role="group" aria-label="Kad">
   {PERIOD_CHIPS.map(([value,label])=><button key={value} type="button" aria-pressed={period===value} className={period===value?'active':''}
    onClick={()=>{setPeriod(value);resetPage();}}>{label}</button>)}
  </div>}

  <div className="catalog-near" role="group" aria-label="Kur">
   <label className="catalog-near-place"><span>Kur</span>
    <select value={nearKey} onChange={e=>changeNear(e.target.value)}>
     <option value="">Visa Latvija</option>
     <option value="me">Mana atrašanās vieta</option>
     {nearKey==='custom'&&<option value="custom">{sharedOrigin?.label||'Izvēlētā vieta'}</option>}
     <optgroup label="Pilsētas">{NEAR_PLACES.map(place=><option key={place.key} value={place.key}>{place.label}</option>)}</optgroup>
     {options.municipalities.length>0&&<optgroup label="Novadi">{options.municipalities.map(name=><option key={name} value={'novads:'+name}>{name}</option>)}</optgroup>}
    </select>
   </label>
   {shared.radius>0&&<label className="catalog-near-radius"><span>Cik tālu</span>
    <select value={shared.radius} onChange={e=>{const km=Number(e.target.value);if(km)changeShared({radius:km});else chooseNear(null);}}>
     {[...new Set([...RADII.filter(Boolean),shared.radius])].sort((a,b)=>a-b).map(km=><option key={km} value={km}>{km} km</option>)}
     <option value={0}>Visa Latvija</option>
    </select>
   </label>}
   {nearMessage&&<small role="status">{nearMessage}</small>}
  </div>

  {activeChips.length>0&&<div className="catalog-active-chips" aria-label="Aktīvie filtri">
   {activeChips.map((chip,i)=><button key={i} type="button" onClick={chip.clear} aria-label={'Noņemt filtru: '+chip.label}>{chip.label} <Icon name="close" size={14}/></button>)}
   <button type="button" className="text-button" onClick={resetAll}>Notīrīt visu</button>
  </div>}

  {shared.group==='sport'&&<LevelSwitch level={level} onLevel={changeLevel} className="catalog-level-switch"/>}

  <div className="catalog-result-line">
   <p aria-live="polite">{data?<><strong>{countLabel(resultCount)}</strong>{period!=='all'&&viewMode!=='calendar'?' '+PERIOD_CHIPS.find(([key])=>key===period)?.[1].toLocaleLowerCase('lv'):''}</>:'Ielādē pasākumus…'}</p>
   <div className="catalog-result-links">
    <a href={mapHref}>Skatīt kartē</a>
    <button type="button" className="text-button catalog-excel" disabled={!data||!tableRows.length||exporting} onClick={exportExcel}>
     {exporting?'Gatavo Excel…':'Lejupielādēt Excel'}</button>
    <div className="catalog-view-switch" role="group" aria-label="Skats">
     {VIEWS.map(([value,label])=><button key={value} type="button" aria-pressed={viewMode===value} onClick={()=>{setViewMode(value);setShown(CARD_PAGE);}}>{label}</button>)}
    </div>
   </div>
  </div>

  {viewMode==='table'&&<div className="result-toolbar">
   <label className="sort-label">Kārtot pēc<select value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="date_from">Datuma</option><option value="title">Nosaukuma</option><option value="municipality">Pašvaldības</option></select></label>
   <button className="button direction-button" onClick={()=>{setDirection(value=>-value);setPage(0);}} aria-label={direction===1?'Kārtot dilstoši':'Kārtot augoši'}>{direction===1?'↑':'↓'}</button>
   <button type="button" className="button" onClick={()=>setViewMode('cards')}>Atpakaļ uz sarakstu</button>
  </div>}

  <p role="status" className="sync-text">{exportStatus}</p>

  {viewMode==='table'&&<details className="mobile-table-filters">
   <summary>Filtrēt pasākumus{activeFilterCount||period!=='all'?` (${activeFilterCount+(period!=='all'?1:0)})`:''}</summary>
   <div className="mobile-filter-grid">
    {TABLE_COLUMNS.filter(([key])=>mobileFilterKeys.has(key)).map(([key,label])=><label key={key}>{label}{filterControl(key,label)}</label>)}
   </div>
  </details>}

  {!data&&loading&&(fallback||<div className="catalog-card-grid catalog-skeleton" aria-hidden="true">{Array.from({length:6},(_,i)=><div key={i} className="catalog-skeleton-card"/>)}</div>)}

  {viewMode==='cards'&&data&&listed.longRunning.length>0&&<section className={'catalog-long-running'+(showLong?' open':'')} aria-labelledby="long-running-title">
   <button type="button" className="catalog-long-running-toggle" aria-expanded={showLong} onClick={()=>setShowLong(open=>!open)}>
    <span><strong id="long-running-title">Izstādes un ilgstoši pasākumi</strong><small>{countLabel(listed.longRunning.length)}, kas jau notiek un ilgst vairākas nedēļas</small></span>
    <span aria-hidden="true">{showLong?'−':'+'}</span>
   </button>
   {showLong&&<div className="catalog-card-grid meets-catalog-image-grid">{listed.longRunning.map(event=><DiscoveryEventCard key={event.id} event={event} actions/>)}</div>}
  </section>}

  {data&&resultCount===0
   ?<div className="empty catalog-empty"><h2>{rows.length?'Šādu pasākumu nav':'Pasākumu vēl nav'}</h2>
     <p>{rows.length?'Pamēģini citu laiku vai noņem kādu filtru.':'Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.'}</p>
     {rows.length>0&&<div className="catalog-empty-actions">
      {period!=='all'&&<button type="button" className="button" onClick={()=>{setPeriod('all');setShown(CARD_PAGE);}}>Rādīt visus datumus</button>}
      {(filterCount>0||columnFilters.title||activeChips.length>0)&&<button type="button" className="button" onClick={resetAll}>Notīrīt filtrus</button>}
     </div>}
    </div>
   :<>
    {viewMode==='calendar'&&<EventCalendar events={calendarSplit.current} longCount={calendarSplit.longRunning.length} today={today}
     onShowLong={()=>{setViewMode('cards');setPeriod('all');setShowLong(true);}}/>}
    {/* Day headings with how many events each day has: Šodien · 12, Rīt · 8, Sestdiena, 7. novembris · 5 */}
    {viewMode==='cards'&&<div className="catalog-card-grid meets-catalog-image-grid">{cards.map((event,index)=>{
     const day=sort==='date_from'?listDay(event,today):'';
     const showHeading=day&&(index===0||listDay(cards[index-1],today)!==day);
     return [showHeading&&<h2 key={'day-'+day} className={'catalog-day-heading'+(day===today?' is-today':day===addIsoDays(today,1)?' is-tomorrow':'')}>
      {(parts=>parts?<>
       <span className="day-number" aria-hidden="true">{parts.number}</span>
       <span className="day-text"><span className="day-label">{parts.label}<span className="sr-only"> {parts.number}. {parts.month}</span></span>
        <span className="day-count" aria-hidden="true">{parts.month} · {eventCountLabel(dayCounts.get(day))}</span>
        <span className="sr-only">, {eventCountLabel(dayCounts.get(day))}</span></span>
      </>:<span className="day-label">{dayHeading(event,today)}</span>)(dayParts(day,today))}</h2>,
      <DiscoveryEventCard key={event.id} event={event} actions/>];
    })}</div>}
    {viewMode==='cards'&&listed.current.length>shown&&<div className="catalog-more">
     <button type="button" className="button" onClick={()=>setShown(n=>n+CARD_PAGE)}>Rādīt vēl {Math.min(CARD_PAGE,listed.current.length-shown)}</button>
     <small>Rādīti {shown} no {listed.current.length}</small>
    </div>}
    {viewMode==='table'&&<div className="table-scroll" role="region" aria-label="Pasākumu tabula — ritināma horizontāli" tabIndex={0}>
     <table className="events-table catalog-events-table">
      <caption>Atlasītie pasākumi. Otrajā galvenes rindā vari filtrēt katru kolonnu atsevišķi. Nosaukums atver pasākuma lapu.</caption>
      <thead>
       <tr className="column-title-row"><th scope="col">Nr.</th>{TABLE_COLUMNS.map(([key,label])=><th key={key} scope="col">{label}</th>)}</tr>
       <tr className="column-filter-row" aria-label="Kolonu filtri"><th aria-label="Numerācija"></th>{TABLE_COLUMNS.map(([key,label])=><th key={key}>{filterControl(key,label)}</th>)}</tr>
      </thead>
      <tbody>{visible.map((event,index)=><tr key={event.id}>
       <td>{current*pageSize+index+1}</td>
       {TABLE_COLUMNS.map(([key])=><td key={key}>
        {key==='title'
         ?<Link className="event-title" href={eventPath(event)}>{event.title}</Link>
         :key==='source_url'
          ?event.sources.filter(source=>source.url).map((source,j)=><a className="source-link" key={j} href={source.url} target="_blank" rel="noopener noreferrer">Atvērt avotu ↗</a>)
          :display(event,key)||'—'}
       </td>)}
      </tr>)}</tbody>
     </table>
    </div>}

    {viewMode==='table'&&<div className="mobile-events">{visible.map(event=><article key={event.id} className="mobile-event">
     <div className="mobile-event-meta">
      <div><strong>{display(event,'date_from')}</strong><span>{display(event,'time')}</span></div>
     </div>
     <Link className="event-title" href={eventPath(event)}>{event.title}</Link>
     <div className="mobile-event-facts">
      <div className="meets-mobile-table-venue"><span><b>Vieta</b>{event.venue_name||event.address_raw||'Nav norādīta'}</span><EventVenueFavorite event={event} compact/></div>
      <span><b>Pašvaldība</b>{event.municipality||'Nav norādīta'}</span>
      <span><b>Veids</b>{display(event,'event_type')||event.primary_category||'Nav norādīts'}</span>
      <span><b>Maksa</b>{display(event,'price_status')}</span>
     </div>
     <EventQuickActions event={event}/>
    </article>)}</div>}
   </>}

  {viewMode==='table'&&data&&tableRows.length>0&&<nav className="pagination" aria-label="Saraksta lapas">
   <button className="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Iepriekšējā</button>
   <span>{current+1}. / {pages} lapa · {current*pageSize+1}–{Math.min((current+1)*pageSize,tableRows.length)}</span>
   <button className="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Nākamā →</button>
  </nav>}
 </>;
}

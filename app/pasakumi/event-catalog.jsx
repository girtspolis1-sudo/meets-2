'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {columns,detailColumns,display,filterEventsByColumns,prices,statuses} from '../../lib/catalog.js';
import {useEvents} from '../../lib/use-events.js';
import EventQuickActions from '../components/event-quick-actions.jsx';
import DiscoveryEventCard from '../components/discovery-event-card.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';
import {cardCategory,cardDate,cardDescription,cardGroup,cardImage,cardLocation,cardPrice} from '../../lib/discovery-card.js';
import {placeFromEvent,placesFromEvents} from '../../lib/location-follow.js';
import {rigaTodayIso,rigaClockMinutes,addIsoDays} from '../../lib/event-date.js';
import {eventGroup,matchesAudience,sourceType} from '../../lib/home-category-filters.js';
import {countLabel,dayHeading,periodRange} from '../../lib/map-nearby.js';
import {isOver,listDay,splitForList} from '../../lib/catalog-list.js';

// The same time windows as the map.
const PERIOD_CHIPS=[['all','Visi'],['today','Šodien'],['tomorrow','Rīt'],['weekend','Nedēļas nogalē'],['7days','7 dienas'],['30days','30 dienas']];
const PERIODS=new Set(PERIOD_CHIPS.map(([key])=>key));
// Older shared links used other names.
const LEGACY_PERIODS={'3days':'7days',week:'7days',month:'30days'};
const CARD_PAGE=40;

const pageSize=50;
const mobileFilterKeys=new Set(['date_from','title','municipality','event_type','primary_category','price_status']);

export default function EventCatalog(){
 const {data,loading,error,refresh}=useEvents();
 const [columnFilters,setColumnFilters]=useState({});
 const [page,setPage]=useState(0);
 const [sort,setSort]=useState('date_from');
 const [direction,setDirection]=useState(1);
 const [exporting,setExporting]=useState(false);
 const [exportStatus,setExportStatus]=useState('');
 const [selected,setSelected]=useState(null);
 const [viewMode,setViewMode]=useState('cards');
 const [period,setPeriod]=useState('all');
 const [shared,setShared]=useState({});
 const [sharedOrigin,setSharedOrigin]=useState(null);
 const [placeFilter,setPlaceFilter]=useState('');
 const [shown,setShown]=useState(CARD_PAGE);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [showLong,setShowLong]=useState(false);
 // Minutes in Riga, so today's events drop off the list once they are over.
 const [clock,setClock]=useState(()=>rigaClockMinutes());
 useEffect(()=>{const t=setInterval(()=>setClock(rigaClockMinutes()),60000);return()=>clearInterval(t);},[]);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  setPlaceFilter(p.get('place')||'');
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
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 },[columnFilters,period,placeFilter]);

 const rows=data?.events||[];
 const availablePlaces=useMemo(()=>placesFromEvents(rows),[rows]);
 const options=useMemo(()=>({
  municipalities:[...new Set(rows.map(event=>event.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),
  countries:[...new Set(rows.map(event=>event.country_code).filter(Boolean))].sort(),
  statuses:[...new Set(rows.map(event=>event.status).filter(Boolean))].sort(),
  prices:[...new Set(rows.map(event=>event.price_status).filter(Boolean))].sort(),
  eventTypes:[...new Set(rows.map(event=>event.event_type).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'lv')),
  mapStatuses:[...new Set(rows.map(event=>display(event,'map_status')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv'))
 }),[rows]);

 const filtered=useMemo(()=>{
 const query=String(columnFilters.title||'').trim().toLocaleLowerCase('lv');
 const otherFilters={...columnFilters};
 delete otherFilters.title;
 return filterEventsByColumns(rows,otherFilters).filter(event=>{
  if(query&&![event.title,event.venue_name,event.address_raw,event.settlement,event.municipality]
   .some(value=>String(value||'').toLocaleLowerCase('lv').includes(query)))return false;
  if(placeFilter&&placeFromEvent(event)?.key!==placeFilter)return false;
  if(shared.group&&eventGroup(event)!==shared.group)return false;
  if(shared.audience&&!matchesAudience(event,shared.audience))return false;
  if(shared.types?.length&&!shared.types.includes(sourceType(event)))return false;
  if(shared.competition&&event.competition_key!==shared.competition)return false;
  if(shared.from&&String(event.date_to||event.date_from||'')<shared.from)return false;
  if(shared.to&&String(event.date_from||'')>shared.to)return false;
  if(shared.radius>0){
   const center=sharedOrigin||{lat:56.9496,lon:24.1052};
   const lat=Number(event.latitude),lon=Number(event.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
   const deg=Math.PI/180,dLat=(lat-center.lat)*deg,dLon=(lon-center.lon)*deg;
   const a=Math.sin(dLat/2)**2+Math.cos(center.lat*deg)*Math.cos(lat*deg)*Math.sin(dLon/2)**2;
   if(6371*2*Math.asin(Math.min(1,Math.sqrt(a)))>shared.radius)return false;
  }
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
 },[rows,columnFilters,sort,direction,period,shared,sharedOrigin,placeFilter]);

 const today=rigaTodayIso();
 // Cards: what is still ahead, today's events by start time; long exhibitions apart.
 const listed=useMemo(()=>{
  const split=splitForList(filtered,today,clock);
  if(sort!=='date_from')split.current=filtered.filter(event=>split.current.includes(event));
  return split;
 },[filtered,today,clock,sort]);
 const tableRows=useMemo(()=>filtered.filter(event=>!isOver(event,today,clock)),[filtered,today,clock]);
 const dayCounts=useMemo(()=>{const counts=new Map();for(const event of listed.current){const day=listDay(event,today);counts.set(day,(counts.get(day)||0)+1);}return counts;},[listed,today]);
 const pages=Math.max(1,Math.ceil(tableRows.length/pageSize));
 const current=Math.min(page,pages-1);
 const visible=tableRows.slice(current*pageSize,(current+1)*pageSize);
 const cards=listed.current.slice(0,shown);
 const activeFilterCount=Object.values(columnFilters).filter(value=>String(value||'').trim()).length;
 const sharedFilterCount=[placeFilter,shared.group,shared.audience,shared.types?.length,shared.competition,shared.radius>0,shared.from,shared.to].filter(Boolean).length;

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
  if(key==='status'){
   return <select {...common}><option value="">Visi</option>{options.statuses.map(item=><option key={item} value={item}>{statuses[item]||item}</option>)}</select>;
  }
  if(key==='price_status'){
   return <select {...common}><option value="">Visi</option>{options.prices.map(item=><option key={item} value={item}>{prices[item]||item}</option>)}</select>;
  }
  if(key==='event_type'){
   return <select {...common}><option value="">Visi</option>{options.eventTypes.map(item=><option key={item} value={item}>{display({event_type:item},'event_type')}</option>)}</select>;
  }
  if(key==='map_status'){
   return <select {...common}><option value="">Visi</option>{options.mapStatuses.map(item=><option key={item} value={item}>{item}</option>)}</select>;
  }
  return <input {...common} type="search" placeholder="Filtrēt…"/>;
 }

 async function exportExcel(){
  setExporting(true);
  setExportStatus('');
  try{
   const {createWorkbook}=await import('../../lib/excel.js');
   const buffer=await createWorkbook(tableRows,data.fetchedAt);
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');
   a.href=url;
   a.download=`Meets-2-pasakumi-${new Date().toISOString().slice(0,10)}.xlsx`;
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setExportStatus(`Eksportēti ${tableRows.length} ieraksti.`);
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
 },[shared,sharedOrigin,columnFilters,period,data?.window?.to,placeFilter]);
 const selectedEvent=rows.find(event=>event.id===selected);
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('event');
  if(id&&rows.some(event=>event.id===id))setSelected(id);
 },[rows]);
 function closeDetails(){
  setSelected(null);
  const url=new URL(window.location.href);
  if(url.searchParams.has('event')){
   url.searchParams.delete('event');
   window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
 }

 const filterCount=activeFilterCount-(columnFilters.title?1:0)+(placeFilter?1:0);
 const resetAll=()=>{setColumnFilters({});setPeriod('all');setPlaceFilter('');setShared({});setSharedOrigin(null);setPage(0);setShown(CARD_PAGE);};
 // Chips for each active choice, so one can be removed without opening the filters.
 const activeChips=[
  columnFilters.municipality&&{label:columnFilters.municipality,clear:()=>changeColumn('municipality','')},
  columnFilters.event_type&&{label:display({event_type:columnFilters.event_type},'event_type'),clear:()=>changeColumn('event_type','')},
  columnFilters.price_status&&{label:prices[columnFilters.price_status]||columnFilters.price_status,clear:()=>changeColumn('price_status','')},
  columnFilters.primary_category&&{label:columnFilters.primary_category,clear:()=>changeColumn('primary_category','')},
  placeFilter&&{label:availablePlaces.find(place=>place.key===placeFilter)?.name||'Norises vieta',clear:()=>{setPlaceFilter('');setShown(CARD_PAGE);}},
  sharedFilterCount-(placeFilter?1:0)>0&&{label:'Atlase no kartes',clear:()=>{setShared({});setSharedOrigin(null);setShown(CARD_PAGE);}}
 ].filter(Boolean);
 const resultCount=viewMode==='cards'?listed.current.length:tableRows.length;

 return <>
  {error&&<div className="error-message" role="alert">{error} {data&&'Zemāk saglabāti pēdējie veiksmīgi ielādētie dati.'}</div>}

  <div className="catalog-search" role="search">
   <label className="catalog-search-field">
    <span className="sr-only">Meklēt pasākumu</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/></svg>
    <input type="search" value={columnFilters.title||''} onChange={e=>changeColumn('title',e.target.value)}
     placeholder="Meklē pasākumu, vietu vai pilsētu" enterKeyHint="search"/>
   </label>
   <button type="button" className={'catalog-filter-toggle'+(filterCount?' has-filters':'')} aria-expanded={filtersOpen}
    aria-controls="catalog-filters" onClick={()=>setFiltersOpen(open=>!open)}>Filtri{filterCount?<span>{filterCount}</span>:null}</button>
  </div>

  <div className="map-chip-row catalog-period-chips" role="group" aria-label="Kad">
   {PERIOD_CHIPS.map(([value,label])=><button key={value} type="button" aria-pressed={period===value} className={period===value?'active':''}
    onClick={()=>{setPeriod(value);setPage(0);setShown(CARD_PAGE);}}>{label}</button>)}
  </div>

  {filtersOpen&&<div id="catalog-filters" className="catalog-card-filters" aria-label="Filtri">
   <label>Pašvaldība{filterControl('municipality','Pašvaldība')}</label>
   <label>Veids{filterControl('event_type','Tips')}</label>
   <label>Maksa{filterControl('price_status','Maksa')}</label>
   <label>Norises vieta<select value={placeFilter} onChange={e=>{setPlaceFilter(e.target.value);setPage(0);setShown(CARD_PAGE);}} aria-label="Filtrēt pēc norises vietas"><option value="">Visas vietas</option>{availablePlaces.map(place=><option key={place.key} value={place.key}>{place.name} · {place.municipality} ({place.count})</option>)}</select></label>
   <label>Kārtot<select value={sort} onChange={event=>{setSort(event.target.value);setDirection(1);setPage(0);}}><option value="date_from">Pēc datuma un laika</option><option value="title">Pēc nosaukuma</option><option value="municipality">Pēc pašvaldības</option></select></label>
  </div>}

  {activeChips.length>0&&<div className="catalog-active-chips" aria-label="Aktīvie filtri">
   {activeChips.map((chip,i)=><button key={i} type="button" onClick={chip.clear} aria-label={'Noņemt filtru: '+chip.label}>{chip.label} <span aria-hidden="true">✕</span></button>)}
   <button type="button" className="text-button" onClick={resetAll}>Notīrīt visu</button>
  </div>}

  <div className="catalog-result-line">
   <p aria-live="polite">{data?<><strong>{countLabel(resultCount)}</strong>{period!=='all'?' '+PERIOD_CHIPS.find(([key])=>key===period)?.[1].toLocaleLowerCase('lv'):''}</>:'Ielādē pasākumus…'}</p>
   <div className="catalog-result-links">
    <a href={mapHref}>Skatīt kartē</a>
    <button type="button" className="text-button" onClick={()=>setViewMode(mode=>mode==='cards'?'table':'cards')}>{viewMode==='cards'?'Tabula un Excel':'Kartītes'}</button>
   </div>
  </div>

  {viewMode==='table'&&<div className="result-toolbar">
   <label className="sort-label">Kārtot pēc<select value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="date_from">Datuma</option><option value="title">Nosaukuma</option><option value="municipality">Pašvaldības</option></select></label>
   <button className="button direction-button" onClick={()=>{setDirection(value=>-value);setPage(0);}} aria-label={direction===1?'Kārtot dilstoši':'Kārtot augoši'}>{direction===1?'↑':'↓'}</button>
   <button className="button primary" disabled={!data||!tableRows.length||exporting} onClick={exportExcel}>{exporting?'Gatavo Excel…':`Lejupielādēt Excel (${tableRows.length})`}</button>
  </div>}

  <p role="status" className="sync-text">{exportStatus}</p>

  {viewMode==='table'&&<details className="mobile-table-filters">
   <summary>Filtrēt pasākumus{activeFilterCount||period!=='all'?` (${activeFilterCount+(period!=='all'?1:0)})`:''}</summary>
   <div className="mobile-filter-grid">
    {columns.filter(([key])=>mobileFilterKeys.has(key)).map(([key,label])=><label key={key}>{label}{filterControl(key,label)}</label>)}
   </div>
  </details>}

  {!data&&loading&&<div className="catalog-card-grid catalog-skeleton" aria-hidden="true">{Array.from({length:6},(_,i)=><div key={i} className="catalog-skeleton-card"/>)}</div>}

  {viewMode==='cards'&&data&&listed.longRunning.length>0&&<section className={'catalog-long-running'+(showLong?' open':'')} aria-labelledby="long-running-title">
   <button type="button" className="catalog-long-running-toggle" aria-expanded={showLong} onClick={()=>setShowLong(open=>!open)}>
    <span><strong id="long-running-title">Izstādes un ilgstoši pasākumi</strong><small>{countLabel(listed.longRunning.length)}, kas jau notiek un ilgst vairākas nedēļas</small></span>
    <span aria-hidden="true">{showLong?'−':'+'}</span>
   </button>
   {showLong&&<div className="catalog-card-grid meets-catalog-image-grid">{listed.longRunning.map(event=><DiscoveryEventCard key={event.id} event={event} onOpen={setSelected} actions/>)}</div>}
  </section>}

  {data&&resultCount===0
   ?<div className="empty catalog-empty"><h2>{rows.length?'Šādu pasākumu nav':'Pasākumu vēl nav'}</h2>
     <p>{rows.length?'Pamēģini citu laiku vai noņem kādu filtru.':'Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.'}</p>
     {rows.length>0&&<div className="catalog-empty-actions">
      {period!=='all'&&<button type="button" className="button" onClick={()=>{setPeriod('all');setShown(CARD_PAGE);}}>Rādīt visus datumus</button>}
      {(filterCount>0||columnFilters.title)&&<button type="button" className="button" onClick={resetAll}>Notīrīt filtrus</button>}
     </div>}
    </div>
   :<>
    {/* Day headings with how many events each day has: Šodien · 12, Rīt · 8, Sestdiena, 7. novembris · 5 */}
    {viewMode==='cards'&&<div className="catalog-card-grid meets-catalog-image-grid">{cards.map((event,index)=>{
     const day=sort==='date_from'?listDay(event,today):'';
     const showHeading=day&&(index===0||listDay(cards[index-1],today)!==day);
     return [showHeading&&<h2 key={'day-'+day} className="catalog-day-heading">{dayHeading(event,today)}<span>{dayCounts.get(day)}</span></h2>,
      <DiscoveryEventCard key={event.id} event={event} onOpen={setSelected} actions/>];
    })}</div>}
    {viewMode==='cards'&&listed.current.length>shown&&<div className="catalog-more">
     <button type="button" className="button" onClick={()=>setShown(n=>n+CARD_PAGE)}>Rādīt vēl {Math.min(CARD_PAGE,listed.current.length-shown)}</button>
     <small>Rādīti {shown} no {listed.current.length}</small>
    </div>}
    {viewMode==='table'&&<div className="table-scroll" role="region" aria-label="Pasākumu tabula — ritināma horizontāli" tabIndex={0}>
     <table className="events-table catalog-events-table">
      <caption>Atlasītie pasākumi. Otrajā galvenes rindā vari filtrēt katru kolonnu atsevišķi. Nospied nosaukumu, lai redzētu visu norises informāciju.</caption>
      <thead>
       <tr className="column-title-row"><th scope="col">Nr.</th>{columns.map(([key,label])=><th key={key} scope="col">{label}</th>)}</tr>
       <tr className="column-filter-row" aria-label="Kolonu filtri"><th aria-label="Numerācija"></th>{columns.map(([key,label])=><th key={key}>{filterControl(key,label)}</th>)}</tr>
      </thead>
      <tbody>{visible.map((event,index)=><tr key={event.id}>
       <td>{current*pageSize+index+1}</td>
       {columns.map(([key])=><td key={key}>
        {key==='title'
         ?<button className="event-title" onClick={()=>setSelected(event.id)}>{event.title}</button>
         :key==='source_url'
          ?event.sources.filter(source=>source.url).map((source,j)=><a className="source-link" key={j} href={source.url} target="_blank" rel="noopener noreferrer">Atvērt avotu ↗</a>)
          :key==='status'
           ?<span className={`badge ${event.status}`}>{display(event,key)}</span>
           :display(event,key)||'—'}
       </td>)}
      </tr>)}</tbody>
     </table>
    </div>}

    {viewMode==='table'&&<div className="mobile-events">{visible.map(event=><article key={event.id} className="mobile-event">
     <div className="mobile-event-meta">
      <div><strong>{display(event,'date_from')}</strong><span>{display(event,'time')}</span></div>
      <span className={`badge ${event.status}`}>{display(event,'status')}</span>
     </div>
     <button className="event-title" onClick={()=>setSelected(event.id)}>{event.title}</button>
     <div className="mobile-event-facts">
      <div className="meets-mobile-table-venue"><span><b>Vieta</b>{event.venue_name||event.address_raw||'Nav norādīta'}</span><EventVenueFavorite event={event} compact/></div>
      <span><b>Pašvaldība</b>{event.municipality||'Nav norādīta'}</span>
      <span><b>Veids</b>{display(event,'event_type')||event.primary_category||'Nav norādīts'}</span>
      <span><b>Maksa</b>{display(event,'price_status')}</span>
     </div>
     <EventQuickActions event={event}/>
     <button className="button compact mobile-event-open" onClick={()=>setSelected(event.id)}>Skatīt pasākumu</button>
    </article>)}</div>}
   </>}

  {viewMode==='table'&&data&&tableRows.length>0&&<nav className="pagination" aria-label="Saraksta lapas">
   <button className="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Iepriekšējā</button>
   <span>{current+1}. / {pages} lapa · {current*pageSize+1}–{Math.min((current+1)*pageSize,tableRows.length)}</span>
   <button className="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Nākamā →</button>
  </nav>}

  {selectedEvent&&<EventDetails event={selectedEvent} close={closeDetails}/>}
 </>;
}

function EventDetails({event,close}){
 const dialog=useRef(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{if(node?.open)node.close();};},[]);
 const image=cardImage(event),description=cardDescription(event),price=cardPrice(event);
 return <dialog ref={dialog} className="event-dialog meets-event-detail-dialog" onCancel={close} onClose={close} aria-label={'Pasākums: '+event.title}>
  <div className="meets-detail-hero">
   {image?<img src={image} alt="" className="catalog-detail-cover" loading="eager"/>:
    <div className={'meets-detail-image-fallback theme-'+cardGroup(event)} aria-hidden="true">✦</div>}
   <button className="meets-detail-close" type="button" aria-label="Aizvērt ✕" onClick={close} autoFocus>✕</button>
  </div>
  <div className="meets-detail-body">
   <div className="meets-detail-headline"><span className="meets-detail-tag">{cardCategory(event)}</span><h2>{event.title}</h2></div>
   <div className="meets-detail-key-facts">
    <p>▦ <strong>{cardDate(event)}</strong></p>
    <div className="meets-detail-location-line"><span>⌖ <strong>{cardLocation(event)}</strong></span><EventVenueFavorite event={event} compact/></div>
    {price&&<span className="meets-detail-price">{price}</span>}
   </div>
   {description&&<section className="meets-detail-description"><h3>Par pasākumu</h3><p>{description}</p></section>}
   <div className="meets-detail-follow"><EventQuickActions event={event} listOnly/></div>
   <div className="meets-detail-primary-actions">
    <a className="button primary" href={'/karte?event='+encodeURIComponent(event.id)}>Atvērt kartē →</a>
    {event.sources?.filter(source=>source.url).slice(0,1).map((source,index)=>
     <a key={index} className="button" href={source.url} target="_blank" rel="noopener noreferrer">Organizatora saite ↗</a>)}
   </div>
   <details className="meets-detail-more">
    <summary>Visa pasākuma informācija</summary>
    <dl>{[...columns,...detailColumns].filter(([key])=>key!=='title').map(([key,label])=><div key={key}>
      <dt>{label}</dt>
      <dd>{key==='source_url'?event.sources?.filter(source=>source.url).map((source,index)=>
       <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer" key={index}>{source.source||'Avots'} ↗</a>)
       :display(event,key)||'Nav norādīts'}</dd>
     </div>)}</dl>
   </details>
   <div className="meets-detail-quick"><h3>Ātrās darbības</h3><EventQuickActions event={event}/></div>
  </div>
 </dialog>;
}

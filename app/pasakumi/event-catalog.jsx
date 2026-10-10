'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {columns,detailColumns,display,filterEventsByColumns,prices,statuses} from '../../lib/catalog.js';
import {useEvents} from '../../lib/use-events.js';
import {navigationLinks} from '../../lib/meets-personal.js';
import {placeFromEvent,placesFromEvents} from '../../lib/location-follow.js';
import Link from 'next/link';
import {rigaTodayIso,addIsoDays} from '../../lib/event-date.js';
import {eventGroup,matchesAudience,sourceType} from '../../lib/home-category-filters.js';

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
 const [followedPlaces,setFollowedPlaces]=useState([]);
 const [followSession,setFollowSession]=useState(null);
 const [followBusy,setFollowBusy]=useState('');
 const [followError,setFollowError]=useState('');
 const [followMessage,setFollowMessage]=useState('');
 useEffect(()=>{
  try{
   const session=JSON.parse(localStorage.getItem('meets_user_session_v1')||'null');
   if(!session?.access_token)return;
   setFollowSession(session);
   fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'locationFollows',token:session.access_token}),cache:'no-store'})
    .then(async res=>{const result=await res.json();if(!res.ok)throw Error(result.error||'Sekošanu neizdevās ielādēt.');return result;})
    .then(result=>setFollowedPlaces(result.locations||[]))
    .catch(e=>setFollowError(e.message));
  }catch{}
 },[]);
 async function togglePlace(place){
  if(!place)return;
  if(!followSession?.access_token){setFollowError('Lai sekotu norises vietai, pieslēdzies MEETS kontam.');return;}
  const exists=followedPlaces.some(p=>p.location_key===place.key);
  setFollowBusy(place.key);setFollowError('');setFollowMessage('');
  try{
   const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'followLocation',token:followSession.access_token,locationKey:place.key,
      locationName:place.name,municipality:place.municipality,enabled:!exists}),cache:'no-store'});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Sekošanu neizdevās saglabāt.');
   setFollowedPlaces(prev=>exists?prev.filter(p=>p.location_key!==place.key):[...prev,
    {location_key:place.key,location_name:place.name,municipality:place.municipality}]);
   setFollowMessage(exists?'Vieta noņemta no sekotajām.':'Tagad seko vietai “'+place.name+'”.');
  }catch(e){setFollowError(e.message);}finally{setFollowBusy('');}
 }
 const followButton=event=>{
  const place=placeFromEvent(event);
  if(!place)return null;
  const isFollowing=followedPlaces.some(x=>x.location_key===place.key);
  return <button type="button" className={'catalog-follow-place'+(isFollowing?' following':'')}
   disabled={!!followBusy} aria-pressed={isFollowing}
   title={'Sekot visiem pasākumiem vietā: '+place.name}
   onClick={()=>togglePlace(place)}>
   <span aria-hidden="true">{isFollowing?'✓':'＋'}</span> {followBusy===place.key?'Saglabā…':isFollowing?'Sekoju vietai':'Sekot vietai'}
  </button>;
 };
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  setPlaceFilter(p.get('place')||'');
  const filters={};
  for(const [from,to] of [['q','title'],['price','price_status'],['municipality','municipality'],['country','country_code'],['subcategory','primary_category']]){
   if(p.get(from))filters[to]=p.get(from);
  }
  setColumnFilters(filters);
  const chosen=p.get('period');
  setPeriod(['today','tomorrow','3days','week','month'].includes(chosen)?chosen:'all');
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

 const filtered=useMemo(()=>filterEventsByColumns(rows,columnFilters).filter(event=>{
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
  const today=rigaTodayIso();
  const start=String(event.date_from||'');
  const end=String(event.date_to||start);
  if(period==='today')return start<=today&&end>=today;
  if(period==='tomorrow'){const d=addIsoDays(today,1);return start<=d&&end>=d;}
  if(period==='3days'){const d=addIsoDays(today,2);return start<=d&&end>=today;}
  if(period==='week'){
   const date=new Date(today+'T12:00:00Z');
   const last=addIsoDays(today,(7-date.getUTCDay())%7);
   return start<=last&&end>=today;
  }
  if(period==='month'){
   const last=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0)).toISOString().slice(0,10);
   return start<=last&&end>=today;
  }
  return true;
 }).sort((a,b)=>{
  const av=sort==='date_from'?a.date_from:display(a,sort);
  const bv=sort==='date_from'?b.date_from:display(b,sort);
  if(!av)return bv?1:0;
  if(!bv)return -1;
  return String(av).localeCompare(String(bv),'lv',{numeric:true})*direction||a.id.localeCompare(b.id);
 }),[rows,columnFilters,sort,direction,period,shared,sharedOrigin,placeFilter]);

 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const current=Math.min(page,pages-1);
 const visible=filtered.slice(current*pageSize,(current+1)*pageSize);
 const activeFilterCount=Object.values(columnFilters).filter(value=>String(value||'').trim()).length;
 const sharedFilterCount=[placeFilter,shared.group,shared.audience,shared.types?.length,shared.competition,shared.radius>0,shared.from,shared.to].filter(Boolean).length;

 function changeColumn(key,value){
  setColumnFilters(filters=>({...filters,[key]:value}));
  setPage(0);
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
   const buffer=await createWorkbook(filtered,data.fetchedAt);
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');
   a.href=url;
   a.download=`Meets-2-pasakumi-${new Date().toISOString().slice(0,10)}.xlsx`;
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setExportStatus(`Eksportēti ${filtered.length} ieraksti.`);
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

 return <>
  <div className="catalog-toolbar">
   <div>
    <strong>{data?`${rows.length} pasākumi`:'Ielādējam pasākumus…'}</strong>
    <p className="sync-text">{data?`Dati pārlasīti ${new Date(data.fetchedAt).toLocaleString('lv-LV',{timeZone:'Europe/Riga'})}`:'Savienojamies ar datu avotu'} · automātiski ik minūti</p>
   </div>
   <button className="button" onClick={refresh} disabled={loading}>{loading?'Ielādē…':'Pārlasīt datus'}</button>
  </div>

  <p className="catalog-availability-note">Redzami tikai aktuālie publicētie pasākumi nākamo trīs mēnešu periodā. Atlasīto rezultātu var pārskatīt kartītēs vai detalizētā tabulā.</p>

  {error&&<div className="error-message" role="alert">{error} {data&&'Zemāk saglabāti pēdējie veiksmīgi ielādētie dati.'}</div>}

  <div className="catalog-view-switch" role="group" aria-label="Pasākumu attēlošanas veids"><button type="button" aria-pressed={viewMode==='cards'} className={viewMode==='cards'?'active':''} onClick={()=>setViewMode('cards')}>▦ Kartītes</button><button type="button" aria-pressed={viewMode==='table'} className={viewMode==='table'?'active':''} onClick={()=>setViewMode('table')}>☷ Tabula un Excel</button><a href={mapHref} className="catalog-map-shortcut">⌖ Skatīt kartē ↗</a></div>
  {viewMode==='cards'&&<div className="catalog-card-filters" aria-label="Atlasīt pasākumus">
   <label>Periods<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(0);}}>
    <option value="all">Visi aktuālie</option><option value="today">Šodien</option><option value="tomorrow">Rīt</option><option value="3days">3 dienas</option><option value="week">Šonedēļ</option><option value="month">Šomēnes</option>
   </select></label>
   <label>Meklēt pasākumu{filterControl('title','Pasākums')}</label>
   <label>Pašvaldība{filterControl('municipality','Pašvaldība')}</label>
   <label>Veids{filterControl('event_type','Tips')}</label>
   <label>Maksa{filterControl('price_status','Maksa')}</label>
   <label>Norises vieta<select value={placeFilter} onChange={e=>{setPlaceFilter(e.target.value);setPage(0);}} aria-label="Filtrēt pēc norises vietas"><option value="">Visas vietas</option>{availablePlaces.map(place=><option key={place.key} value={place.key}>{place.name} · {place.municipality} ({place.count})</option>)}</select></label>
  </div>}
  {sharedFilterCount>0&&<p className="catalog-active-map-filters" role="status">Pielietota atlase no kartes — {sharedFilterCount} papildu kritēriji. Izmanto <strong>Notīrīt filtrus</strong>, lai redzētu visus pasākumus.</p>}
  <div className="catalog-follow-info">
   <span>⌖ Seko norises vietai un vienuviet redzi tur gaidāmos pasākumus.</span>
   <Link href="/mani-pasakumi">Manas sekotās vietas ↗</Link>
  </div>
  {(followError||followMessage)&&<p className={followError?'meets-inline-error':'meets-organizer-success'} role="status">
   {followError||followMessage} {followError&&!followSession&&<Link href="/mani-pasakumi">Pieslēgties ↗</Link>}
  </p>}
  <div className="result-toolbar">
   <p aria-live="polite"><strong>{filtered.length}</strong> no {rows.length} ierakstiem{activeFilterCount||period!=='all'||sharedFilterCount?<> · <strong>{activeFilterCount+(period!=='all'?1:0)+sharedFilterCount}</strong> aktīvi filtri</>:null}</p>
   <button className="text-button" disabled={!activeFilterCount&&period==='all'&&!sharedFilterCount} onClick={()=>{setColumnFilters({});setPeriod('all');setPlaceFilter('');setShared({});setSharedOrigin(null);setPage(0);}}>Notīrīt filtrus</button>
   <label className="sort-label">Kārtot pēc<select value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="date_from">Datuma</option><option value="title">Nosaukuma</option><option value="municipality">Pašvaldības</option></select></label>
   <button className="button direction-button" onClick={()=>{setDirection(value=>-value);setPage(0);}} aria-label={direction===1?'Kārtot dilstoši':'Kārtot augoši'}>{direction===1?'↑':'↓'}</button>
   {viewMode==='table'&&<button className="button primary" disabled={!data||!filtered.length||exporting} onClick={exportExcel}>{exporting?'Gatavo Excel…':`Lejupielādēt Excel (${filtered.length})`}</button>}
  </div>

  <p role="status" className="sync-text">{exportStatus}</p>

  {viewMode==='table'&&<details className="mobile-table-filters">
   <summary>Filtrēt pasākumus{activeFilterCount||period!=='all'?` (${activeFilterCount+(period!=='all'?1:0)})`:''}</summary>
   <div className="mobile-filter-grid">
    {columns.filter(([key])=>mobileFilterKeys.has(key)).map(([key,label])=><label key={key}>{label}{filterControl(key,label)}</label>)}
   </div>
  </details>}

  {data&&filtered.length===0
   ?<div className="empty"><h2>Nav atrastu pasākumu</h2><p>{rows.length?'Pamēģini mainīt datumu, kategoriju vai noņemt aktīvos filtrus.':'Pašlaik nav publicētu pasākumu. Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.'}</p></div>
   :<>
    {viewMode==='cards'&&<div className="catalog-card-grid">{visible.map(event=>{const nav=navigationLinks(event);return <article className="catalog-event-card" key={event.id}>
     <div className="catalog-event-card-top"><time dateTime={event.date_from}>{display(event,'date_from')||'Datums nav norādīts'}</time><span>{display(event,'event_type')||event.primary_category||'Pasākums'}</span></div>
     <h2>{event.title}</h2><p className="catalog-event-card-location">⌖ {event.venue_name||event.address_raw||event.municipality||'Norises vieta nav zināma'}</p>
     <p className="catalog-event-card-time">{display(event,'time')||'Laiks nav norādīts'} · {display(event,'price_status')||'Maksa nav norādīta'}</p>
     <div className="catalog-event-card-follow">{followButton(event)}</div>
     <div className="catalog-event-card-actions"><button className="button compact primary" type="button" onClick={()=>setSelected(event.id)}>Par pasākumu</button><a className="button compact" href={'/karte?q='+encodeURIComponent(event.title)}>Kartē ↗</a>{nav.google&&<a className="button compact" href={nav.google} rel="noopener noreferrer" target="_blank" aria-label={'Maršruts uz '+event.title}>Maršruts ↗</a>}</div>
    </article>})}</div>}
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
      <span><b>Vieta</b>{event.venue_name||event.address_raw||'Nav norādīta'}</span>
      <span><b>Pašvaldība</b>{event.municipality||'Nav norādīta'}</span>
      <span><b>Veids</b>{display(event,'event_type')||event.primary_category||'Nav norādīts'}</span>
      <span><b>Maksa</b>{display(event,'price_status')}</span>
     </div>
     <div className="catalog-event-card-follow">{followButton(event)}</div>
     <button className="button compact mobile-event-open" onClick={()=>setSelected(event.id)}>Skatīt pasākumu</button>
    </article>)}</div>}
   </>}

  {data&&filtered.length>0&&<nav className="pagination" aria-label="Saraksta lapas">
   <button className="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Iepriekšējā</button>
   <span>{current+1}. / {pages} lapa · {current*pageSize+1}–{Math.min((current+1)*pageSize,filtered.length)}</span>
   <button className="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Nākamā →</button>
  </nav>}

  {selectedEvent&&<EventDetails event={selectedEvent} close={()=>setSelected(null)} followButton={followButton}/>}
 </>;
}

function EventDetails({event,close,followButton}){
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();},[]);
 return <dialog ref={dialog} className="event-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><h2>{event.title}</h2><button className="button" onClick={close} autoFocus>Aizvērt ✕</button></div>
  <div className="catalog-detail-actions">{followButton(event)}<a className="button primary" href={'/karte?q='+encodeURIComponent(event.title)}>Atvērt kartē ↗</a>{navigationLinks(event).google&&<a className="button" target="_blank" rel="noopener noreferrer" href={navigationLinks(event).google}>Google Maps ↗</a>}{navigationLinks(event).waze&&<a className="button" target="_blank" rel="noopener noreferrer" href={navigationLinks(event).waze}>Waze ↗</a>}</div>
  <dl>{[...columns,...detailColumns].filter(([key])=>key!=='title').map(([key,label])=><div key={key}>
   <dt>{label}</dt>
   <dd>{key==='source_url'
    ?event.sources.filter(source=>source.url).map((source,index)=><a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer" key={index}>{source.source||'Avots'} ↗</a>)
    :display(event,key)||'Nav norādīts'}</dd>
  </div>)}</dl>
 </dialog>;
}

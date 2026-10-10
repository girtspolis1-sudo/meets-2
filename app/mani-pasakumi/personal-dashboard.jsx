'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PersonalMap from './personal-map.jsx';
import {PlanIcon,HeartIcon,CheckIcon,CalendarIcon,RouteIcon,ExternalIcon,BellIcon} from './event-icons.jsx';
import {eventsAtPlace} from '../../lib/location-follow.js';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS,eventGroup} from '../../lib/home-category-filters.js';
import {coordinates,navigationLinks,rigaDate,eventOverlapsDate,recommendEvents,icsContent} from '../../lib/meets-personal.js';

const DEFAULT={interests:[],reminders:[],notices:[],follows:[],locationFollows:[],shared:null,directory:{organizations:[],venues:[],sources:[]},followedEvents:[],savedDetails:[]};
async function request(body){
 const res=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const data=await res.json();if(!res.ok)throw new Error(data.error||'Darbība neizdevās.');return data;
}
function dateText(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'Datums nav norādīts';
 return new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
}
function EventCard({event,favorites,plans,visits,reminders,busy,onToggle,onReminder}){
 const nav=navigationLinks(event);
 const official=event.sources?.find(s=>s.url?.startsWith('https://')||s.url?.startsWith('http://'))?.url;
 const lead=reminders.find(x=>x.event_id===event.id)?.lead_minutes||0;
 function downloadCalendar(){
  const str=icsContent(event);if(!str)return;
  const blob=new Blob([str],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='meets-'+event.id+'.ics';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <article className="meets-personal-event">
  <div className="meets-account-day"><strong>{event.date_from?.slice(8,10)||'—'}</strong><small>{event.date_from?.slice(5,7)||''}.</small></div>
  <div className="meets-personal-event-main"><h3>{event.title}</h3>
   <p>{[dateText(event.date_from),event.time_from?.slice(0,5),event.venue_name||event.municipality].filter(Boolean).join(' · ')}</p>
   <div className="meets-personal-actions" role="group" aria-label={'Tavas darbības pasākumam '+event.title}>
    <button className={favorites.includes(event.id)?'chosen':''} disabled={busy} aria-pressed={favorites.includes(event.id)} onClick={()=>onToggle(event.id,'favorite')}><HeartIcon/><span>{favorites.includes(event.id)?'Saglabāts':'Saglabāt'}</span></button>
    <button className={plans.includes(event.id)?'chosen':''} disabled={busy} aria-pressed={plans.includes(event.id)} onClick={()=>onToggle(event.id,'plan')}><PlanIcon/><span>Plānoju</span></button>
    <button className={visits.includes(event.id)?'chosen':''} disabled={busy} aria-pressed={visits.includes(event.id)} onClick={()=>onToggle(event.id,'visit')}><CheckIcon/><span>Apmeklēts</span></button>
    <button type="button" onClick={downloadCalendar} title="Saglabāt Apple, Google vai Outlook kalendāram"><CalendarIcon/><span>Kalendārā</span></button>
   </div>
   <div className="meets-personal-links">
    {nav.google?<details className="meets-personal-route"><summary><RouteIcon/> Maršruts</summary><div className="meets-personal-route-list">
     <a href={nav.google} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
     {nav.waze&&<a href={nav.waze} target="_blank" rel="noopener noreferrer">Waze ↗</a>}
    </div></details>:<span>Nav adreses navigācijai</span>}
    {official&&<a href={official} className="meets-personal-external" target="_blank" rel="noopener noreferrer"><ExternalIcon/> Lapa</a>}
    {!coordinates(event)&&<small>Precīza lokācija nav verificēta</small>}
   </div>
   <label className="meets-personal-reminder"><BellIcon/> Atgādinājums
    <select value={String(lead)} disabled={busy} onChange={e=>onReminder(event.id,Number(e.target.value))}>
     <option value="0">Izslēgts</option><option value="1440">1 dienu iepriekš</option><option value="120">2 stundas iepriekš</option>
    </select>
   </label>
  </div>
 </article>;
}
function CalendarView({events,selectedDate,setSelectedDate,month,setMonth,renderCards}){
 const [year,mm]=month.split('-').map(Number);
 const start=new Date(Date.UTC(year,mm-1,1));
 const begin=(start.getUTCDay()+6)%7;
 const days=new Date(Date.UTC(year,mm,0)).getUTCDate();
 const monthStart=new Date(Date.UTC(year,mm-1,1-begin));
 const boxes=Array.from({length:Math.ceil((begin+days)/7)*7},(_,i)=>{
  const d=new Date(monthStart);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);
 });
 const monthName=new Intl.DateTimeFormat('lv-LV',{month:'long',year:'numeric',timeZone:'UTC'}).format(start);
 const today=rigaDate();
 const selection=events.filter(e=>eventOverlapsDate(e,selectedDate));
 function move(delta){
  const dt=new Date(Date.UTC(year,mm-1+delta,1));setMonth(dt.toISOString().slice(0,7));setSelectedDate(dt.toISOString().slice(0,10));
 }
 return <div className="meets-personal-calendar">
  <div className="meets-personal-calendar-head"><button onClick={()=>move(-1)} aria-label="Iepriekšējais mēnesis">←</button><h3>{monthName}</h3><button onClick={()=>move(1)} aria-label="Nākamais mēnesis">→</button></div>
  <div className="meets-personal-calendar-grid">
   {['P','O','T','C','P','S','Sv'].map((d,i)=><span className="meets-personal-calendar-weekday" key={i}>{d}</span>)}
   {boxes.map(day=>{
    const count=events.filter(e=>eventOverlapsDate(e,day)).length;
    return <button key={day} className={[day.slice(0,7)===month?'':'other',day===today?'today':'',day===selectedDate?'selected':''].join(' ')}
     aria-label={dateText(day)+(count?' — '+count+' pasākumi':'')} aria-pressed={day===selectedDate} onClick={()=>setSelectedDate(day)}>
     <span>{Number(day.slice(-2))}</span>{!!count&&<em>{count}</em>}
    </button>;
   })}
  </div>
  <div className="meets-personal-calendar-results"><h3>{dateText(selectedDate)}</h3>
   {selection.length?renderCards(selection):<p className="meets-muted">Šajā dienā nav saglabātu pasākumu.</p>}
  </div>
 </div>;
}
export default function PersonalDashboard({session,favorites,plans,visits,onToggle,busy,events=[],loading}){
 const [view,setView]=useState('overview'),[moreOpen,setMoreOpen]=useState(false),[extra,setExtra]=useState(DEFAULT),[tabError,setTabError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const [month,setMonth]=useState(rigaDate().slice(0,7)),[selectedDate,setSelectedDate]=useState(rigaDate()),[mapScope,setMapScope]=useState('all'),[followQuery,setFollowQuery]=useState('');
 const [origin,setOrigin]=useState(null),[radius,setRadius]=useState(30),[locationError,setLocationError]=useState('');
 const token=session.access_token;
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('view')==='following')setView('following');},[]);
 const reload=useCallback(async()=>{const result=await request({action:'dashboard',token});setExtra({...DEFAULT,...result});},[token]);
 useEffect(()=>{let cancelled=false;async function load(){try{const result=await request({action:'dashboard',token});if(!cancelled)setExtra({...DEFAULT,...result});}catch(e){if(!cancelled)setTabError(e.message);}}
 load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
 return()=>{cancelled=true;clearInterval(timer);};},[token]);
 async function mutate(payload,onSuccess){
  setSaving(true);setTabError('');setMessage('');
  try{const value=await request({token,...payload});onSuccess?.(value);setMessage('Saglabāts.');}
  catch(e){setTabError(e.message);}finally{setSaving(false);}
 }
 const eventIndex=useMemo(()=>new Map([...(extra.savedDetails||[]).map(e=>[e.id,e]),...events.map(e=>[e.id,e])]),[events,extra.savedDetails]);
 const saved=[...new Set([...favorites,...plans])].map(id=>eventIndex.get(id)).filter(Boolean).sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));
 const upcoming=saved.filter(e=>String(e.date_to||e.date_from||'')>=rigaDate()).slice(0,3);
 const selectedIds=view==='favorites'?favorites:view==='planned'?plans:view==='visited'?visits:[...new Set([...favorites,...plans])];
 const selected=selectedIds.map(id=>eventIndex.get(id)).filter(Boolean).sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));
 const mapEvents=mapScope==='favorites'?favorites.map(id=>eventIndex.get(id)).filter(Boolean):mapScope==='planned'?plans.map(id=>eventIndex.get(id)).filter(Boolean):saved;
 const recommended=useMemo(()=>recommendEvents(events,extra.interests,favorites,plans,9,{origin,radiusKm:radius}),[events,extra.interests,favorites,plans,origin,radius]);
 const following=extra.followedEvents.map(id=>eventIndex.get(id)).filter(Boolean).sort((a,b)=>a.date_from.localeCompare(b.date_from));
 const followedLocations=extra.locationFollows||[];
 const locationEventGroups=followedLocations.map(place=>({
  ...place,upcoming:eventsAtPlace(events,place.location_key)
   .filter(event=>String(event.date_to||event.date_from||'')>=rigaDate())
   .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)))
 }));
 const unread=extra.notices.filter(n=>!n.read_at);
 const shared=extra.shared?.is_enabled&&extra.shared.share_token?'/saraksts/'+extra.shared.share_token:'';
 const shareUrl=shared?typeof window!=='undefined'?window.location.origin+shared:'https://meets-2.vercel.app'+shared:'';
 const cardEvents=items=><div className="meets-account-list">{items.map(event=><EventCard key={event.id} event={event} favorites={favorites} plans={plans} visits={visits} reminders={extra.reminders} busy={busy||saving} onToggle={onToggle}
  onReminder={(id,minutes)=>mutate({action:'reminder',eventId:id,enabled:minutes>0,leadMinutes:minutes||1440},()=>{
   setExtra(p=>({...p,reminders:minutes?[...p.reminders.filter(x=>x.event_id!==id),{event_id:id,lead_minutes:minutes}]:p.reminders.filter(x=>x.event_id!==id)}));
  })}/>)}</div>;
 const list=items=>items.length?cardEvents(items):<div className="meets-account-empty"><span>♡</span><h3>Šeit vēl nav saglabātu pasākumu</h3><p>Atver karti un atzīmē interesējošos pasākumus ar sirsniņu.</p><Link className="button primary" href="/karte">Atrast pasākumus ↗</Link></div>;
 async function copy(){if(!shareUrl)return;try{await navigator.clipboard.writeText(shareUrl);setMessage('Saite nokopēta.');}catch{setMessage('Saite ir laukā — iezīmē un kopē to.');}}
 return <div className="meets-personal-dashboard">
  <div className="meets-account-stats">
   <div><strong>{favorites.length}</strong><span>♡ Favorīti</span></div>
   <div><strong>{plans.length}</strong><span><PlanIcon/> Plānoju</span></div>
   <div><strong>{visits.length}</strong><span>✓ Apmeklēti</span></div>
  </div>
  {!!unread.length&&<div className="meets-personal-notices" role="status"><strong>🔔 {unread.length} atgādinājumi</strong>
   {unread.slice(0,5).map(n=><div key={n.id}><span>{n.message}: {eventIndex.get(n.event_id)?.title||'Saglabātais pasākums'}</span>
    <button disabled={saving} onClick={()=>mutate({action:'readNotice',notificationId:n.id},()=>setExtra(p=>({...p,notices:p.notices.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x)})))}>Izlasīts</button></div>)}
  </div>}
  <div className="meets-account-tabs meets-personal-tabs" role="group" aria-label="Personīgo pasākumu skati">
   {[
    ['overview','⌂ Pārskats'],['favorites','♡ Favorīti'],['planned',<><PlanIcon/> Plānoju</>],['calendar','▦ Kalendārs']
   ].map(([key,label])=><button key={key} type="button" aria-pressed={view===key} className={view===key?'active':''} onClick={()=>{setView(key);setMoreOpen(false);setTabError('');}}>{label}</button>)}
   <button type="button" aria-expanded={moreOpen} aria-controls="meets-extra-views" className={['map','recommend','following','visited'].includes(view)?'active':''} onClick={()=>setMoreOpen(v=>!v)}>Vēl ▾</button>
  </div>
  {moreOpen&&<div className="meets-account-tabs meets-personal-tabs meets-personal-more" id="meets-extra-views" role="group" aria-label="Papildu skati">
   {[
    ['map','⌖ Karte'],['recommend','✦ Ieteikumi'],['following','♧ Sekoju'],['visited','✓ Apmeklēti']
   ].map(([key,label])=><button type="button" key={key} aria-pressed={view===key} className={view===key?'active':''} onClick={()=>{setView(key);setMoreOpen(false);setTabError('');}}>{label}</button>)}
  </div>}
  {tabError&&<p className="meets-inline-error" role="alert">{tabError}</p>}
  {message&&<p className="meets-organizer-success" role="status">{message}</p>}
  {loading?<p className="meets-muted">Ielādē pasākumus…</p>:<>
   {view==='overview'&&<section className="meets-personal-overview">
    <div className="meets-personal-overview-header"><h2>Tavi tuvākie pasākumi</h2><button type="button" className="button compact" onClick={()=>setView('calendar')}><CalendarIcon/> Kalendārs ↗</button></div>
    {upcoming.length?cardEvents(upcoming):<div className="meets-account-empty"><span>♡</span><h3>Sāc savu pasākumu plānu</h3><p>Saglabā interesējošos pasākumus kartē. Tos atradīsi šeit.</p><Link className="button primary" href="/karte">Atrast pasākumus ↗</Link></div>}
    <div className="meets-personal-overview-header"><h2>Atklāj ko jaunu</h2><button type="button" className="button compact" onClick={()=>setView('recommend')}>Mani ieteikumi ↗</button></div>
    <p className="meets-muted">Iestatot intereses, saņemsi pasākumu ieteikumus. Atgādinājumi pagaidām ir redzami tikai šajā kontā.</p>
    <div className="meets-personal-overview-header"><h2>Manas sekotās norises vietas ({followedLocations.length})</h2><button type="button" className="button compact" onClick={()=>setView('following')}>Apskatīt vietas ↗</button></div>
    <p className="meets-muted">Seko konkrētai vietai <Link href="/pasakumi">pasākumu sarakstā</Link>, lai redzētu tās turpmākos pasākumus savā kontā.</p>
   </section>}
   {['favorites','planned','visited'].includes(view)&&list(selected)}
   {view==='calendar'&&<CalendarView events={saved} selectedDate={selectedDate} setSelectedDate={setSelectedDate} month={month} setMonth={setMonth} renderCards={cardEvents}/>}
   {view==='map'&&<><div className="meets-personal-heading-row"><h2>Manu pasākumu karte</h2>
    <select aria-label="Kartes pasākumu veids" value={mapScope} onChange={e=>setMapScope(e.target.value)}>
     <option value="all">Visi saglabātie</option><option value="favorites">Tikai favorīti</option><option value="planned">Tikai plānotie</option></select>
    </div><PersonalMap events={mapEvents}/>{!!mapEvents.length&&cardEvents(mapEvents)}</>}
   {view==='recommend'&&<section className="meets-personal-preferences">
    <h2>Manas intereses</h2><p className="meets-muted">Atzīmē tēmas, kas tevi interesē. Ieteikumi tiek atlasīti no publiskiem pasākumiem, nevis automātiski uzminēti.</p>
    <div className="meets-personal-interest-grid">{HOME_GROUP_KEYS.map(key=>{
     const choice=HOME_CATEGORY_FILTERS[key],selected=extra.interests.some(x=>x.category===key);
     return <button type="button" key={key} className={selected?'selected':''} disabled={saving}
      aria-pressed={selected} onClick={()=>mutate({action:'interest',category:key,enabled:!selected},()=>setExtra(p=>({...p,interests:selected?p.interests.filter(x=>x.category!==key):[...p.interests,{category:key}]})))}>
      <span>{choice.icon}</span><strong>{choice.title}</strong>{selected&&<em>✓</em>}
     </button>;
    })}</div>
    <div className="meets-personal-heading-row"><h2>Tev varētu patikt</h2><span>{recommended.length} ieteikumi</span></div>
    <div className="meets-personal-radius-filter">
     <button type="button" className="button" onClick={()=>{
      setLocationError('');
      if(!navigator.geolocation){setLocationError('Šajā ierīcē atrašanās vietas noteikšana nav pieejama.');return;}
      navigator.geolocation.getCurrentPosition(
       pos=>setOrigin({latitude:pos.coords.latitude,longitude:pos.coords.longitude}),
       ()=>setLocationError('Atrašanās vietu neizdevās noteikt. Vari turpināt pārlūkot visu Latviju.'),
       {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
      );
     }}>⌖ {origin?'Atrašanās vieta noteikta':'Ieteikumi man tuvumā'}</button>
     {origin&&<><label>Attālums
      <select aria-label="Ieteikumu attālums" value={radius} onChange={e=>setRadius(Number(e.target.value))}>
       <option value={10}>10 km</option><option value={30}>30 km</option><option value={50}>50 km</option><option value={100}>100 km</option>
      </select></label>
      <button type="button" className="button" onClick={()=>{setOrigin(null);setLocationError('');}}>Visa Latvija</button></>}
    </div>
    {locationError&&<p role="status" className="meets-muted">{locationError}</p>}
    {origin&&<p className="meets-muted">Atlasīti tikai pasākumi ar precīzu kartes punktu {radius} km rādiusā. Atrašanās vieta netiek saglabāta tavā kontā.</p>}
    {recommended.length?cardEvents(recommended):<p className="meets-muted">Izvēlies intereses, lai šeit parādītos piemēroti pasākumi. <Link href="/karte">Apskatīt visus pasākumus ↗</Link></p>}
   </section>}
   {view==='following'&&<section className="meets-personal-follows">
    <h2>Manas sekotās norises vietas</h2>
    <p className="meets-muted">No <Link href="/pasakumi">visu pasākumu saraksta</Link> vari sekot arī importētām norises vietām. Šeit redzami to gaidāmie pasākumi; e-pasta un push paziņojumi nav ieslēgti.</p>
    {locationEventGroups.length?<div className="meets-followed-venues">
     {locationEventGroups.map(place=><article className="meets-followed-venue" key={place.location_key}>
      <div className="meets-followed-venue-head">
       <div><strong>⌖ {place.location_name}</strong><small>{place.municipality} · {place.upcoming.length} aktuāli pasākumi</small></div>
       <button type="button" disabled={saving} className="catalog-follow-place following"
        onClick={()=>mutate({action:'followLocation',locationKey:place.location_key,locationName:place.location_name,municipality:place.municipality,enabled:false},()=>setExtra(p=>({...p,locationFollows:p.locationFollows.filter(x=>x.location_key!==place.location_key)})))}>✓ Sekoju</button>
      </div>
      {place.upcoming.length?<ul>{place.upcoming.slice(0,3).map(event=><li key={event.id}><strong>{event.title}</strong><span>{dateText(event.date_from)}</span></li>)}</ul>
       :<p className="meets-muted">Šobrīd šajā vietā nav gaidāmu publicētu pasākumu.</p>}
      <Link href={'/pasakumi?place='+encodeURIComponent(place.location_key)}>Visi pasākumi šajā vietā ↗</Link>
     </article>)}
    </div>:<p className="meets-muted">Vēl neseko nevienai norises vietai. <Link href="/pasakumi">Atver pasākumu sarakstu ↗</Link></p>}
    <h2>Seko organizatoriem un reģistrētām vietām</h2>
    <p className="meets-muted">Seko MEETS organizatoriem, vietām un publiskajiem pasākumu avotiem, piemēram, pašvaldībām vai sporta federācijām.</p>
    <input aria-label="Meklēt organizatorus vai norises vietas" placeholder="Meklēt organizatoru vai vietu…" value={followQuery} onChange={e=>setFollowQuery(e.target.value)}/>
    <div className="meets-personal-follow-list">
     {[
      ...(extra.directory.organizations||[]).map(x=>({...x,kind:'organization'})),
      ...(extra.directory.venues||[]).map(x=>({...x,kind:'venue'})),
      ...(extra.directory.sources||[]).map(x=>({...x,kind:'source'}))
     ].filter(x=>x.name.toLocaleLowerCase('lv').includes(followQuery.toLocaleLowerCase('lv'))).map(x=>{
      const active=extra.follows.some(f=>f.target_id===x.id&&f.target_kind===x.kind);
      return <div className="meets-personal-follow-row" key={x.kind+x.id}>
       <span>{x.kind==='venue'?'⌖':x.kind==='source'?'◈':'♙'} <strong>{x.name}</strong><small>{x.kind==='venue'?'Norises vieta':x.kind==='source'?'Pasākumu avots':'Organizators'}</small></span>
       <button disabled={saving} className={active?'selected':''} onClick={()=>mutate({action:'follow',targetId:x.id,targetKind:x.kind,enabled:!active},async()=>{
        setExtra(p=>({...p,follows:active?p.follows.filter(f=>!(f.target_id===x.id&&f.target_kind===x.kind)):[...p.follows,{target_id:x.id,target_kind:x.kind}]}));
        try{await reload();}catch{}
       })}>{active?'✓ Sekoju':'+ Sekot'}</button>
      </div>;
     })}
    </div>
    {!extra.directory.organizations?.length&&!extra.directory.venues?.length&&!extra.directory.sources?.length&&<p className="meets-muted">Pagaidām nav avotu ar publiskiem pasākumiem.</p>}
    <h2>Jaunie pasākumi no sekotajiem</h2>{following.length?cardEvents(following):<p className="meets-muted">Pagaidām nav jaunu publicētu pasākumu no izvēlētajiem organizatoriem un vietām.</p>}
   </section>}
  </>}
  <section className="meets-personal-sharing">
   <div><h2>↗ Dalīties ar manu favorītu sarakstu</h2>
    <p className="meets-muted">Tavs saraksts ir privāts, līdz ieslēdz kopīgošanu. Saite rāda tikai publiskus, aktuālus favorītus — ne tavu e-pastu.</p></div>
   {shared?<div className="meets-personal-share-link"><input readOnly aria-label="Kopīgojamā saite" value={shareUrl} onClick={e=>e.target.select()}/><button disabled={saving} onClick={copy}>Kopēt</button>
    <button disabled={saving} onClick={()=>mutate({action:'unshare'},()=>setExtra(p=>({...p,shared:{...p.shared,is_enabled:false}})))}>Izslēgt</button></div>:
    <button className="button" disabled={saving} onClick={()=>mutate({action:'share'},r=>setExtra(p=>({...p,shared:{share_token:r.token,is_enabled:true}})))}>Izveidot privātu kopīgošanas saiti</button>}
  </section>
  <p className="meets-personal-disclaimer">Atgādinājumi tiek saglabāti MEETS kontā un ir redzami, arī atverot lapu vēlāk. E-pasta un tālruņa push paziņojumi pagaidām nav ieslēgti.</p>
 </div>;
}

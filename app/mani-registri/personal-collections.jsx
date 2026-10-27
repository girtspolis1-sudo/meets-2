'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import EventQuickActions from '../components/event-quick-actions.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';
import {useEvents} from '../../lib/use-events.js';
import {cardDate,cardImage,cardLocation} from '../../lib/discovery-card.js';
import {eventsAtPlace} from '../../lib/location-follow.js';
import {filterRegistryEvents} from '../../lib/registry-filters.js';
import {MANUAL_COLLECTION_FILTER,isManualCollection,collectionEvents,eventInCollection} from '../../lib/personal-collections.js';

const SESSION='meets_user_session_v1';
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
async function call(endpoint,action,token,fields={}){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...fields})});
 const value=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(value.error||'Darbība neizdevās.');error.status=response.status;throw error;}
 return value;
}
async function getAccount(){
 let session=readSession();
 if(!session?.access_token)return null;
 if(session.expires_at&&session.expires_at<Date.now()+120000&&session.refresh_token){
  const next=await call('/api/account','refresh',session.refresh_token);
  session={...next,expires_at:Date.now()+(next.expires_in||3600)*1000};
  localStorage.setItem(SESSION,JSON.stringify(session));
  window.dispatchEvent(new Event('meets-user-changed'));
 }
 return session;
}
function MiniEvent({event,action}){
 return <div className="meets-collection-event meets-unified-collection-event">
  <span className="meets-unified-event-date" aria-hidden="true"><strong>{event.date_from?.slice(8,10)||'—'}</strong><small>{event.date_from?.slice(5,7)||'—'}.</small></span>
  <div><strong>{event.title}</strong><small>{cardDate(event)} · {cardLocation(event)}</small></div>
  {action}<Link href={'/pasakumi?event='+encodeURIComponent(event.id)} aria-label={'Atvērt pasākumu: '+event.title}>Atvērt →</Link>
 </div>;
}
export default function PersonalCollections(){
 const params=useSearchParams();
 const initialTab=['favorites','lists'].includes(params.get('tab'))?params.get('tab'):'lists';
 const [tab,setTab]=useState(initialTab),[session,setSession]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [lists,setLists]=useState([]),[favorites,setFavorites]=useState([]),[places,setPlaces]=useState([]),[venueFollows,setVenueFollows]=useState([]);
 const [directory,setDirectory]=useState({venues:[]}),[savedDetails,setSavedDetails]=useState([]);
 const [selected,setSelected]=useState(null),[newTitle,setNewTitle]=useState(''),[renaming,setRenaming]=useState(false);
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[query,setQuery]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const {data,loading:eventsLoading}=useEvents();
 const events=data?.events||[];
 const allEvents=useMemo(()=>[...new Map([...savedDetails,...events].map(e=>[e.id,e])).values()],[savedDetails,events]);
 const byId=useMemo(()=>new Map(allEvents.map(e=>[e.id,e])),[allEvents]);
 const manual=lists.filter(isManualCollection),legacy=lists.filter(x=>!isManualCollection(x));
 const current=manual.find(x=>x.id===selected);
 const selectedEvents=current?collectionEvents(allEvents,current):[];

 const reload=useCallback(async(currentSession)=>{
  const [registries,account,dashboard]=await Promise.all([
   call('/api/registries','list',currentSession.access_token),
   call('/api/account','list',currentSession.access_token),
   call('/api/account','dashboard',currentSession.access_token)
  ]);
  setLists((registries.registries||[]).filter(x=>!x.organization_id));
  setFavorites(account.favorites||[]);
  setPlaces(dashboard.locationFollows||[]);
  setVenueFollows((dashboard.follows||[]).filter(x=>x.target_kind==='venue'));
  setDirectory(dashboard.directory||{venues:[]});
  setSavedDetails(dashboard.savedDetails||[]);
  return currentSession;
 },[]);
 useEffect(()=>{let live=true;
  (async()=>{let current=readSession();if(!current?.access_token){if(live)setLoading(false);return;}
   try{current=await getAccount();
    try{await reload(current);}catch(e){
     if(e.status!==401||!current.refresh_token)throw e;
     const refreshed=await call('/api/account','refresh',current.refresh_token);
     current={...refreshed,expires_at:Date.now()+(refreshed.expires_in||3600)*1000};
     localStorage.setItem(SESSION,JSON.stringify(current));window.dispatchEvent(new Event('meets-user-changed'));
     await reload(current);
    }
    if(live)setSession(current);
   }catch(e){if(live)setError(e.message);}finally{if(live)setLoading(false);}
  })();return()=>{live=false;};
 },[reload]);
 useEffect(()=>{
  const update=async()=>{const current=readSession();if(!current?.access_token)return;
   try{const result=await call('/api/account','list',current.access_token);setFavorites(result.favorites||[]);}catch{}
  };
  window.addEventListener('meets-favorites-changed',update);
  return()=>window.removeEventListener('meets-favorites-changed',update);
 },[]);
 useEffect(()=>{
  const update=async()=>{const current=readSession();if(!current?.access_token)return;
   try{const result=await call('/api/account','locationFollows',current.access_token);setPlaces(result.locations||[]);}catch{}
  };
  window.addEventListener('meets-location-follows-changed',update);
  return()=>window.removeEventListener('meets-location-follows-changed',update);
 },[]);

 async function action(run,message){
  if(busy||!session)return;setBusy(true);setError('');setNotice('');
  try{await run();setNotice(message);}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function create(e){
  e.preventDefault();const title=newTitle.trim();if(title.length<3)return;
  await action(async()=>{
   const result=await call('/api/registries','save',session.access_token,{title,description:'',organization_id:null,filters:MANUAL_COLLECTION_FILTER,
    is_published:false,included_event_ids:[],excluded_event_ids:[]});
   setLists(prev=>[result.registry,...prev]);setSelected(result.registry.id);setNewTitle('');setTab('lists');setRenaming(false);
  },'Izveidots jauns saraksts.');
 }
 async function rename(e){
  e.preventDefault();if(!current)return;
  await action(async()=>{
   const b=await call('/api/registries','save',session.access_token,{...current,title:name.trim(),description,organization_id:null,
    filters:MANUAL_COLLECTION_FILTER,is_published:current.is_published});
   setLists(prev=>prev.map(x=>x.id===current.id?b.registry:x));setRenaming(false);
  },'Saraksts pārdēvēts.');
 }
 async function toggleEvent(item,id){
  if(!item)return;
  const enabled=!eventInCollection(item,id);
  await action(async()=>{
   const b=await call('/api/registries','toggleEvent',session.access_token,{id:item.id,event_id:id,enabled});
   setLists(prev=>prev.map(x=>x.id===item.id?b.registry:x));
  },enabled?'Pievienots sarakstam.':'Izņemts no saraksta.');
 }
 async function removeList(item){
  if(!window.confirm('Dzēst sarakstu “'+item.title+'”? Pasākumi un favorīti netiks dzēsti.'))return;
  await action(async()=>{
   await call('/api/registries','delete',session.access_token,{id:item.id});
   setLists(prev=>prev.filter(x=>x.id!==item.id));setSelected(null);
  },'Saraksts dzēsts. Pasākumu favorīti saglabāti.');
 }
 async function unfollow(place){
  await action(async()=>{
   await call('/api/account','followLocation',session.access_token,{
    enabled:false,locationKey:place.location_key,locationName:place.location_name,municipality:place.municipality
   });
   setPlaces(prev=>prev.filter(x=>x.location_key!==place.location_key));
   window.dispatchEvent(new Event('meets-location-follows-changed'));
  },'Vieta noņemta no iecienītajām.');
 }
 async function unfollowVenue(item){
  await action(async()=>{
   await call('/api/account','follow',session.access_token,{targetKind:'venue',targetId:item.target_id,enabled:false});
   setVenueFollows(prev=>prev.filter(x=>x.target_id!==item.target_id));
  },'Sekošana vietai pārtraukta.');
 }
 async function removeFavorite(id){
  await action(async()=>{
   await call('/api/account','remove',session.access_token,{eventId:id});
   setFavorites(prev=>prev.filter(x=>x!==id));
   const local=JSON.parse(localStorage.getItem('meets_favorites_v1')||'[]');
   localStorage.setItem('meets_favorites_v1',JSON.stringify((Array.isArray(local)?local:[]).filter(x=>String(x)!==id)));
   window.dispatchEvent(new Event('meets-favorites-changed'));
  },'Pasākums izņemts no favorītiem.');
 }
 function openList(item){setSelected(item.id);setName(item.title);setDescription(item.description||'');setRenaming(false);setQuery('');setTab('lists');setNotice('');}
 const candidates=useMemo(()=>query.trim().length<2?[]:events.filter(e=>String(e.title+' '+(e.venue_name||'')+' '+(e.municipality||'')).toLocaleLowerCase('lv')
   .includes(query.trim().toLocaleLowerCase('lv'))).slice(0,16),[events,query]);
 const favEvents=favorites.map(id=>byId.get(id)).filter(Boolean);
 const knownVenues=(directory.venues||[]).filter(x=>venueFollows.some(y=>y.target_id===x.id));
 const page=<section className="meets-account-page meets-collections">
  <header className="meets-account-heading"><div><p className="eyebrow">MANS MEETS</p><h1>Manas kolekcijas</h1>
</div>
    <Link className="button" href="/pasakumi">Atrast pasākumus →</Link>
  </header>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {loading?<p role="status">Ielādē tavas kolekcijas…</p>:!session?<section className="registry-panel"><h2>Pieslēdzies MEETS</h2><p>Personīgie saraksti un iecienītās vietas tiek saglabātas tavā kontā.</p><Link className="button primary" href="/profils">Pieslēgties →</Link></section>:<>
   <nav className="meets-collection-tabs" aria-label="Kolekciju veidi">
    <button type="button" className={tab==='favorites'?'active':''} aria-current={tab==='favorites'?'page':undefined} onClick={()=>{setTab('favorites');setSelected(null);}}>♡ Favorīti <small>{favorites.length}</small></button>
    <button type="button" className={tab==='lists'?'active':''} aria-current={tab==='lists'?'page':undefined} onClick={()=>setTab('lists')}>▤ Mani saraksti <small>{lists.length}</small></button>
   </nav>
   {tab==='favorites'&&<section className="meets-collection-panel"><div className="meets-collection-panel-head"><div><h2>Mani favorīti</h2><p>Visi ar sirsniņu saglabātie pasākumi. Tie nav automātiski pievienoti nevienam tavam sarakstam.</p></div><Link href="/mani-pasakumi" className="button">Plāni un kalendārs →</Link></div>
    {favEvents.length?<div className="meets-collection-event-list">{favEvents.map(e=><MiniEvent key={e.id} event={e} action={<div className="meets-collection-row-actions"><EventQuickActions event={e} listOnly/><button type="button" disabled={busy} onClick={()=>removeFavorite(e.id)} aria-label={'Noņemt no favorītiem: '+e.title}>♡ Noņemt</button></div>}/>)}</div>:
     <div className="meets-collection-empty"><strong>Te vēl nav pasākumu</strong><p>Atzīmē pasākumu ar ♡, un tas parādīsies šeit.</p><Link href="/pasakumi">Izpētīt pasākumus →</Link></div>}
    {favorites.length>favEvents.length&&<p className="meets-muted">Daži saglabātie pasākumi šobrīd nav pieejami aktuālajā katalogā.</p>}
   </section>}
   {tab==='lists'&&!current&&<section className="meets-collection-panel">
    <div className="meets-collection-panel-head"><div><h2>Mani saraksti</h2><p>Izveido savu izlasi, piemēram, “Koncerti”, “Ar bērniem” vai “Brīvdienām”. Pasākumus pievieno pats.</p></div></div>
    <form className="meets-create-playlist" onSubmit={create}><label htmlFor="new-playlist">Jauna saraksta nosaukums</label><div><input id="new-playlist" placeholder="Piemēram, Vasaras koncerti" value={newTitle} onChange={e=>setNewTitle(e.target.value)} maxLength={120} minLength={3} required/><button className="button primary" disabled={busy||newTitle.trim().length<3}>+ Izveidot sarakstu</button></div></form>
    {manual.length?<div className="meets-playlist-grid">{manual.map(item=>{
     const itemEvents=collectionEvents(allEvents,item),cover=itemEvents.find(x=>cardImage(x));
     return <button type="button" className="meets-playlist-card" key={item.id} onClick={()=>openList(item)}>
      <span className="meets-playlist-cover">{cover?<img src={cardImage(cover)} alt=""/>:<span aria-hidden="true">♫</span>}</span>
      <span className="meets-playlist-card-copy"><strong>{item.title}</strong><small>{(item.included_event_ids||[]).length} pievienoti pasākumi</small><small>{item.description||'Tava privātā pasākumu izlase'}</small></span><span aria-hidden="true">→</span>
     </button>;
    })}</div>:<p className="meets-collection-empty">Izveido pirmo sarakstu — gluži kā mūzikas atskaņošanas sarakstu.</p>}
    {legacy.length>0&&<div className="meets-legacy-list-note"><h3>Iepriekšējie filtrētie saraksti ({legacy.length})</h3><p>Vecie saraksti ir saglabāti ar to automātiskajiem atlases nosacījumiem. Tos vari atvērt un rediģēt vecajā režīmā, nemainot iepriekš atlasītos pasākumus.</p>
     <div>{legacy.map(item=><Link key={item.id} href={'/mani-registri?legacy=1&edit='+item.id}>{item.title} · {filterRegistryEvents(events,item.filters,item.included_event_ids,item.excluded_event_ids).length} aktuāli →</Link>)}</div></div>}
   </section>}
   {tab==='lists'&&current&&<section className="meets-collection-panel">
    <div className="meets-collection-panel-head"><div><button className="meets-collection-back" onClick={()=>{setSelected(null);setRenaming(false);}}>← Visi saraksti</button><h2>{current.title}</h2><p>{selectedEvents.length} pieejami pasākumi · {(current.included_event_ids||[]).length} pievienoti kopā</p></div><div className="meets-collection-row-actions">
     <button className="button" onClick={()=>setRenaming(v=>!v)}>Pārdēvēt</button><button className="button" disabled={busy} onClick={()=>removeList(current)}>Dzēst</button></div></div>
    {renaming&&<form className="meets-collection-rename" onSubmit={rename}><label>Nosaukums<input required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Apraksts<textarea value={description} maxLength={500} onChange={e=>setDescription(e.target.value)} rows={2}/></label><button disabled={busy||name.trim().length<3} className="button primary">Saglabāt</button></form>}
    <div className="meets-playlist-add"><h3>+ Pievienot pasākumu</h3><label htmlFor="playlist-search" className="sr-only">Meklēt pasākumu</label><input id="playlist-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Meklē pēc nosaukuma vai vietas…"/></div>
    {candidates.length>0&&<div className="meets-collection-search-results">{candidates.map(e=><div className="meets-collection-search-row" key={e.id}><span><strong>{e.title}</strong><small>{cardDate(e)} · {cardLocation(e)}</small></span><button className="button" disabled={busy||eventInCollection(current,e.id)} onClick={()=>toggleEvent(current,e.id)}>{eventInCollection(current,e.id)?'✓ Pievienots':'+ Pievienot'}</button></div>)}</div>}
    <h3>Saraksta pasākumi</h3>
    {selectedEvents.length?<div className="meets-collection-event-list">{selectedEvents.map(e=><MiniEvent key={e.id} event={e} action={<button className="meets-collection-remove" type="button" disabled={busy} onClick={()=>toggleEvent(current,e.id)} aria-label={'Izņemt no saraksta: '+e.title}>Izņemt</button>}/>)}</div>:
     <div className="meets-collection-empty"><p>Šis saraksts vēl ir tukšs. Meklē pasākumu un nospied “Pievienot”.</p></div>}
   </section>}
   {tab==='places'&&<section className="meets-collection-panel"><div className="meets-collection-panel-head"><div><h2>Iecienītās norises vietas</h2><p>Saglabā vietas tieši no pasākuma kartītes — ja tajā notiek jauns pasākums, tas būs atrodams šeit.</p></div><Link href="/sekosana" className="button">Visa sekošana →</Link></div>
    {places.map(place=><div className="meets-place-row" key={place.location_key}><span className="meets-place-row-icon" aria-hidden="true">⌖</span><span><strong>{place.location_name}</strong><small>{place.municipality} · {eventsAtPlace(events,place.location_key).length} aktuāli pasākumi</small></span>
     <div className="meets-collection-row-actions"><Link className="button" href={'/pasakumi?place='+encodeURIComponent(place.location_key)}>Pasākumi →</Link><button className="button" disabled={busy} onClick={()=>unfollow(place)}>Nesekot</button></div></div>)}
    {knownVenues.map(place=><div className="meets-place-row" key={place.id}><span className="meets-place-row-icon" aria-hidden="true">⌖</span><span><strong>{place.name}</strong><small>{place.address||'Publiska norises vieta'}</small></span><div className="meets-collection-row-actions"><Link className="button" href={'/vietas/'+place.id}>Atvērt →</Link><button className="button" disabled={busy} onClick={()=>unfollowVenue({target_id:place.id})}>Nesekot</button></div></div>)}
    {!places.length&&!venueFollows.length&&<div className="meets-collection-empty"><strong>Vēl nav iecienītu vietu</strong><p>Atver pasākumu un nospied “Saglabāt vietu”.</p><Link href="/pasakumi">Atklāt norises vietas →</Link></div>}
   </section>}
  </>}
 </section>;
 return session?<ProfileShell session={session}>{page}</ProfileShell>:page;
}

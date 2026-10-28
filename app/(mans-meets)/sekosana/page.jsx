'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useEvents} from '../../../lib/use-events.js';
import {eventsAtPlace} from '../../../lib/location-follow.js';
import {accountRequest,useAccountData} from '../../../lib/account-store.js';

export default function FollowingPage(){
 const {data,loading:eventsLoading}=useEvents();
 const {data:dashboard,error:loadError,loading,reload}=useAccountData('dashboard');
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const directory=dashboard?.directory||{organizations:[],venues:[],sources:[]},follows=dashboard?.follows||[];
 const byKind=kind=>follows.filter(x=>x.target_kind===kind).map(x=>x.target_id);
 const orgIds=byKind('organization'),venueIds=byKind('venue'),sourceIds=byKind('source');
 const orgs=(directory.organizations||[]).filter(x=>orgIds.includes(x.id));
 const venues=(directory.venues||[]).filter(x=>venueIds.includes(x.id));
 const sources=(directory.sources||[]).filter(x=>sourceIds.includes(x.id));
 const savedLocations=dashboard?.locationFollows||[];
 const followedEventIds=dashboard?.followedEvents||[];
 const eventIds=useMemo(()=>new Set(followedEventIds),[followedEventIds]);
 const upcoming=useMemo(()=>(data?.events||[]).filter(e=>eventIds.has(e.id)).sort((a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'))).slice(0,30),[data,eventIds]);
 async function unfollowLocation(place){
  setBusy(place.location_key);setError('');
  try{
   await accountRequest('/api/account','followLocation',{locationKey:place.location_key,locationName:place.location_name,municipality:place.municipality,enabled:false});
   await reload();
   window.dispatchEvent(new Event('meets-location-follows-changed'));
  }catch(e){setError(e.message);}finally{setBusy('');}
 }
 async function unfollow(kind,id){setBusy(kind+id);setError('');try{await accountRequest('/api/account','follow',{targetKind:kind,targetId:id,enabled:false});await reload();}catch(e){setError(e.message);}finally{setBusy('');}}
 return <section className="meets-account-page following-page">
  <div className="meets-account-heading"><div><p className="eyebrow">Mans MEETS</p><h1>Sekošana</h1><p className="meets-muted">Organizatori un norises vietas, kuru jaunajiem publicētajiem pasākumiem seko platformā.</p></div><Link className="button" href="/karte">Atrast pasākumus →</Link></div>
  {(error||loadError)&&<p className="meets-inline-error" role="alert">{error||loadError.message} {loadError&&<button type="button" className="text-button" onClick={()=>reload().catch(()=>{})}>Mēģināt vēlreiz</button>}</p>}
  {loading?<p role="status">Ielādē sekošanu…</p>:!dashboard?null:<>
   <div className="following-grid"><section className="org-panel"><h2>Organizatori ({orgs.length})</h2><div className="org-list">{orgs.map(x=><div className="org-row" key={x.id}><div><strong>{x.name}</strong><small>Organizators</small></div><div className="org-row-actions"><Link className="button" href={'/organizatori/'+x.id}>Atvērt</Link><button className="button" disabled={busy===('organization'+x.id)} onClick={()=>unfollow('organization',x.id)}>Nesekot</button></div></div>)}{!orgs.length&&<p className="org-empty">Vēl neseko nevienam organizatoram.</p>}</div></section>
    <section className="org-panel"><h2>Norises vietas ({venues.length})</h2><div className="org-list">{venues.map(x=><div className="org-row" key={x.id}><div><strong>{x.name}</strong><small>Norises vieta</small></div><div className="org-row-actions"><Link className="button" href={'/vietas/'+x.id}>Atvērt</Link><button className="button" disabled={busy===('venue'+x.id)} onClick={()=>unfollow('venue',x.id)}>Nesekot</button></div></div>)}{!venues.length&&<p className="org-empty">Vēl neseko nevienai publiskai vietai.</p>}</div></section></div>
   <section className="org-panel"><div className="org-panel-head"><div><h2>Manas iecienītās vietas ({savedLocations.length})</h2>
    <p>Norises vietas, kurām seko no pasākumu kartītēm. Tās glabājas atsevišķi no saglabātajiem pasākumiem.</p></div></div>
    <div className="org-list">{savedLocations.map(place=><div className="org-row" key={place.location_key}><div><strong>{place.location_name}</strong>
      <small>{place.municipality} · {eventsAtPlace(data?.events||[],place.location_key).length} aktuāli pasākumi</small></div>
      <div className="org-row-actions"><Link className="button" href={'/pasakumi?place='+encodeURIComponent(place.location_key)}>Pasākumi →</Link>
      <button className="button" disabled={busy===place.location_key} onClick={()=>unfollowLocation(place)}>Nesekot</button></div></div>)}
      {!savedLocations.length&&<p className="org-empty">Pagaidām neseko nevienai no pasākumiem saglabātai norises vietai.</p>}
    </div>
   </section>
   {sources.length>0&&<section className="org-panel"><h2>Citi avoti</h2><p className="meets-muted">Saglabātas iepriekšējās sekošanas no MEETS datu avotiem.</p><div className="org-list">{sources.map(x=><div className="org-row" key={x.id}><strong>{x.name}</strong><button className="button" onClick={()=>unfollow('source',x.id)}>Nesekot</button></div>)}</div></section>}
   <section className="org-panel"><div className="org-panel-head"><div><h2>Gaidāmie pasākumi no sekošanas</h2><p>Šeit ir tikai jau publicētie MEETS pasākumi. E-pasta vai push paziņojumi netiek solīti.</p></div></div>
    {eventsLoading?<p>Ielādē pasākumus…</p>:<div className="following-event-grid">{upcoming.map(e=><article key={e.id}><span>{e.date_from||'Bez datuma'}</span><h3>{e.title}</h3><p>{e.venue_name||e.municipality||'Vieta nav norādīta'}</p><Link href={'/karte?event='+e.id}>Atvērt kartē →</Link></article>)}</div>}{!eventsLoading&&!upcoming.length&&<p className="org-empty">Sekošanas vienībām pašlaik nav gaidāmu publicētu pasākumu.</p>}
   </section>
  </>}
 </section>;
}

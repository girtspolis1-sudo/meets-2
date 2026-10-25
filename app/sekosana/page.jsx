'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import ProfileShell from '../components/profile-shell.jsx';
import {useEvents} from '../../lib/use-events.js';

const SESSION='meets_user_session_v1';
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
async function account(action,values={},session=readSession()){
 const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:session?.access_token,...values})});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Darbība neizdevās.');return b;
}
export default function FollowingPage(){
 const {data,loading:eventsLoading}=useEvents();
 const [session,setSession]=useState(null),[dashboard,setDashboard]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function load(current){const b=await account('dashboard',{},current);setDashboard(b);}
 useEffect(()=>{let active=true;(async()=>{const current=readSession();if(!current?.access_token){setLoading(false);return;}try{await load(current);if(active)setSession(current);}catch(e){if(active)setError(e.message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);
 const directory=dashboard?.directory||{organizations:[],venues:[],sources:[]},follows=dashboard?.follows||[];
 const byKind=kind=>follows.filter(x=>x.target_kind===kind).map(x=>x.target_id);
 const orgIds=byKind('organization'),venueIds=byKind('venue'),sourceIds=byKind('source');
 const orgs=(directory.organizations||[]).filter(x=>orgIds.includes(x.id));
 const venues=(directory.venues||[]).filter(x=>venueIds.includes(x.id));
 const sources=(directory.sources||[]).filter(x=>sourceIds.includes(x.id));
 const eventIds=new Set(dashboard?.followedEvents||[]);
 const upcoming=useMemo(()=>(data?.events||[]).filter(e=>eventIds.has(e.id)).sort((a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'))).slice(0,30),[data,eventIds.size]);
 async function unfollow(kind,id){setBusy(kind+id);setError('');try{await account('follow',{targetKind:kind,targetId:id,enabled:false},session);await load(session);}catch(e){setError(e.message);}finally{setBusy('');}}
 const page=<section className="meets-account-page following-page">
  <div className="meets-account-heading"><div><p className="eyebrow">Mans MEETS</p><h1>Sekošana</h1><p className="meets-muted">Organizatori un norises vietas, kuru jaunajiem publicētajiem pasākumiem seko platformā.</p></div><Link className="button" href="/karte">Atrast pasākumus →</Link></div>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {loading?<p role="status">Ielādē sekošanu…</p>:!session?<div className="org-empty-state"><h2>Pieslēdzies savam MEETS kontam</h2><p>Sekošana tiek glabāta tavā kontā.</p><Link className="button primary" href="/profils">Pieslēgties →</Link></div>:<>
   <div className="following-grid"><section className="org-panel"><h2>Organizatori ({orgs.length})</h2><div className="org-list">{orgs.map(x=><div className="org-row" key={x.id}><div><strong>{x.name}</strong><small>Organizators</small></div><div className="org-row-actions"><Link className="button" href={'/organizatori/'+x.id}>Atvērt</Link><button className="button" disabled={busy===('organization'+x.id)} onClick={()=>unfollow('organization',x.id)}>Nesekot</button></div></div>)}{!orgs.length&&<p className="org-empty">Vēl neseko nevienam organizatoram.</p>}</div></section>
    <section className="org-panel"><h2>Norises vietas ({venues.length})</h2><div className="org-list">{venues.map(x=><div className="org-row" key={x.id}><div><strong>{x.name}</strong><small>Norises vieta</small></div><div className="org-row-actions"><Link className="button" href={'/vietas/'+x.id}>Atvērt</Link><button className="button" disabled={busy===('venue'+x.id)} onClick={()=>unfollow('venue',x.id)}>Nesekot</button></div></div>)}{!venues.length&&<p className="org-empty">Vēl neseko nevienai publiskai vietai.</p>}</div></section></div>
   {sources.length>0&&<section className="org-panel"><h2>Citi avoti</h2><p className="meets-muted">Saglabātas iepriekšējās sekošanas no MEETS datu avotiem.</p><div className="org-list">{sources.map(x=><div className="org-row" key={x.id}><strong>{x.name}</strong><button className="button" onClick={()=>unfollow('source',x.id)}>Nesekot</button></div>)}</div></section>}
   <section className="org-panel"><div className="org-panel-head"><div><h2>Gaidāmie pasākumi no sekošanas</h2><p>Šeit ir tikai jau publicētie MEETS pasākumi. E-pasta vai push paziņojumi netiek solīti.</p></div></div>
    {eventsLoading?<p>Ielādē pasākumus…</p>:<div className="following-event-grid">{upcoming.map(e=><article key={e.id}><span>{e.date_from||'Bez datuma'}</span><h3>{e.title}</h3><p>{e.venue_name||e.municipality||'Vieta nav norādīta'}</p><Link href={'/karte?event='+e.id}>Atvērt kartē →</Link></article>)}</div>}{!eventsLoading&&!upcoming.length&&<p className="org-empty">Sekošanas vienībām pašlaik nav gaidāmu publicētu pasākumu.</p>}
   </section>
  </>}
 </section>;
 return session?<ProfileShell session={session}>{page}</ProfileShell>:page;
}

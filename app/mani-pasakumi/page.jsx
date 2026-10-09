'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useEvents} from '../../lib/use-events.js';

const SESSION='meets_user_session_v1';
const LOCAL='meets_favorites_v1';
async function rpc(body){const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'Darbība neizdevās.');return data;}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function saveSession(s){try{localStorage.setItem(SESSION,JSON.stringify(s));window.dispatchEvent(new Event('meets-user-changed'));}catch{}}
function getLocal(){try{const ids=JSON.parse(localStorage.getItem(LOCAL)||'[]');return Array.isArray(ids)?ids:[];}catch{return [];}}
export default function MyEvents(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[code,setCode]=useState(''),[phase,setPhase]=useState('email'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[favorites,setFavorites]=useState([]),[plans,setPlans]=useState([]),[tab,setTab]=useState('planned');
 const {data,loading}=useEvents();
 async function load(account){
  const result=await rpc({action:'list',token:account.access_token});
  const local=getLocal();const merged=new Set(result.favorites);
  for(const eventId of local){if(!merged.has(eventId)){try{await rpc({action:'add',token:account.access_token,eventId});merged.add(eventId);}catch{}}}
  setFavorites([...merged]);setPlans(result.plans);try{localStorage.setItem(LOCAL,JSON.stringify([...merged]));}catch{}
 }
 useEffect(()=>{let active=true;(async()=>{let existing=getSession();if(!existing)return;try{await load(existing);if(active)setSession(existing);}catch{try{const renewed=await rpc({action:'refresh',token:existing.refresh_token});existing=renewed;saveSession(renewed);await load(renewed);if(active)setSession(renewed);}catch{saveSession(null);}}})();return()=>{active=false;};},[]);
 async function send(event){event.preventDefault();setBusy(true);setError('');try{await rpc({action:'send',email:email.trim().toLowerCase()});setPhase('code');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function verify(event){event.preventDefault();setBusy(true);setError('');try{const account=await rpc({action:'verify',email:email.trim().toLowerCase(),code});saveSession(account);setSession(account);await load(account);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function change(id,kind){if(!session)return;setBusy(true);setError('');try{const current=kind==='plan'?plans:favorites;const present=current.includes(id);await rpc({action:kind==='plan'?(present?'unplan':'plan'):(present?'remove':'add'),token:session.access_token,eventId:id});const updated=present?current.filter(x=>x!==id):[...current,id];if(kind==='plan')setPlans(updated);else{setFavorites(updated);localStorage.setItem(LOCAL,JSON.stringify(updated));window.dispatchEvent(new Event('meets-favorites-changed'));}}catch(e){setError(e.message);}finally{setBusy(false);}}
 const events=useMemo(()=>{const ids=tab==='planned'?plans:favorites;const index=new Map((data?.events||[]).map(e=>[e.id,e]));return ids.map(id=>index.get(id)).filter(Boolean).sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));},[data,plans,favorites,tab]);
 function logout(){saveSession(null);setSession(null);setFavorites([]);setPlans([]);setPhase('email');setCode('');}
 return <section className="meets-account-page">
  <div className="meets-account-heading"><div><p className="eyebrow">Tavs MEETS</p><h1>Mani pasākumi</h1><p className="meets-muted">Saglabā, plāno un atrodi pasākumus vienuviet.</p></div><Link href="/karte" className="button">Karte ↗</Link></div>
  {!session?<div className="meets-account-login"><div className="meets-account-symbol">♡</div><h2>{phase==='email'?'Pieslēdzies':'Apstiprini e-pastu'}</h2><p className="meets-muted">{phase==='email'?'Lai saglabātu savus favorītus visās ierīcēs.':'Ievadi e-pastā saņemto kodu.'}</p>
  {phase==='email'?<form onSubmit={send}><label>E-pasts<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="vards@epasts.lv"/></label><button disabled={busy} className="button primary" type="submit">{busy?'Sūta…':'Saņemt kodu →'}</button></form>:
  <form onSubmit={verify}><label>Apstiprinājuma kods<input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="000000"/></label><button disabled={busy} className="button primary" type="submit">{busy?'Pārbauda…':'Apstiprināt →'}</button><button className="button" type="button" onClick={()=>setPhase('email')}>Mainīt e-pastu</button></form>}
  <p className="meets-muted meets-account-hint">Pagaidām droša pieteikšanās ar e-pasta kodu. Personīgais 6 ciparu PIN tiks pievienots pēc aizsardzības ieviešanas.</p></div>:
  <><div className="meets-account-toolbar"><span>✓ {session.user?.email||email}</span><button type="button" className="button" onClick={logout}>Iziet</button></div><div className="meets-account-stats"><div><strong>{favorites.length}</strong><span>Favorīti</span></div><div><strong>{plans.length}</strong><span>Plānoju</span></div></div><div className="meets-account-tabs" role="tablist"><button role="tab" aria-selected={tab==='planned'} className={tab==='planned'?'active':''} onClick={()=>setTab('planned')}>▣ Plānoju</button><button role="tab" aria-selected={tab==='favorites'} className={tab==='favorites'?'active':''} onClick={()=>setTab('favorites')}>♡ Favorīti</button></div>
  {loading?<p className="meets-muted">Ielādē pasākumus…</p>:events.length?<div className="meets-account-list">{events.map(item=><article key={item.id} className="meets-account-event"><div className="meets-account-day"><strong>{item.date_from?.slice(8,10)}</strong><small>{item.date_from?.slice(5,7)}.</small></div><div className="meets-account-event-body"><h3>{item.title}</h3><p>{[item.time_from?.slice(0,5),item.venue_name||item.municipality].filter(Boolean).join(' · ')}</p><div className="meets-account-event-actions"><button type="button" aria-label={favorites.includes(item.id)?'Noņemt no favorītiem':'Pievienot favorītiem'} title="Favorīti" aria-pressed={favorites.includes(item.id)} disabled={busy} onClick={()=>change(item.id,'favorite')}>{favorites.includes(item.id)?'♥':'♡'}</button><button type="button" title="Plānoju apmeklēt" aria-label={plans.includes(item.id)?'Noņemt no plāniem':'Plānoju apmeklēt'} aria-pressed={plans.includes(item.id)} disabled={busy} onClick={()=>change(item.id,'plan')}>▣</button><Link href="/karte" title="Atvērt karti" aria-label="Atvērt karti">↗</Link></div></div></article>)}</div>:<div className="meets-account-empty"><span>♡</span><h3>Te vēl ir tukšs</h3><p>Pievieno pasākumu kartē, nospiežot sirsniņu.</p><Link className="button primary" href="/karte">Atvērt karti ↗</Link></div>}
  <section className="meets-organizer-intro"><h2>Rīko pasākumus?</h2><p>Organizatoru un vietu pārvaldība tiek gatavota. Reģistrācijai izmantosi šo pašu kontu.</p></section></>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </section>;
}
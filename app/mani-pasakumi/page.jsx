'use client';
import {useEffect,useState} from 'react';
import PersonalDashboard from './personal-dashboard.jsx';
import Link from 'next/link';
import {useEvents} from '../../lib/use-events.js';

const SESSION='meets_user_session_v1';
const LOCAL='meets_favorites_v1';
async function rpc(body){const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'Darbība neizdevās.');return data;}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function saveSession(s){try{localStorage.setItem(SESSION,JSON.stringify(s));window.dispatchEvent(new Event('meets-user-changed'));}catch{}}
function getLocal(){try{const ids=JSON.parse(localStorage.getItem(LOCAL)||'[]');return Array.isArray(ids)?ids:[];}catch{return [];}}
export default function MyEvents(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[mode,setMode]=useState('register'),[showPassword,setShowPassword]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[favorites,setFavorites]=useState([]),[plans,setPlans]=useState([]),[visits,setVisits]=useState([]);
 const {data,loading}=useEvents();
 async function load(account){
  const result=await rpc({action:'list',token:account.access_token});
  const local=getLocal();const merged=new Set(result.favorites);
  for(const eventId of local){if(!merged.has(eventId)){try{await rpc({action:'add',token:account.access_token,eventId});merged.add(eventId);}catch{}}}
  setFavorites([...merged]);setPlans(result.plans);setVisits(result.visits||[]);try{localStorage.setItem(LOCAL,JSON.stringify([...merged]));}catch{}
 }
 useEffect(()=>{let active=true;(async()=>{let existing=getSession();if(!existing)return;try{await load(existing);if(active)setSession(existing);}catch{try{const renewed=await rpc({action:'refresh',token:existing.refresh_token});existing=renewed;saveSession(renewed);await load(renewed);if(active)setSession(renewed);}catch{saveSession(null);}}})();return()=>{active=false;};},[]);
 async function authenticate(event){
  event.preventDefault();setError('');setNotice('');
  if(mode==='register'&&password!==confirmPassword){setError('Paroles nesakrīt.');return;}
  setBusy(true);
  try{
   const result=await rpc({action:mode==='register'?'register':'login',email:email.trim().toLowerCase(),password});
   if(result.requiresConfirmation){setNotice('Konts izveidots, bet Supabase vēl pieprasa e-pasta apstiprinājumu. Pārbaudi reģistrācijas iestatījumus vai izmanto citu e-pastu.');setMode('login');return;}
   saveSession(result);setSession(result);setPassword('');setConfirmPassword('');await load(result);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function change(id,kind){
  if(!session)return;setBusy(true);setError('');
  try{
   const current=kind==='plan'?plans:kind==='visit'?visits:favorites;
   const present=current.includes(id);
   const action=kind==='plan'?(present?'unplan':'plan'):kind==='visit'?(present?'unvisit':'visit'):(present?'remove':'add');
   await rpc({action,token:session.access_token,eventId:id});
   const next=present?current.filter(x=>x!==id):[...current,id];
   if(kind==='plan')setPlans(next);
   else if(kind==='visit')setVisits(next);
   else{
    setFavorites(next);
    try{localStorage.setItem(LOCAL,JSON.stringify(next));window.dispatchEvent(new Event('meets-favorites-changed'));}catch{}
   }
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 function logout(){saveSession(null);setSession(null);setFavorites([]);setPlans([]);setVisits([]);setMode('login');setPassword('');setConfirmPassword('');}
 return <section className="meets-account-page">
  <div className="meets-account-heading"><div><p className="eyebrow">Tavs MEETS</p><h1>Mani pasākumi</h1><p className="meets-muted">Saglabā, plāno un atrodi pasākumus vienuviet.</p></div><Link href="/karte" className="button">Karte ↗</Link></div>
  {!session?<div className="meets-account-login"><div className="meets-account-symbol">♡</div>
   <h2>{mode==='register'?'Izveidot kontu':'Pieslēgties'}</h2>
   <p className="meets-muted">{mode==='register'?'Reģistrējies un uzreiz saglabā savus pasākumus.':'Ievadi savu e-pastu un paroli.'}</p>
   <form onSubmit={authenticate}>
    <label>E-pasts<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="vards@epasts.lv"/></label>
    <label>Parole<div className="meets-password-field"><input type={showPassword?'text':'password'} autoComplete={mode==='register'?'new-password':'current-password'} minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Vismaz 8 rakstzīmes"/><button type="button" aria-label={showPassword?'Paslēpt paroli':'Parādīt paroli'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Paslēpt':'Rādīt'}</button></div></label>
    {mode==='register'&&<label>Atkārtot paroli<input type={showPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Atkārto paroli"/></label>}
    {mode==='register'&&password.length>0&&<p className="meets-password-note" role="status">{password.length<8?'Vēl '+(8-password.length)+' rakstzīmes':confirmPassword&&confirmPassword!==password?'Paroles nesakrīt':'✓ Parole atbilst garuma prasībai'}</p>}
    <button disabled={busy} className="button primary" type="submit">{busy?'Lūdzu, uzgaidi…':mode==='register'?'Reģistrēties →':'Pieslēgties →'}</button>
   </form>
   <button type="button" className="button" style={{marginTop:12}} onClick={()=>{setMode(mode==='register'?'login':'register');setError('');setNotice('');setPassword('');setConfirmPassword('');}}>{mode==='register'?'Man jau ir konts':'Izveidot jaunu kontu'}</button>
   {error&&<p role="alert" className="meets-inline-error">{error}</p>}
   {notice&&<p role="status" className="meets-muted">{notice}</p>}
   <p className="meets-muted meets-account-hint">E-pasts un tava parole. Kods nav jāgaida.</p>
  </div>:
  <><div className="meets-account-toolbar"><span>✓ {session.user?.email||email}</span><button type="button" className="button" onClick={logout}>Iziet</button></div>
   <PersonalDashboard session={session} favorites={favorites} plans={plans} visits={visits} onToggle={change}
    busy={busy} events={data?.events||[]} loading={loading}/>
  </>}
  {session&&error&&<p className="error-message" role="alert">{error}</p>}
 </section>;
}
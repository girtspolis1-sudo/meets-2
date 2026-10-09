'use client';
import {useEffect,useState} from 'react';
import OrganizerPage from '../organizators/page.jsx';
import Link from 'next/link';

const KEY='meets_user_session_v1';
const OPTIONS=[
 {kind:'organizer',icon:'◈',title:'Reģistrēt pasākumus',subtitle:'Vienreizēji, regulāri vai ilgstoši notikumi'},
 {kind:'venue',icon:'⌖',title:'Reģistrēt norises vietu',subtitle:'Pastāvīga adrese, kurā veido dažādus pasākumus'}
];
async function auth(action,email,password){
 const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,password})});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Neizdevās izveidot kontu.');return d;
}
export default function RegisterEventPage(){
 const [ready,setReady]=useState(false),[session,setSession]=useState(null),[kind,setKind]=useState(''),[mode,setMode]=useState('register');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  try{setSession(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{}
  setReady(true);
 },[]);
 async function submit(e){
  e.preventDefault();setError('');
  if(mode==='register'&&password!==confirmation){setError('Paroles nesakrīt.');return;}
  setBusy(true);
  try{
   const result=await auth(mode==='register'?'register':'login',email.trim().toLowerCase(),password);
   if(!result.access_token){setError('Konts izveidots, bet vēl nepieciešams e-pasta apstiprinājums.');return;}
   localStorage.setItem(KEY,JSON.stringify(result));
   window.dispatchEvent(new Event('meets-user-changed'));
   setSession(result);setPassword('');setConfirmation('');
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 if(!ready)return <section className="meets-organizer-page"><p className="meets-muted">Ielādē…</p></section>;
 if(!kind)return <section className="meets-organizer-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Organizatoriem</p><h1>Reģistrēt pasākumu</h1><p className="meets-muted">Izvēlies, ko vēlies pārvaldīt.</p></div><Link href="/mani-pasakumi" className="button">♡ Mani pasākumi</Link></div>
  <div className="meets-register-kind-grid">
   {OPTIONS.map(o=><button type="button" className="meets-register-kind" key={o.kind} onClick={()=>setKind(o.kind)}><span className="meets-register-kind-icon">{o.icon}</span><strong>{o.title}</strong><small>{o.subtitle}</small><span className="meets-register-kind-arrow">Turpināt →</span></button>)}
  </div>
 </section>;
 if(session?.access_token)return <div><div className="meets-register-back"><button type="button" className="button" onClick={()=>setKind('')}>← Mainīt reģistrācijas veidu</button></div><OrganizerPage initialKind={kind}/></div>;
 return <section className="meets-account-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Organizatoriem</p><h1>{kind==='venue'?'Vietas pārvaldnieks':'Pasākumu organizators'}</h1><p className="meets-muted">Izveido organizatora piekļuvi ar e-pastu un paroli.</p></div><button className="button" onClick={()=>setKind('')}>← Atpakaļ</button></div>
  <div className="meets-account-login">
   <h2>{mode==='register'?'Izveidot kontu':'Pieslēgties'}</h2>
   <p className="meets-muted">Viens MEETS lietotājs — atsevišķs organizatora profils un tiesības.</p>
   <form onSubmit={submit}>
    <label>E-pasts<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="vards@epasts.lv"/></label>
    <label>Parole<div className="meets-password-field"><input type={showPassword?'text':'password'} required minLength={8} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Vismaz 8 rakstzīmes"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Paslēpt':'Rādīt'}</button></div></label>
    {mode==='register'&&<label>Atkārtot paroli<input type={showPassword?'text':'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>}
    <button type="submit" className="button primary" disabled={busy}>{busy?'Uzgaidi…':mode==='register'?'Izveidot kontu →':'Pieslēgties →'}</button>
   </form>
   <button type="button" className="button" style={{marginTop:12}} onClick={()=>{setMode(mode==='register'?'login':'register');setError('');}}>{mode==='register'?'Man jau ir MEETS konts':'Izveidot jaunu kontu'}</button>
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  </div>
 </section>;
}
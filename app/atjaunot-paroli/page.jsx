'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {readAuthRedirect,requestPasswordReset,updatePassword} from '../../lib/auth-client.js';
import {saveSession} from '../../lib/account-store.js';

// Target of the password recovery e-mail: Supabase appends the recovery tokens.
export default function ResetPassword(){
 const [stage,setStage]=useState('checking'),[recovery,setRecovery]=useState(null);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[show,setShow]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  readAuthRedirect().then(result=>{
   if(result?.session){setRecovery(result.session);setStage('password');}
   else{setStage('request');if(result?.error)setError(result.error);}
  }).catch(e=>{setStage('request');setError(e.message);});
 },[]);
 async function sendLink(event){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{await requestPasswordReset(email);setNotice('Ja šim e-pastam ir MEETS konts, nosūtījām jaunu saiti. Pārbaudi arī mēstuļu mapi.');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function savePassword(event){
  event.preventDefault();setError('');
  if(password!==repeat){setError('Paroles nesakrīt.');return;}
  setBusy(true);
  try{await updatePassword(recovery.access_token,password);saveSession(recovery);setStage('done');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="meets-profile-auth" aria-labelledby="reset-title">
  <p className="eyebrow">MANS MEETS</p>
  <h1 id="reset-title">{stage==='done'?'Parole nomainīta':'Paroles atjaunošana'}</h1>
  {stage==='checking'&&<p role="status">Pārbauda saiti…</p>}
  {stage==='password'&&<form className="quick-flow-stack quick-flow-auth" onSubmit={savePassword}>
   <p className="meets-muted">Konts: <strong>{recovery?.user?.email}</strong>. Izvēlies jaunu paroli.</p>
   <label>Jaunā parole<input type={show?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoFocus/></label>
   <label>Atkārtot paroli<input type={show?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
   <label className="quick-flow-check"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Rādīt paroli</label>
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}
   <button className="button primary" type="submit" disabled={busy}>{busy?'Saglabā…':'Saglabāt jauno paroli'}</button>
  </form>}
  {stage==='request'&&<form className="quick-flow-stack quick-flow-auth" onSubmit={sendLink}>
   <p className="meets-muted">Ievadi sava konta e-pastu, un nosūtīsim saiti jaunas paroles iestatīšanai.</p>
   <label>E-pasts<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}
   {notice&&<p className="meets-auth-notice" role="status">{notice}</p>}
   <button className="button primary" type="submit" disabled={busy}>{busy?'Sūta…':'Nosūtīt saiti'}</button>
   <Link className="button" href="/profils">← Atpakaļ uz pieslēgšanos</Link>
  </form>}
  {stage==='done'&&<div className="quick-flow-stack">
   <p className="meets-auth-notice" role="status">Jaunā parole saglabāta, un pieslēgšanās ir aktīva.</p>
   <Link className="button primary" href="/profils">Atvērt Mans MEETS →</Link>
  </div>}
 </section>;
}

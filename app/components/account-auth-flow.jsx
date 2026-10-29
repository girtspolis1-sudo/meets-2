'use client';
import {useState} from 'react';
import {requestPasswordReset,signIn,signUp} from '../../lib/auth-client.js';
import {saveSession} from '../../lib/account-store.js';

// mode: login | register | reset. The profile variant asks for the e-mail first.
export default function Authentication({onSuccess,variant='default'}){
 const compact=variant==='profile';
 const [step,setStep]=useState('email');
 const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[show,setShow]=useState(false);
 const askPassword=mode!=='reset'&&(!compact||step==='password');
 function switchMode(next){setMode(next);setStep(next==='reset'||!email?'email':'password');setPassword('');setRepeat('');setError('');setNotice('');}
 async function submit(event){
  event.preventDefault();setError('');setNotice('');
  if(compact&&step==='email'&&mode!=='reset'){setStep('password');return;}
  if(mode==='register'&&password!==repeat){setError('Paroles nesakrīt.');return;}
  setBusy(true);
  try{
   if(mode==='reset'){
    await requestPasswordReset(email);
    setNotice('Ja šim e-pastam ir MEETS konts, nosūtījām saiti paroles atjaunošanai. Pārbaudi arī mēstuļu mapi.');
    return;
   }
   const result=mode==='register'?await signUp(email,password):await signIn(email,password);
   if(result.requiresConfirmation){
    setNotice('Konts izveidots. Nosūtījām apstiprinājuma saiti uz '+email.trim()+' — atver to, lai aktivizētu kontu.');
    setMode('login');setPassword('');setRepeat('');
    return;
   }
   saveSession(result);
   await onSuccess?.(result);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 const submitLabel=busy?'Lūdzu, uzgaidi…':mode==='reset'?'Nosūtīt saiti':compact&&step==='email'?'Turpināt →':mode==='register'?'Izveidot kontu':'Pieslēgties →';
 return <div className={'quick-flow-auth'+(compact?' meets-auth-compact meets-auth-step-'+(mode==='reset'?'email':step):'')}>
  {!compact&&<><h2>{mode==='register'?'Izveidot MEETS kontu':mode==='reset'?'Atjaunot paroli':'Pieslēgties un turpināt'}</h2><p className="meets-muted">Tava aizpildītā informācija paliks saglabāta. Pieslēgšanās nepieciešama tikai iesniegšanai.</p></>}
  {compact&&mode==='reset'&&<p className="meets-muted">Ievadi sava konta e-pastu, un nosūtīsim saiti jaunas paroles iestatīšanai.</p>}
  {compact&&step==='email'&&mode!=='reset'&&<div className="meets-auth-google-area"><button type="button" className="meets-auth-google" disabled aria-describedby="meets-google-soon"><span className="meets-google-mark" aria-hidden="true">G</span> Turpināt ar Google <span className="meets-auth-soon">Drīzumā</span></button><span id="meets-google-soon" className="meets-auth-google-hint">Google pieslēgšanās būs pieejama vēlāk.</span><div className="meets-auth-divider"><span>vai ar e-pastu</span></div></div>}
  <form onSubmit={submit} className="quick-flow-stack">
   {compact&&step==='password'&&mode!=='reset'?<div className="meets-auth-selected-email"><span>{email}</span><button type="button" onClick={()=>{setStep('email');setError('');}}>Mainīt</button></div>:
    <label>E-pasts<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
   {askPassword&&<label>Parole<input type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoFocus={compact}/></label>}
   {askPassword&&mode==='register'&&<label>Atkārtot paroli<input type={show?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>}
   {askPassword&&mode==='register'&&password.length>0&&password.length<8&&<p className="meets-password-note" role="status">Vēl {8-password.length} rakstzīmes</p>}
   {askPassword&&<label className="quick-flow-check"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Rādīt paroli</label>}
   {error&&<p className="meets-inline-error meets-auth-inline-alert" role="alert" aria-live="assertive">{error}</p>}
   {notice&&<p className="meets-auth-notice" role="status">{notice}</p>}
   <button type="submit" className="button primary" disabled={busy}>{submitLabel}</button>
   {askPassword&&mode==='login'&&<button type="button" className="text-button meets-auth-forgot" onClick={()=>switchMode('reset')}>Aizmirsi paroli?</button>}
  </form>
  {mode==='reset'?<button type="button" className="button meets-auth-switch" onClick={()=>switchMode('login')}>← Atpakaļ uz pieslēgšanos</button>:
   <button type="button" className="button meets-auth-switch" onClick={()=>switchMode(mode==='login'?'register':'login')}>{mode==='login'?'Nav konta? Izveidot kontu':'Man jau ir konts? Pieslēgties'}</button>}
 </div>;
}

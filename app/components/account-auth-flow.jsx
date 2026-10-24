'use client';
import {useState} from 'react';
const SESSION='meets_user_session_v1';
export default function Authentication({onSuccess}){
 const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false);
 async function submit(event){
  event.preventDefault();setError('');
  if(mode==='register'&&password!==repeat){setError('Paroles nesakrīt.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,email:email.trim(),password}),cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Neizdevās pieslēgties.');
   if(!data.access_token){setError('Konts izveidots. Pārbaudi e-pasta apstiprināšanas ziņu un pēc tam pieslēdzies.');setMode('login');return;}
   localStorage.setItem(SESSION,JSON.stringify({...data,expires_at:Date.now()+(data.expires_in||3600)*1000}));
   window.dispatchEvent(new Event('meets-user-changed'));onSuccess(data);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <div className="quick-flow-auth"><h2>{mode==='register'?'Izveidot MEETS kontu':'Pieslēgties un turpināt'}</h2>
  <p className="meets-muted">Tava aizpildītā pasākuma informācija paliks saglabāta. Pieslēgšanās nepieciešama tikai iesniegšanai.</p>
  <form onSubmit={submit} className="quick-flow-stack">
   <label>E-pasts<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Parole<input type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   {mode==='register'&&<label>Atkārtot paroli<input type={show?'text':'password'} required minLength={8} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>}
   <label className="quick-flow-check"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Rādīt paroli</label>
   <button type="submit" className="button primary" disabled={busy}>{busy?'Pārbauda…':mode==='register'?'Izveidot kontu un turpināt':'Pieslēgties →'}</button>
  </form>
  <button type="button" className="button" onClick={()=>{setMode(v=>v==='login'?'register':'login');setError('');}}>{mode==='login'?'Vēl nav konta? Reģistrēties':'Man jau ir konts'}</button>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
 </div>;
}

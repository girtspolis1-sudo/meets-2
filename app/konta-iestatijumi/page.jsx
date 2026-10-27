'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import ProfileShell from '../components/profile-shell.jsx';
const KEY='meets_user_session_v1';
function getSession(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
async function call(endpoint,action,token,fields={}){
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...fields})});
 const value=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(value.error||'Darbību neizdevās izpildīt.');
 return value;
}
async function resizeImage(file){
 if(!file.type.startsWith('image/')||file.size>5*1024*1024)throw Error('Izvēlies attēlu līdz 5 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const side=128,canvas=document.createElement('canvas');canvas.width=side;canvas.height=side;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Attēlu neizdevās apstrādāt.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,side,side);
  const scale=Math.max(side/bitmap.width,side/bitmap.height);
  const w=bitmap.width*scale,h=bitmap.height*scale;ctx.drawImage(bitmap,(side-w)/2,(side-h)/2,w,h);
  const data=canvas.toDataURL('image/jpeg',0.65);
  if(data.length>50000)throw Error('Attēlu neizdevās pietiekami samazināt.');
  return data;
 }finally{bitmap.close()}
}
export default function AccountSettings(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[name,setName]=useState(''),[avatar,setAvatar]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [currentPassword,setCurrentPassword]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState('');
 const load=useCallback(async(s)=>{
  const [profile,user]=await Promise.all([
   call('/api/registries','list',s.access_token),
   fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'getProfile',token:s.access_token})}).then(r=>r.json())
  ]);
  setName(profile.profile?.display_name||'');
  setAvatar(user.avatar_data_url||'');
 },[]);
 useEffect(()=>{const s=getSession();if(!s?.access_token){setLoading(false);return}
  setSession(s);load(s).catch(e=>setError(e.message)).finally(()=>setLoading(false));
 },[load]);
 async function act(fn,key){setBusy(key);setError('');setMessage('');try{await fn();setMessage('Izmaiņas saglabātas.')}catch(e){setError(e.message)}finally{setBusy('')}}
 async function saveName(e){e.preventDefault();await act(()=>call('/api/registries','profile',session.access_token,{display_name:name.trim()}),'name')}
 async function savePhoto(e){const file=e.target.files?.[0];if(!file)return;
  await act(async()=>{const value=await resizeImage(file);await call('/api/account','updateAvatar',session.access_token,{avatarDataUrl:value});setAvatar(value);window.dispatchEvent(new Event('meets-profile-updated'));},'avatar');e.target.value='';
 }
 async function removePhoto(){await act(async()=>{await call('/api/account','updateAvatar',session.access_token,{avatarDataUrl:null});setAvatar('');window.dispatchEvent(new Event('meets-profile-updated'));},'avatar')}
 async function changePassword(e){e.preventDefault();if(password!==repeat){setError('Jaunās paroles nesakrīt.');return}
  await act(async()=>{await call('/api/account','changePassword',session.access_token,{currentPassword,newPassword:password});setCurrentPassword('');setPassword('');setRepeat('');},'password')
 }
 if(loading)return <p role="status">Ielādē konta iestatījumus…</p>;
 if(!session)return <div className="meets-settings-login"><p>Pieslēdzies, lai rediģētu kontu.</p><Link href="/profils">Pieslēgties →</Link></div>;
 return <ProfileShell session={session} displayName={name} avatarUrl={avatar}><main className="meets-account-settings">
  <h1>Konta iestatījumi</h1>
  <p className="meets-settings-caption">Tava personīgā konta informācija</p>
  {error&&<p role="alert" className="meets-inline-error">{error}</p>}
  {message&&<p role="status" className="meets-organizer-success">{message}</p>}
  <section className="meets-settings-panel"><h2>Profila attēls</h2><div className="meets-settings-photo-row">
   <div className="meets-settings-photo">{avatar?<img src={avatar} alt="Profila attēls"/>:<span>{(name||session.user?.email||'M').slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div><label className="button meets-settings-upload" htmlFor="meets-profile-photo">Pievienot attēlu</label><input id="meets-profile-photo" className="sr-only" type="file" accept="image/*" onChange={savePhoto} disabled={!!busy}/>
   {avatar&&<button type="button" className="button" onClick={removePhoto} disabled={!!busy}>Noņemt</button>}
   <small>JPG vai PNG, līdz 5 MB. Automātiski samazināts.</small></div>
  </div></section>
  <section className="meets-settings-panel"><h2>Pamatinformācija</h2><form onSubmit={saveName} className="meets-settings-form">
   <label>Vārds vai profila nosaukums<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} placeholder="Tavs vārds"/></label>
   <label>E-pasts<input value={session.user?.email||''} readOnly type="email"/></label>
   <button className="button primary" disabled={!!busy}>Saglabāt nosaukumu</button>
  </form></section>
  <section className="meets-settings-panel"><h2>Paroles maiņa</h2><form onSubmit={changePassword} className="meets-settings-form">
   <label>Pašreizējā parole<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
   <label>Jaunā parole<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Atkārtot jauno paroli<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
   <button className="button primary" disabled={!!busy}>Mainīt paroli</button>
  </form></section>
 </main></ProfileShell>;
}

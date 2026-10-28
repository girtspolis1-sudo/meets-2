'use client';
import {useEffect,useState} from 'react';
import {accountRequest,setAccountData,useAccountData,useAccountSession} from '../../../lib/account-store.js';
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
 const {session}=useAccountSession();
 const registries=useAccountData('registries'),profile=useAccountData('avatar');
 const savedName=registries.data?.profile?.display_name||'',avatar=profile.data?.avatar_url||profile.data?.avatar_data_url||'';
 const [name,setName]=useState(null),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [currentPassword,setCurrentPassword]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState('');
 // Show the saved name until the person starts editing it.
 const nameValue=name??savedName;
 useEffect(()=>{const failed=registries.error||profile.error;if(failed)setError(failed.message);},[registries.error,profile.error]);
 async function act(fn,key){setBusy(key);setError('');setMessage('');try{await fn();setMessage('Izmaiņas saglabātas.')}catch(e){setError(e.message)}finally{setBusy('')}}
 async function saveName(e){e.preventDefault();const display_name=nameValue.trim();await act(async()=>{await accountRequest('/api/registries','profile',{display_name});setAccountData('registries',d=>({...d,profile:{...d.profile,display_name}}));setName(null);},'name')}
 async function savePhoto(e){const file=e.target.files?.[0];if(!file)return;
  await act(async()=>{const value=await resizeImage(file);const saved=await accountRequest('/api/account','updateAvatar',{avatarDataUrl:value});setAccountData('avatar',d=>({...d,avatar_url:saved.avatar_url,avatar_data_url:null}));},'avatar');e.target.value='';
 }
 async function removePhoto(){await act(async()=>{await accountRequest('/api/account','updateAvatar',{avatarDataUrl:null});setAccountData('avatar',d=>({...d,avatar_url:null,avatar_data_url:null}));},'avatar')}
 async function changePassword(e){e.preventDefault();if(password!==repeat){setError('Jaunās paroles nesakrīt.');return}
  await act(async()=>{await accountRequest('/api/account','changePassword',{currentPassword,newPassword:password});setCurrentPassword('');setPassword('');setRepeat('');},'password')
 }
 return <div className="meets-account-settings">
  <h1>Konta iestatījumi</h1>
  <p className="meets-settings-caption">Tava personīgā konta informācija</p>
  {error&&<p role="alert" className="meets-inline-error">{error}</p>}
  {message&&<p role="status" className="meets-organizer-success">{message}</p>}
  <section className="meets-settings-panel"><h2>Profila attēls</h2><div className="meets-settings-photo-row">
   <div className="meets-settings-photo">{avatar?<img src={avatar} alt="Profila attēls"/>:<span>{(nameValue||session?.user?.email||'M').slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div><label className="button meets-settings-upload" htmlFor="meets-profile-photo">Pievienot attēlu</label><input id="meets-profile-photo" className="sr-only" type="file" accept="image/*" onChange={savePhoto} disabled={!!busy}/>
   {avatar&&<button type="button" className="button" onClick={removePhoto} disabled={!!busy}>Noņemt</button>}
   <small>JPG vai PNG, līdz 5 MB. Automātiski samazināts.</small></div>
  </div></section>
  <section className="meets-settings-panel"><h2>Pamatinformācija</h2><form onSubmit={saveName} className="meets-settings-form">
   <label>Vārds vai profila nosaukums<input value={nameValue} onChange={e=>setName(e.target.value)} maxLength={100} placeholder={registries.loading?'Ielādē…':'Tavs vārds'}/></label>
   <label>E-pasts<input value={session?.user?.email||''} readOnly type="email"/></label>
   <button className="button primary" disabled={!!busy}>Saglabāt nosaukumu</button>
  </form></section>
  <section className="meets-settings-panel"><h2>Paroles maiņa</h2><form onSubmit={changePassword} className="meets-settings-form">
   <label>Pašreizējā parole<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
   <label>Jaunā parole<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Atkārtot jauno paroli<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
   <button className="button primary" disabled={!!busy}>Mainīt paroli</button>
  </form></section>
 </div>;
}

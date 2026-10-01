'use client';

import {useEffect,useState} from 'react';

export default function PasswordResetForm({supabaseUrl,publishableKey}){
 const [accessToken,setAccessToken]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const [ready,setReady]=useState(false);

 useEffect(()=>{
  const params=new URLSearchParams(window.location.hash.slice(1));
  const token=params.get('access_token')||'';
  const type=params.get('type')||'';
  if(type==='recovery'&&token){
   setAccessToken(token);
   setReady(true);
  }else{
   setMessage('Paroles atiestatīšanas saite nav derīga vai tai beidzies termiņš.');
  }
 },[]);

 async function submit(event){
  event.preventDefault();
  if(password.length<12){setMessage('Jaunajai parolei jābūt vismaz 12 rakstzīmēm.');return;}
  if(password!==confirm){setMessage('Abas paroles nesakrīt.');return;}
  if(!accessToken){setMessage('Paroles atiestatīšanas saite nav derīga.');return;}

  setSaving(true);setMessage('');
  try{
   const response=await fetch(supabaseUrl+'/auth/v1/user',{
    method:'PUT',
    headers:{
     apikey:publishableKey,
     Authorization:'Bearer '+accessToken,
     'Content-Type':'application/json'
    },
    body:JSON.stringify({password}),
    cache:'no-store'
   });
   if(!response.ok)throw new Error('Password update failed');
   window.history.replaceState(null,'','/admin/password');
   setMessage('Parole nomainīta. Tūlīt atvērsim admin pieslēgšanos.');
   setTimeout(()=>window.location.assign('/admin'),900);
  }catch{
   setMessage('Paroli neizdevās nomainīt. Pieprasi jaunu paroles maiņas saiti.');
  }finally{
   setSaving(false);
  }
 }

 return <form className="admin-login admin-password-reset" onSubmit={submit}>
  <label>Jaunā parole<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" minLength={12} disabled={!ready||saving} autoFocus/></label>
  <label>Atkārto paroli<input type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="new-password" minLength={12} disabled={!ready||saving}/></label>
  <div className="actions">
   <button className="button primary" type="submit" disabled={!ready||saving}>{saving?'Saglabā…':'Nomainīt paroli'}</button>
   <a className="button" href="/admin">Atpakaļ uz admin</a>
  </div>
  {message&&<p className="sync-text" role="status">{message}</p>}
 </form>;
}

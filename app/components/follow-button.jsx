'use client';
import {useEffect,useState} from 'react';

const SESSION='meets_user_session_v1';
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
// A bell: the same mark as following on the home page; filled while following.
function Bell({on}){
 return <svg viewBox="0 0 24 24" width="17" height="17" fill={on?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>;
}
// label names what is followed ("Sekot vietai"); ariaLabel adds the name when the label alone is short.
export default function FollowButton({targetKind,targetId,className='button',label='Sekot',followingLabel='Seko',ariaLabel=''}){
 const [following,setFollowing]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let alive=true;(async()=>{
  const session=readSession();if(!session?.access_token){if(alive)setLoaded(true);return;}
  try{
   const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dashboard',token:session.access_token})});
   const b=await r.json();if(!r.ok)throw Error();
   if(alive)setFollowing((b.follows||[]).some(x=>x.target_kind===targetKind&&x.target_id===targetId));
  }catch{}finally{if(alive)setLoaded(true);}
 })();return()=>{alive=false;};},[targetKind,targetId]);
 async function toggle(){
  const session=readSession();
  if(!session?.access_token){window.location.assign('/profils');return;}
  setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'follow',token:session.access_token,targetKind,targetId,enabled:!following})});
   const b=await r.json();if(!r.ok)throw Error(b.error||'Sekošanu neizdevās saglabāt.');
   setFollowing(v=>!v);setMessage(!following?'Tagad seko.':'Sekošana pārtraukta.');
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <span className="meets-follow-control"><button type="button" className={className} disabled={!loaded||busy} aria-pressed={following} aria-label={ariaLabel?(following?'Pārtraukt sekot: ':'')+ariaLabel:undefined} onClick={toggle}><Bell on={following}/> {following?followingLabel:label}</button>{message&&<small role="status">{message}</small>}</span>;
}

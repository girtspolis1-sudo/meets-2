'use client';
import {useEffect,useState} from 'react';

const SESSION='meets_user_session_v1';
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
export default function FollowButton({targetKind,targetId,className='button'}){
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
 return <span className="meets-follow-control"><button type="button" className={className} disabled={!loaded||busy} aria-pressed={following} onClick={toggle}>{following?'✓ Nesekot':'+ Sekot'}</button>{message&&<small role="status">{message}</small>}</span>;
}

'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';

const SESSION_KEY='meets_admin_access_token';

export default function AdminFooterControl(){
 const [loggedIn,setLoggedIn]=useState(false);
 const [loggingOut,setLoggingOut]=useState(false);

 useEffect(()=>{
  let cancelled=false;
  const sync=async()=>{
   const token=sessionStorage.getItem(SESSION_KEY)||'';
   if(!token){if(!cancelled)setLoggedIn(false);return;}
   try{
    const response=await fetch('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const data=await response.json();
    if(cancelled)return;
    if(data?.valid===true)setLoggedIn(true);
    else{
     sessionStorage.removeItem(SESSION_KEY);
     setLoggedIn(false);
    }
   }catch{
    if(!cancelled)setLoggedIn(Boolean(token));
   }
  };
  sync();
  window.addEventListener('storage',sync);
  window.addEventListener('meets-admin-session-change',sync);
  return()=>{
   cancelled=true;
   window.removeEventListener('storage',sync);
   window.removeEventListener('meets-admin-session-change',sync);
  };
 },[]);

 async function logout(){
  const token=sessionStorage.getItem(SESSION_KEY)||'';
  setLoggingOut(true);
  try{
   if(token){
    await fetch('/api/admin/logout',{
     method:'POST',
     headers:{Authorization:'Bearer '+token},
     cache:'no-store'
    });
   }
  }catch{}
  finally{
   sessionStorage.removeItem(SESSION_KEY);
   window.dispatchEvent(new Event('meets-admin-session-change'));
   setLoggedIn(false);
   setLoggingOut(false);
   if(window.location.pathname.startsWith('/admin'))window.location.assign('/admin');
  }
 }

 return <div className="admin-footer-control" aria-label="Admin piekļuve">
  {loggedIn?<>
   <Link className="admin-footer-link active" href="/admin">Admin vide</Link>
   <button type="button" className="admin-footer-link logout" onClick={logout} disabled={loggingOut}>{loggingOut?'Izlogojas…':'Izlogoties'}</button>
  </>:<Link className="admin-footer-link" href="/admin">Admin ielogoties</Link>}
 </div>;
}

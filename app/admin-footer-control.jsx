'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';

const SESSION_KEY='meets_admin_access_token';

export default function AdminFooterControl(){
 const [loggedIn,setLoggedIn]=useState(false);
 const [loggingOut,setLoggingOut]=useState(false);

 useEffect(()=>{
  const sync=()=>setLoggedIn(Boolean(sessionStorage.getItem(SESSION_KEY)));
  sync();
  window.addEventListener('storage',sync);
  window.addEventListener('meets-admin-session-change',sync);
  return()=>{
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

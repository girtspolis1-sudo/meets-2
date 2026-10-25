'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useAdminSession} from './use-admin-session.js';

const SESSION_KEY='meets_user_session_v1';
const items=[
 {href:'/karte',label:'Karte'},
 {href:'/pasakumi',label:'Pasākumi'},
 {href:'/profils',label:'◉ Mans profils'}
];
function readSession(){
 try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
}
export default function SiteNav(){
 const pathname=usePathname();
 const {isAdmin}=useAdminSession();
 const [signedIn,setSignedIn]=useState(false);
 const [loggingOut,setLoggingOut]=useState(false);
 useEffect(()=>{
  const update=()=>setSignedIn(Boolean(readSession()?.access_token));
  update();
  window.addEventListener('meets-user-changed',update);
  window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-user-changed',update);window.removeEventListener('storage',update);};
 },[]);
 const visibleItems=isAdmin?[...items,{href:'/admin',label:'Admin'}]:items;
 const isActive=item=>item.href==='/profils'
  ?['/profils','/mani-pasakumi','/mani-registri','/organizators','/sekosana','/registre-vietu','/registre-pasakumu'].some(path=>pathname===path||pathname.startsWith(path+'/'))
  :pathname===item.href||pathname.startsWith(item.href+'/');
 async function logout(){
  if(loggingOut)return;
  setLoggingOut(true);
  const session=readSession();
  try{
   if(session?.access_token)await fetch('/api/account',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'logout',token:session.access_token}),cache:'no-store'
   });
  }catch{}
  finally{
   localStorage.removeItem(SESSION_KEY);
   localStorage.removeItem('meets_favorites_v1');
   window.dispatchEvent(new Event('meets-user-changed'));
   window.dispatchEvent(new Event('meets-favorites-changed'));
   window.location.assign('/profils');
  }
 }
 const navLink=item=><Link key={item.href} href={item.href}
   className={isActive(item)?'active':''} aria-current={isActive(item)?'page':undefined}>{item.label}</Link>;
 const exit=<button className="meets-header-logout" type="button" onClick={logout} disabled={loggingOut}
  aria-label="Iziet no MEETS konta">{loggingOut?'Iziet…':'Iziet'}</button>;
 return <nav aria-label="Galvenā izvēlne">
  <div className="meets-nav-desktop">{visibleItems.map(navLink)}{signedIn&&exit}</div>
  <div className="meets-nav-mobile">{visibleItems.filter(item=>item.href!='/admin').map(navLink)}
   {(isAdmin||signedIn)&&<details className="meets-nav-more">
    <summary aria-label="Papildu izvēlne">Vēl</summary>
    <div className="meets-nav-more-items">{isAdmin&&navLink({href:'/admin',label:'Admin'})}{signedIn&&exit}</div>
   </details>}
  </div>
 </nav>;
}

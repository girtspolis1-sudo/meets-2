'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useAdminSession} from './use-admin-session.js';

const SESSION_KEY='meets_user_session_v1';
const items=[
 {href:'/karte',label:'Karte'},
 {href:'/pasakumi',label:'Pasākumi'},
 {href:'/profils',label:'Mans profils'}
];
function readSession(){
 try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
}
export default function SiteNav(){
 const pathname=usePathname();
 const {isAdmin}=useAdminSession();
 const [signedIn,setSignedIn]=useState(false);
 const [loggingOut,setLoggingOut]=useState(false);
 const [email,setEmail]=useState('');
 useEffect(()=>{
  const update=()=>{const session=readSession();setSignedIn(Boolean(session?.access_token));setEmail(session?.user?.email||'');};
  update();
  window.addEventListener('meets-user-changed',update);
  window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-user-changed',update);window.removeEventListener('storage',update);};
 },[]);
 const initial=(email||'M').trim().charAt(0).toLocaleUpperCase('lv');
 // Close the account menu after moving to another page.
 useEffect(()=>{document.querySelectorAll('.meets-mobile-account[open]').forEach(menu=>menu.removeAttribute('open'));},[pathname]);
 const profileArea=['/profils','/mani-pasakumi','/mani-registri','/organizators','/sekosana','/konta-iestatijumi','/registre-vietu','/registre-pasakumu','/registre-turnira'].some(path=>pathname===path||pathname.startsWith(path+'/'));
 const visibleItems=isAdmin?[...items,{href:'/admin',label:'Admin'}]:items;
 const isActive=item=>item.href==='/profils'
  ?['/profils','/mani-pasakumi','/mani-registri','/organizators','/sekosana','/konta-iestatijumi','/registre-vietu','/registre-pasakumu','/registre-turnira'].some(path=>pathname===path||pathname.startsWith(path+'/'))
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
   localStorage.removeItem('meets_favorites_owner_v1');
   window.dispatchEvent(new Event('meets-user-changed'));
   window.dispatchEvent(new Event('meets-favorites-changed'));
   window.location.assign('/profils');
  }
 }
 // A public organizer page works as the organizer's own mini-site: no app menu, one way to meets.lv.
 if(pathname.startsWith('/organizatori/'))return <nav aria-label="MEETS" className="meets-minisite-nav">
  <Link className="meets-minisite-home" href="/karte"><span className="wide">Atklāj vairāk pasākumu meets.lv</span><span className="narrow">Vairāk pasākumu</span> <span aria-hidden="true">→</span></Link>
 </nav>;
 const navLink=item=><Link key={item.href} href={item.href}
   className={isActive(item)?'active':''} aria-current={isActive(item)?'page':undefined}>{item.label}</Link>;
 const exit=<button className="meets-header-logout" type="button" onClick={logout} disabled={loggingOut}
  aria-label="Iziet no MEETS konta">{loggingOut?'Iziet…':'Iziet'}</button>;
 return <nav aria-label="Galvenā izvēlne">
  {/* Phones: one small account mark beside the logo. Signed in it shows the
      account's initial and opens a short menu; signed out it is "Ieiet". */}
  {signedIn?<details className="meets-mobile-account">
   <summary aria-label={'Mans konts'+(email?': '+email:'')} title={email||'Mans konts'}><span aria-hidden="true">{initial}</span></summary>
   <div className="meets-mobile-account-menu">
    {email&&<small>{email}</small>}
    <Link href="/profils">Mans MEETS</Link>
    <Link href="/organizators">Pasākumu rīkošana</Link>
    <Link href="/konta-iestatijumi">Konta iestatījumi</Link>
    <button type="button" disabled={loggingOut} onClick={logout} aria-label="Iziet no MEETS konta">{loggingOut?'Iziet…':'Iziet no konta'}</button>
   </div>
  </details>:<Link className="meets-mobile-signin" href="/profils"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4 3.6-6 8-6s7.4 2 8 6"/></svg>Ieiet</Link>}
  <div className="meets-nav-desktop">{visibleItems.map(navLink)}{signedIn&&!profileArea&&exit}</div>
  <div className="meets-nav-mobile">{visibleItems.filter(item=>item.href!='/admin').map(navLink)}
   {(isAdmin||(signedIn&&!profileArea))&&<details className="meets-nav-more">
    <summary aria-label="Papildu izvēlne">Vēl</summary>
    <div className="meets-nav-more-items">{isAdmin&&navLink({href:'/admin',label:'Admin'})}{signedIn&&exit}</div>
   </details>}
  </div>
 </nav>;
}

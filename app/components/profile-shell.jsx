'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {Suspense,useEffect,useMemo,useState} from 'react';

const symbols={
 home:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></>,
 map:<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/></>,
 pin:<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></>,
 list:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h10M8 14h10M5 9h.01M5 14h.01"/></>,
 plus:<path d="M12 5v14M5 12h14"/>,
 arrow:<path d="m9 18 6-6-6-6"/>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="M5 12H3m18 0h-2M12 5V3m0 18v-2M6.5 6.5 5 5m14 14-1.5-1.5M17.5 6.5 19 5M5 19l1.5-1.5"/></>,
 logout:<><path d="M10 17l5-5-5-5M15 12H3M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></>,
 users:<><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.4.5 3.7 2.3 4 5"/></>,
 building:<><path d="M4 21V5l8-3 8 3v16M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/></>,
 eye:<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>
};
export function ProfileIcon({name,size=19}){
 return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{symbols[name]||symbols.home}</svg>;
}
const personalLinks=[
 {href:'/profils',label:'Pārskats',icon:'home'},
 {href:'/mani-pasakumi',label:'Saglabātie pasākumi',icon:'heart'},
 {href:'/sekosana',label:'Sekoju',icon:'pin'},
 {href:'/konta-iestatijumi',label:'Konta iestatījumi',icon:'settings'}
];
const organizerPanels=[
 {panel:'overview',label:'Pārskats',icon:'home'},
 {panel:'events',label:'Pasākumi',icon:'calendar'},
 {panel:'venues',label:'Norises vietas',icon:'pin'},
 {panel:'lists',label:'Publiskie saraksti',icon:'list'},
 {panel:'team',label:'Komanda',icon:'users'},
 {panel:'profile',label:'Organizatora profils',icon:'building'}
];

const INITIALS=(name='')=>String(name).trim().slice(0,1).toLocaleUpperCase('lv')||'M';

function Inner({children,session,displayName='',avatarUrl='',subtitle='',activeOrganization=null,mode=''}) {
 const pathname=usePathname(),params=useSearchParams();
 const [identity,setIdentity]=useState(session||null);
 const [loggingOut,setLoggingOut]=useState(false);
 useEffect(()=>{
  function read(){try{setIdentity(JSON.parse(localStorage.getItem('meets_user_session_v1')||'null'));}catch{setIdentity(null);}}
  read();
  window.addEventListener('meets-user-changed',read);
  return()=>window.removeEventListener('meets-user-changed',read);
 },[]);
 useEffect(()=>{if(session?.access_token)setIdentity(session);},[session]);

 async function logout(){
  if(loggingOut)return;
  setLoggingOut(true);
  const current=identity;
  try{if(current?.access_token)await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout',token:current.access_token}),cache:'no-store'});}catch{}
  finally{localStorage.removeItem('meets_user_session_v1');localStorage.removeItem('meets_favorites_v1');localStorage.removeItem('meets_favorites_owner_v1');window.dispatchEvent(new Event('meets-user-changed'));window.dispatchEvent(new Event('meets-favorites-changed'));window.location.assign('/profils');}
 }
 const email=identity?.user?.email||'';
 const title=displayName||email?.split('@')[0]||'MEETS lietotājs';
 const organizerMode=mode==='organizer'||pathname==='/organizators'||pathname.startsWith('/registre-pasakumu')||pathname==='/registre-vietu';
 const orgId=params.get('org')||activeOrganization?.id||'';
 const panel=params.get('panel')||'overview';
 const organizerLinks=useMemo(()=>organizerPanels.map(item=>({
  ...item,
  href:'/organizators?panel='+item.panel+(orgId?'&org='+encodeURIComponent(orgId):'')
 })),[orgId]);
 const eventHref='/registre-pasakumu/vienkarsi'+(orgId?'?org='+encodeURIComponent(orgId):'');

 const activePersonal=(href)=>{
  if(href.includes('#'))return pathname===href.split('#')[0]&&typeof window!=='undefined'&&window.location.hash===href.split('#')[1];
  return pathname===href;
 };
 const activeOrganizer=(item)=>pathname==='/organizators'&&panel===item.panel;

 return <div className="meets-profile-shell">
  <aside className="meets-profile-aside" aria-label="Profila navigācija">
   <div className="meets-profile-identity">
    <div className="meets-profile-avatar" aria-hidden="true">{avatarUrl?<img src={avatarUrl} alt="" className="meets-settings-avatar-image"/>:INITIALS(displayName||email)}</div>
    <div><strong>{title}</strong><small>{email||subtitle||'Tavs pasākumu centrs'}</small></div>
   </div>

   <div className="meets-profile-mode-switch" role="group" aria-label="Profila režīms">
    <Link href="/profils" aria-current={!organizerMode?'page':undefined} className={!organizerMode?'active':''}><ProfileIcon name="heart" size={15}/> <span>Mans MEETS</span></Link>
    <Link href={orgId?'/organizators?org='+encodeURIComponent(orgId):'/organizators'} aria-current={organizerMode?'page':undefined} className={organizerMode?'active':''}><ProfileIcon name="building" size={15}/> <span>Organizēšana</span></Link>
   </div>

   {!organizerMode?<nav className="meets-profile-nav" aria-label="Mans MEETS">
    <div className="meets-profile-nav-group">
     {personalLinks.map(item=><Link key={item.href} href={item.href} aria-current={activePersonal(item.href)?'page':undefined}
       className={'meets-profile-nav-link'+(activePersonal(item.href)?' active':'')}>
      <ProfileIcon name={item.icon}/><span>{item.label}</span>{activePersonal(item.href)&&<ProfileIcon name="arrow" size={14}/>}
     </Link>)}
    </div>
   </nav>:<nav className="meets-profile-nav" aria-label="Organizēšana">
    {activeOrganization&&<div className="meets-profile-active-org"><small>Aktīvais organizators</small><strong>{activeOrganization.name}</strong></div>}
    <div className="meets-profile-nav-group"><span className="meets-profile-nav-label">ORGANIZĒŠANA</span>
     <Link href="/organizators" className={'meets-profile-nav-link'+(!orgId&&pathname==='/organizators'?' active':'')}>
      <ProfileIcon name="building"/><span>Organizatori</span>
     </Link>
     {orgId&&organizerLinks.map(item=><Link key={item.panel} href={item.href} aria-current={activeOrganizer(item)?'page':undefined}
       className={'meets-profile-nav-link'+(activeOrganizer(item)?' active':'')}>
      <ProfileIcon name={item.icon}/><span>{item.label}</span>{activeOrganizer(item)&&<ProfileIcon name="arrow" size={14}/>}
     </Link>)}
    </div>
   </nav>}

   <div className="meets-profile-aside-footer">
    {organizerMode?<Link className="meets-profile-aside-action" href={eventHref}><ProfileIcon name="plus"/> Jauns pasākums</Link>:
     <Link className="meets-profile-aside-action" href="/karte"><ProfileIcon name="map"/> Atrast pasākumu</Link>}

    <button type="button" className="meets-profile-logout" disabled={loggingOut} onClick={logout}><ProfileIcon name="logout" size={17}/>{loggingOut?"Iziet…":"Iziet no konta"}</button>
   </div>
  </aside>

  <div className="meets-profile-content">
   <nav className="meets-profile-mobile-tabs" aria-label={organizerMode?'Organizēšanas sadaļas':'Mans MEETS sadaļas'}>
    {!organizerMode?personalLinks.map(item=><Link key={item.href} href={item.href} aria-current={activePersonal(item.href)?'page':undefined} className={activePersonal(item.href)?'active':''}>{item.label}</Link>):
     <><Link href="/organizators" className={!orgId?'active':''}>Organizatori</Link>{orgId&&organizerLinks.slice(0,4).map(item=><Link key={item.panel} href={item.href} aria-current={activeOrganizer(item)?'page':undefined} className={activeOrganizer(item)?'active':''}>{item.label}</Link>)}</>}
   </nav>
   <div className="meets-profile-slot">{children}</div>
  </div>
 </div>;
}
export default function ProfileShell(props){return <Suspense fallback={<div className="meets-profile-shell-loading" role="status">Ielādē profilu…</div>}><Inner {...props}/></Suspense>;}

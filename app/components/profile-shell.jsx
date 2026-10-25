'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {Suspense,useEffect,useState} from 'react';

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
 logout:<><path d="M10 17l5-5-5-5M15 12H3M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></>
};
export function ProfileIcon({name,size=19}){
 return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{symbols[name]||symbols.home}</svg>;
}
const sections=[
 {title:'MANS MEETS',links:[{href:'/profils',label:'Pārskats',icon:'home'},{href:'/mani-pasakumi',label:'Saglabātie pasākumi',icon:'heart'},{href:'/mani-registri',label:'Mani reģistri',icon:'list'}]},
 {title:'ORGANIZĒŠANA',links:[{href:'/organizators',label:'Mani pasākumi',icon:'calendar'},{href:'/organizators?panel=venues',label:'Norises vietas',icon:'pin'}]}
];
const INITIALS=(name='')=>String(name).trim().slice(0,1).toLocaleUpperCase('lv')||'M';
function Inner({children,session,displayName='',subtitle=''}) {
 const pathname=usePathname(),params=useSearchParams();
 const [identity,setIdentity]=useState(session||null);
 useEffect(()=>{
  function read(){try{setIdentity(JSON.parse(localStorage.getItem('meets_user_session_v1')||'null'));}catch{setIdentity(null);}}
  read();
  window.addEventListener('meets-user-changed',read);
  return()=>window.removeEventListener('meets-user-changed',read);
 },[]);
 useEffect(()=>{if(session?.access_token)setIdentity(session);},[session]);
 const email=identity?.user?.email||'';
 const title=displayName||email?.split('@')[0]||'MEETS lietotājs';
 const active=(href)=>{
  if(href==='/organizators?panel=venues')return pathname==='/organizators'&&params.get('panel')==='venues';
  if(href==='/organizators')return pathname==='/organizators'&&params.get('panel')!=='venues';
  return pathname===href;
 };
 const nav=sections.map(section=><div key={section.title} className="meets-profile-nav-group">
   <span className="meets-profile-nav-label">{section.title}</span>
   {section.links.map(item=><Link key={item.href} href={item.href} aria-current={active(item.href)?'page':undefined}
     className={'meets-profile-nav-link'+(active(item.href)?' active':'')}>
    <ProfileIcon name={item.icon}/><span>{item.label}</span>{active(item.href)&&<ProfileIcon name="arrow" size={14}/>}
   </Link>)}
  </div>);
 return <div className="meets-profile-shell">
  <aside className="meets-profile-aside" aria-label="Profila navigācija">
   <Link href="/profils" className="meets-profile-aside-brand" aria-label="MEETS profils"><span className="meets-profile-brand-mark">M</span><span>MEETS <strong>PROFILS</strong></span></Link>
   <div className="meets-profile-identity">
    <div className="meets-profile-avatar" aria-hidden="true">{INITIALS(displayName||email)}</div>
    <div><strong>{title}</strong><small>{email||subtitle||'Tavs pasākumu centrs'}</small></div>
   </div>
   <nav className="meets-profile-nav" aria-label="Mana MEETS sadaļas">{nav}</nav>
   <div className="meets-profile-aside-footer">
    <Link className="meets-profile-aside-action" href="/registre-pasakumu/vienkarsi"><ProfileIcon name="plus"/> Pievienot pasākumu</Link>
    <Link className="meets-profile-secondary-link" href="/karte"><ProfileIcon name="map"/> Atvērt karti</Link>
   </div>
  </aside>
  <div className="meets-profile-content">
   <nav className="meets-profile-mobile-tabs" aria-label="Profila sadaļas">
    {[...sections[0].links,...sections[1].links].map(item=><Link key={item.href} href={item.href} aria-current={active(item.href)?'page':undefined} className={active(item.href)?'active':''}>{item.label}</Link>)}
   </nav>
   <div className="meets-profile-slot">{children}</div>
  </div>
 </div>;
}
export default function ProfileShell(props){return <Suspense fallback={<div className="meets-profile-shell-loading" role="status">Ielādē profilu…</div>}><Inner {...props}/></Suspense>;}

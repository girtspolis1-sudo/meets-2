'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAdminSession} from './use-admin-session.js';

const items=[
 {href:'/karte',label:'Karte'},
 {href:'/pasakumi',label:'Pasākumi'},
 {href:'/mani-pasakumi',label:'♡ Mani pasākumi'},
 {href:'/registre-pasakumu',label:'＋ Reģistrēt pasākumu'}
];

export default function SiteNav(){
 const pathname=usePathname();
 const {isAdmin}=useAdminSession();
 const visibleItems=isAdmin?[...items,{href:'/admin',label:'Admin'}]:items;
 const isActive=item=>pathname===item.href||pathname.startsWith(item.href+'/');
 const primary=visibleItems.filter(item=>['/karte','/pasakumi','/mani-pasakumi'].includes(item.href));
 const other=visibleItems.filter(item=>!primary.includes(item));
 const navLink=item=><Link key={item.href} href={item.href}
   className={isActive(item)?'active':''} aria-current={isActive(item)?'page':undefined}>{item.label}</Link>;
 return <nav aria-label="Galvenā izvēlne">
  <div className="meets-nav-desktop">{visibleItems.map(navLink)}</div>
  <div className="meets-nav-mobile">{primary.map(navLink)}
   {!!other.length&&<details className="meets-nav-more">
    <summary aria-label="Papildu izvēlne">Vēl {other.some(isActive)?'•':''}</summary>
    <div className="meets-nav-more-items">{other.map(navLink)}</div>
   </details>}
  </div>
 </nav>;
}

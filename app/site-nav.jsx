'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAdminSession} from './use-admin-session.js';

const items=[
 {href:'/karte',label:'Karte'},
 {href:'/pasakumi',label:'Pasākumi'},
 {href:'/mani-pasakumi',label:'♡ Mani pasākumi'}
];

export default function SiteNav(){
 const pathname=usePathname();
 const {isAdmin}=useAdminSession();
 const visibleItems=isAdmin?[...items,{href:'/admin',label:'Admin'}]:items;
 return <nav aria-label="Galvenā izvēlne">
  {visibleItems.map(item=>{
   const active=pathname===item.href||pathname.startsWith(item.href+'/');
   return <Link
    key={item.href}
    href={item.href}
    className={active?'active':''}
    aria-current={active?'page':undefined}
   >{item.label}</Link>;
  })}
 </nav>;
}

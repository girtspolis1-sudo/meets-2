'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const items=[
 {href:'/karte',label:'Karte'},
 {href:'/pasakumi',label:'Pasākumi'},
 {href:'/admin',label:'Admin'}
];

export default function SiteNav(){
 const pathname=usePathname();
 return <nav aria-label="Galvenā izvēlne">
  {items.map(item=>{
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

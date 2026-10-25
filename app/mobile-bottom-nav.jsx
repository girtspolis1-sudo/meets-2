'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const links=[
 {href:'/',label:'Sākums',icon:'home'},
 {href:'/karte',label:'Karte',icon:'search'},
 {href:'/pasakumi',label:'Pasākumi',icon:'calendar'},
 {href:'/mani-pasakumi',label:'Saglabātie',icon:'heart'},
 {href:'/profils',label:'Profils',icon:'user'}
];
function Icon({name}){
 const base={viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 if(name==='home')return <svg {...base}><path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/></svg>;
 if(name==='search')return <svg {...base}><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/></svg>;
 if(name==='calendar')return <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></svg>;
 if(name==='heart')return <svg {...base}><path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg>;
 return <svg {...base}><circle cx="12" cy="8" r="4"/><path d="M4.4 21c.4-4 3.1-6 7.6-6s7.2 2 7.6 6"/></svg>;
}
export default function MobileBottomNav(){
 const pathname=usePathname();
 if(pathname.startsWith('/karte')||pathname.startsWith('/admin')||pathname.startsWith('/registre-'))return null;
 const active=href=>href==='/'?pathname==='/':pathname===href||pathname.startsWith(href+'/')||(href==='/profils'&&['/organizators','/sekosana','/mani-registri'].some(x=>pathname.startsWith(x)));
 return <nav className="meets-mobile-bottom-nav" aria-label="Mobilā ātrā navigācija">
  {links.map(link=><Link key={link.href} href={link.href} className={active(link.href)?'active':''} aria-current={active(link.href)?'page':undefined}>
   <Icon name={link.icon}/><span>{link.label}</span>
  </Link>)}
 </nav>;
}

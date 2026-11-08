'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLayoutEffect,useRef,useState} from 'react';
import {DOCK,dockItemX,dockPath,easeOutCubic} from '../lib/mobile-dock.js';

const links=[
 {href:'/',label:'Sākums',icon:'home'},
 {href:'/karte',label:'Karte',icon:'pin'},
 {href:'/pasakumi',label:'Pasākumi',icon:'calendar'},
 {href:'/mani-pasakumi',label:'Saglabātie',icon:'heart'},
 {href:'/profils',label:'Profils',icon:'user'}
];
const BOX=DOCK.top+DOCK.height;
const SLIDE_MS=420;

function Icon({name}){
 const base={viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false'};
 if(name==='home')return <svg {...base}><path d="M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5.5A1.5 1.5 0 0 1 4 19Z"/></svg>;
 if(name==='pin')return <svg {...base}><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>;
 if(name==='calendar')return <svg {...base}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4m8-4v4M3.5 10h17"/></svg>;
 if(name==='heart')return <svg {...base}><path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg>;
 return <svg {...base}><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.8 3.4-5.8 7.5-5.8s6.9 2 7.5 5.8"/></svg>;
}

function isActive(pathname,href){
 if(href==='/')return pathname==='/';
 return pathname===href||pathname.startsWith(href+'/')||(href==='/profils'&&['/organizators','/sekosana','/mani-registri'].some(x=>pathname.startsWith(x)));
}

// Floating glass bar; the active item rises into a bubble that sits in a notch
// of the bar. Before the bar is measured (server render) it is a plain rounded
// bar with the bubble placed by CSS; the notch is added once its width is known.
export default function MobileBottomNav(){
 const pathname=usePathname()||'/';
 const hidden=pathname.startsWith('/admin')||pathname.startsWith('/registre-')||pathname.startsWith('/organizatori/')||pathname.startsWith('/rezultati/');
 const navRef=useRef(null);
 const shown=useRef({x:null,width:0});
 const [width,setWidth]=useState(0);
 const [x,setX]=useState(null);
 const index=links.findIndex(link=>isActive(pathname,link.href));
 const target=width>0&&index>=0?dockItemX(width,index,links.length):null;

 // The notch is drawn in pixels, so it follows the real width of the bar
 // (0 while the bar is hidden on wide screens).
 useLayoutEffect(()=>{
  const node=navRef.current;
  if(!node)return;
  const measure=()=>setWidth(node.clientWidth);
  measure();
  if(typeof ResizeObserver==='undefined'){
   window.addEventListener('resize',measure);
   return ()=>window.removeEventListener('resize',measure);
  }
  const observer=new ResizeObserver(measure);
  observer.observe(node);
  return ()=>observer.disconnect();
 },[hidden]);

 // The bubble and the notch slide together to the active item. A new width
 // (rotation, resize) or reduced motion moves them at once.
 useLayoutEffect(()=>{
  const from=shown.current.x,resized=shown.current.width!==width;
  shown.current.width=width;
  const place=value=>{shown.current.x=value;setX(value);};
  const still=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(target===null||from===null||resized||still||Math.abs(target-from)<0.5){place(target);return;}
  let frame=0;
  const start=performance.now();
  const step=now=>{
   const t=Math.min(1,(now-start)/SLIDE_MS);
   place(from+(target-from)*easeOutCubic(t));
   if(t<1)frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return ()=>cancelAnimationFrame(frame);
 },[target,width]);

 if(hidden)return null;
 const d=width>0?dockPath({width,notch:x===null?null:{x}}):null;
 const vars={
  '--dock-top':DOCK.top+'px','--dock-bar':DOCK.height+'px','--dock-radius':DOCK.radius+'px',
  '--dock-edge':DOCK.edge+'px','--dock-bubble':DOCK.bubble+'px','--dock-depth':DOCK.depth+'px',
  '--dock-count':links.length,'--dock-steps':links.length-1,'--dock-index':Math.max(index,0)
 };
 return <nav ref={navRef} className={'meets-mobile-bottom-nav'+(d?' is-measured':'')} aria-label="Mobilā ātrā navigācija" style={vars}>
  <div className="meets-dock-glass" aria-hidden="true" style={d?{clipPath:`path('${d}')`,WebkitClipPath:`path('${d}')`}:undefined}/>
  {d&&<svg className="meets-dock-outline" width={width} height={BOX} viewBox={`0 0 ${width} ${BOX}`} aria-hidden="true" focusable="false">
   <defs>
    <filter id="meets-dock-blur" filterUnits="userSpaceOnUse" x={-40} y={-30} width={width+80} height={BOX+80}><feGaussianBlur stdDeviation="9"/></filter>
    {/* The shadow shows only outside the bar, so the glass stays clear. */}
    <mask id="meets-dock-outside" maskUnits="userSpaceOnUse" x={-40} y={-30} width={width+80} height={BOX+80}>
     <rect x={-40} y={-30} width={width+80} height={BOX+80} fill="#fff"/>
     <path d={d} fill="#000"/>
    </mask>
    <linearGradient id="meets-dock-rim" gradientUnits="userSpaceOnUse" x1="0" y1={DOCK.top} x2="0" y2={BOX}>
     <stop className="meets-dock-rim-top" offset="0"/>
     <stop className="meets-dock-rim-bottom" offset="1"/>
    </linearGradient>
    <clipPath id="meets-dock-inside"><path d={d}/></clipPath>
   </defs>
   {/* Colours of the shadow, sheen and rim come from the theme (mobile-bottom-nav.css). */}
   <g mask="url(#meets-dock-outside)"><path className="meets-dock-shadow" d={d} transform="translate(0 10)" filter="url(#meets-dock-blur)"/></g>
   <path className="meets-dock-sheen" d={d} fill="none" strokeWidth="6" clipPath="url(#meets-dock-inside)"/>
   <path d={d} fill="none" stroke="url(#meets-dock-rim)" strokeWidth="1.2"/>
  </svg>}
  {index>=0&&<span className="meets-dock-bubble" aria-hidden="true" style={x===null?undefined:{left:0,transform:`translateX(${x-DOCK.bubble/2}px)`}}/>}
  <div className="meets-dock-items">
   {links.map((link,i)=><Link key={link.href} href={link.href} className={'meets-dock-link'+(i===index?' active':'')} aria-current={i===index?'page':undefined}>
    <span className="meets-dock-icon"><Icon name={link.icon}/></span>
    <span className="meets-dock-label">{link.label}</span>
   </Link>)}
  </div>
 </nav>;
}

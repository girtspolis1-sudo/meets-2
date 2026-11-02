'use client';
import {useEffect,useRef} from 'react';
import EventDetailCard from '../components/event-detail-card.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';

// Events at one place on a phone, as the same cards the desktop place panel uses.
export default function MobileEventSheet({group,activeIds,favorites,onFavorite,onCalendar,onClose,today,clock,distance,isAdmin=false}){
 const closeRef=useRef(null);
 const sheetRef=useRef(null);
 const listRef=useRef(null);
 const closeFn=useRef(onClose);closeFn.current=onClose;
 // Swipe down to close: from the handle or title at any time, from the list only
 // when it is scrolled to the top (otherwise the swipe scrolls the cards).
 useEffect(()=>{
  const sheet=sheetRef.current;if(!sheet)return;
  let start=null;
  const reset=()=>{sheet.style.transition='transform .2s ease';sheet.style.transform='';};
  const down=e=>{
   if(!e.touches||e.touches.length!==1)return;
   const inList=listRef.current?.contains(e.target);
   if(inList&&listRef.current.scrollTop>0)return;
   start={y:e.touches[0].clientY,x:e.touches[0].clientX,t:Date.now(),dy:0,inList,drag:false};
  };
  const move=e=>{
   if(!start)return;
   const dy=e.touches[0].clientY-start.y,dx=e.touches[0].clientX-start.x;
   if(!start.drag){
    if(Math.abs(dy)<8)return;
    if(dy<0||Math.abs(dx)>Math.abs(dy)){start=null;return;}
    start.drag=true;sheet.style.transition='none';
   }
   start.dy=Math.max(0,dy);
   sheet.style.transform='translateY('+start.dy+'px)';
   if(e.cancelable)e.preventDefault();
  };
  const up=()=>{
   if(!start)return;
   const {dy,t,drag}=start;start=null;
   if(!drag)return;
   const fast=dy>40&&dy/(Date.now()-t)>0.5;
   if(dy>Math.min(140,sheet.offsetHeight*0.25)||fast){
    sheet.style.transition='transform .18s ease-in';sheet.style.transform='translateY(100%)';
    setTimeout(()=>closeFn.current(),170);
   }else reset();
  };
  sheet.addEventListener('touchstart',down,{passive:true});
  sheet.addEventListener('touchmove',move,{passive:false});
  sheet.addEventListener('touchend',up);
  sheet.addEventListener('touchcancel',up);
  return()=>{
   sheet.removeEventListener('touchstart',down);sheet.removeEventListener('touchmove',move);
   sheet.removeEventListener('touchend',up);sheet.removeEventListener('touchcancel',up);
  };
 },[]);
 useEffect(()=>{
  const old=document.activeElement;
  const node=closeRef.current;
  node?.focus();
  const keys=e=>{
   if(e.key==='Escape'){e.preventDefault();onClose();return;}
   if(e.key!=='Tab')return;
   const available=[...node.closest('[role="dialog"]').querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),summary')];
   if(!available.length)return;
   if(e.shiftKey&&document.activeElement===available[0]){e.preventDefault();available.at(-1).focus();}
   else if(!e.shiftKey&&document.activeElement===available.at(-1)){e.preventDefault();available[0].focus();}
  };
  document.addEventListener('keydown',keys);
  return()=>{document.removeEventListener('keydown',keys);old?.focus?.();};
 },[group.key]);
 const events=[...group.events].sort((a,b)=>{
  const selectedA=activeIds.has(a.id)?0:1,selectedB=activeIds.has(b.id)?0:1;
  return selectedA-selectedB||String(a.date_from).localeCompare(String(b.date_from))||
   String(a.time_from||'').localeCompare(String(b.time_from||''));
 });
 const selectedCount=events.filter(e=>activeIds.has(e.id)).length;
 return <div className="meets-mobile-sheet-layer">
  <div className="meets-mobile-sheet-backdrop" onClick={onClose} aria-hidden="true"/>
  <section ref={sheetRef} role="dialog" aria-modal="true" aria-label={'Pasākumi vietā '+group.label} className="meets-mobile-event-sheet meets-quiet-event-sheet">
   <div className="meets-mobile-sheet-handle" aria-hidden="true" title="Velc uz leju, lai aizvērtu"/>
   <header className="meets-mobile-sheet-title">
    <div className="meets-sheet-venue">
     <div className="meets-sheet-venue-heading">
      <strong title={group.label}>{group.label}</strong>
      {events[0]&&<div className="meets-sheet-venue-follow"><EventVenueFavorite event={events[0]} compact/></div>}
     </div>
     <small>{selectedCount} atlasīti · {events.length} kopā</small>
    </div>
    <button type="button" ref={closeRef} onClick={onClose} aria-label="Aizvērt pasākumu informāciju">✕</button>
   </header>
   <div className="meets-mobile-sheet-events" ref={listRef}>
    {events.map(event=><EventDetailCard key={event.id} event={event} today={today} clock={clock} km={distance?.(event)}
     className="meets-mobile-sheet-event" highlighted={activeIds.has(event.id)} outside={!activeIds.has(event.id)} isAdmin={isAdmin}
     saved={favorites.has(String(event.id))} onSave={onFavorite} onCalendar={onCalendar}/>)}
   </div>
  </section>
 </div>;
}

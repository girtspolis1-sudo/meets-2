'use client';
import {useEffect,useRef} from 'react';
import EventDetailCard from '../components/event-detail-card.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';

// Events at one place on a phone, as the same cards the desktop place panel uses.
export default function MobileEventSheet({group,activeIds,favorites,onFavorite,onCalendar,onClose,today,clock,distance,isAdmin=false}){
 const closeRef=useRef(null);
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
  <section role="dialog" aria-modal="true" aria-label={'Pasākumi vietā '+group.label} className="meets-mobile-event-sheet meets-quiet-event-sheet">
   <div className="meets-mobile-sheet-handle" aria-hidden="true"/>
   <header className="meets-mobile-sheet-title">
    <div className="meets-sheet-venue">
     <div className="meets-sheet-venue-heading">
      <strong>{group.label}</strong>
      {events[0]&&<div className="meets-sheet-venue-follow"><EventVenueFavorite event={events[0]} compact/></div>}
     </div>
     <small>{selectedCount} atlasīti · {events.length} kopā</small>
    </div>
    <button type="button" ref={closeRef} onClick={onClose} aria-label="Aizvērt pasākumu informāciju">✕</button>
   </header>
   <div className="meets-mobile-sheet-events">
    {events.map(event=><EventDetailCard key={event.id} event={event} today={today} clock={clock} km={distance?.(event)}
     className="meets-mobile-sheet-event" highlighted={activeIds.has(event.id)} outside={!activeIds.has(event.id)} isAdmin={isAdmin}
     saved={favorites.has(String(event.id))} onSave={onFavorite} onCalendar={onCalendar}/>)}
   </div>
  </section>
 </div>;
}

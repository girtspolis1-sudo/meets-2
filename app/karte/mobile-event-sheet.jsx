'use client';
import {useEffect,useRef} from 'react';
import {dateLabel,timeLabel} from '../../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,rigaTodayIso} from '../../lib/event-date.js';
import EventQuickActions from '../components/event-quick-actions.jsx';

export default function MobileEventSheet({group,activeIds,favorites,onFavorite,onCalendar,onClose}){
 const closeRef=useRef(null);
 useEffect(()=>{
  const old=document.activeElement;
  const node=closeRef.current;
  node?.focus();
  const keys=e=>{
   if(e.key==='Escape'){e.preventDefault();onClose();return;}
   if(e.key!=='Tab')return;
   const available=[...node.closest('[role="dialog"]').querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')];
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
 return <div className="meets-mobile-sheet-layer">
  <div className="meets-mobile-sheet-backdrop" onClick={onClose} aria-hidden="true"/>
  <section role="dialog" aria-modal="true" aria-label={'Pasākumi vietā '+group.label} className="meets-mobile-event-sheet">
   <div className="meets-mobile-sheet-handle" aria-hidden="true"/>
   <div className="meets-mobile-sheet-title"><div><strong>{group.label}</strong><small>{events.filter(e=>activeIds.has(e.id)).length} atlasīti · {events.length} kopā</small></div>
    <button type="button" ref={closeRef} onClick={onClose} aria-label="Aizvērt pasākumu informāciju">✕</button>
   </div>
   <div className="meets-mobile-sheet-events">
    {events.map(event=>{
     const selected=activeIds.has(event.id);
     const state=eventDateState(event,rigaTodayIso());
     return <article key={event.id} className={'meets-mobile-sheet-event'+(selected?'':' outside')}>
      <div className="meets-mobile-sheet-event-top"><span className={'event-date-badge '+state.tone}>{state.badge}</span><small>{event.primary_category||event.event_type||'Pasākums'}</small></div>
      <h3>{event.title}</h3>
      <p className="meets-mobile-sheet-meta">{eventDateRangeLabel(event,dateLabel)}{event.time_from?' · '+timeLabel(event):''}</p>
      {event.address_raw&&<p className="meets-mobile-sheet-meta">⌖ {event.address_raw}</p>}
      {event.description&&<p className="meets-mobile-sheet-description">{event.description}</p>}
      <EventQuickActions event={event} saved={favorites.has(String(event.id))}
       onSave={onFavorite} onCalendar={onCalendar}/>
      {!selected&&<small className="meets-mobile-sheet-outside-label">Šis pasākums neatbilst atlasītajiem filtriem.</small>}
     </article>;
    })}
   </div>
  </section>
 </div>;
}

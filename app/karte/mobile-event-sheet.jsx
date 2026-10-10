'use client';
import {useEffect,useRef} from 'react';
import {dateLabel,timeLabel} from '../../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,rigaTodayIso} from '../../lib/event-date.js';
import {navigationLinks} from '../../lib/meets-personal.js';

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
 },[group.key,onClose]);
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
     const links=navigationLinks(event);
     const official=event.sources?.find(s=>s.url?.startsWith('https://')||s.url?.startsWith('http://'))?.url;
     return <article key={event.id} className={'meets-mobile-sheet-event'+(selected?'':' outside')}>
      <div className="meets-mobile-sheet-event-top"><span className={'event-date-badge '+state.tone}>{state.badge}</span><small>{event.primary_category||event.event_type||'Pasākums'}</small></div>
      <h3>{event.title}</h3>
      <p className="meets-mobile-sheet-meta">{eventDateRangeLabel(event,dateLabel)}{event.time_from?' · '+timeLabel(event):''}</p>
      {event.address_raw&&<p className="meets-mobile-sheet-meta">⌖ {event.address_raw}</p>}
      {event.description&&<p className="meets-mobile-sheet-description">{event.description}</p>}
      <div className="meets-mobile-sheet-actions">
       <button type="button" aria-pressed={favorites.has(String(event.id))} onClick={()=>onFavorite(event.id)}>{favorites.has(String(event.id))?'♥ Saglabāts':'♡ Saglabāt'}</button>
       <button type="button" onClick={()=>onCalendar(event)}>▣ Kalendārā</button>
       {links.google&&<a href={links.google} target="_blank" rel="noopener noreferrer">⌖ Maršruts</a>}
       {links.waze&&<a href={links.waze} target="_blank" rel="noopener noreferrer">Waze ↗</a>}
       {official&&<a href={official} target="_blank" rel="noopener noreferrer">Oficiālā lapa ↗</a>}
      </div>
      {!selected&&<small className="meets-mobile-sheet-outside-label">Šis pasākums neatbilst atlasītajiem filtriem.</small>}
     </article>;
    })}
   </div>
  </section>
 </div>;
}

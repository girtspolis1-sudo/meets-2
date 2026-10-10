'use client';
import {useEffect,useRef} from 'react';
import {dateLabel,timeLabel} from '../../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,rigaTodayIso} from '../../lib/event-date.js';
import {navigationLinks} from '../../lib/meets-personal.js';

function ActionIcon({name}){
 const props={viewBox:'0 0 24 24',width:14,height:14,fill:'none',stroke:'currentColor',strokeWidth:1.75,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 if(name==='heart')return <svg {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
 if(name==='calendar')return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>;
 if(name==='route')return <svg {...props}><path d="m5 18 2.5-7 12-7-5.7 15-3.8-5-5 4Z"/><path d="m10 14 9.5-10"/></svg>;
 return <svg {...props}><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
}

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
     const links=navigationLinks(event);
     const official=event.sources?.find(s=>s.url?.startsWith('https://')||s.url?.startsWith('http://'))?.url;
     return <article key={event.id} className={'meets-mobile-sheet-event'+(selected?'':' outside')}>
      <div className="meets-mobile-sheet-event-top"><span className={'event-date-badge '+state.tone}>{state.badge}</span><small>{event.primary_category||event.event_type||'Pasākums'}</small></div>
      <h3>{event.title}</h3>
      <p className="meets-mobile-sheet-meta">{eventDateRangeLabel(event,dateLabel)}{event.time_from?' · '+timeLabel(event):''}</p>
      {event.address_raw&&<p className="meets-mobile-sheet-meta">⌖ {event.address_raw}</p>}
      {event.description&&<p className="meets-mobile-sheet-description">{event.description}</p>}
      <div className="meets-event-action-grid" role="group" aria-label={'Darbības pasākumam: '+event.title}>
       <button className="meets-event-action-btn" type="button" aria-pressed={favorites.has(String(event.id))}
        aria-label={favorites.has(String(event.id))?'Noņemt no saglabātajiem':'Saglabāt pasākumu'}
        onClick={()=>onFavorite(event.id)}><ActionIcon name="heart"/><span>{favorites.has(String(event.id))?'Saglabāts':'Saglabāt'}</span></button>
       <button className="meets-event-action-btn" type="button" onClick={()=>onCalendar(event)}>
        <ActionIcon name="calendar"/><span>Kalendārā</span></button>
       {links.google?
        <details className="meets-event-action-route"><summary className="meets-event-action-btn">
         <ActionIcon name="route"/><span>Maršruts</span></summary>
         <div className="meets-event-action-choices">
          <a href={links.google} rel="noopener noreferrer" target="_blank">Google Maps ↗</a>
          {links.waze&&<a href={links.waze} rel="noopener noreferrer" target="_blank">Waze ↗</a>}
         </div></details>
        :<button className="meets-event-action-btn" type="button" disabled title="Nav zināma adrese maršrutam"><ActionIcon name="route"/><span>Maršruts</span></button>}
       {official?<a className="meets-event-action-btn" href={official} rel="noopener noreferrer" target="_blank" aria-label="Atvērt pasākuma oficiālo lapu">
        <ActionIcon name="external"/><span>Lapa</span></a>
        :<span className="meets-event-action-btn meets-event-action-disabled" aria-disabled="true" title="Nav oficiālās saites"><ActionIcon name="external"/><span>Lapa</span></span>}
      </div>
      {!selected&&<small className="meets-mobile-sheet-outside-label">Šis pasākums neatbilst atlasītajiem filtriem.</small>}
     </article>;
    })}
   </div>
  </section>
 </div>;
}

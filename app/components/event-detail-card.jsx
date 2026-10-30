'use client';
import {useState} from 'react';
import EventFacts from './event-facts.jsx';
import EventQuickActions from './event-quick-actions.jsx';
import {cardDescription} from '../../lib/discovery-card.js';

// One event as shown on the map: facts, description, the five quick actions
// and a link to the event page. Used by the desktop place panel and the phone sheet.
export default function EventDetailCard({event,today,clock,km,saved,onSave,onCalendar,outside=false,highlighted=false,isAdmin=false,className=''}){
 const [open,setOpen]=useState(false);
 const description=cardDescription(event);
 const long=description.length>220;
 return <article className={['event-detail-card',className,highlighted?'is-highlighted':'',outside?'outside':''].filter(Boolean).join(' ')} data-selected={!outside}>
  <div className="event-detail-facts">
   <EventFacts event={event} today={today} clock={clock} km={km} title={<h3>{event.title}</h3>}/>
  </div>
  {description?<p className="event-detail-description">{long&&!open?description.slice(0,200).trimEnd()+'…':description}
   {long&&<button type="button" className="text-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Mazāk':'Vairāk'}</button>}</p>
   :<p className="event-detail-description meets-muted">Apraksts nav norādīts.</p>}
  <EventQuickActions event={event} quiet saved={saved} onSave={onSave} onCalendar={onCalendar}/>
  <div className="event-detail-links">
   <a href={'/pasakumi/'+encodeURIComponent(event.id)}>Pasākuma lapa →</a>
   {isAdmin&&<a className="admin-popup-edit" href={'/admin?edit='+encodeURIComponent(event.id)}>Labot</a>}
  </div>
  {outside&&<small className="meets-mobile-sheet-outside-label">Neatbilst izvēlētajiem filtriem</small>}
 </article>;
}

'use client';
import {useState} from 'react';
import EventFacts from './event-facts.jsx';
import EventCardMedia from './event-card-media.jsx';
import EventQuickActions from './event-quick-actions.jsx';
import OnlineJoin from './online-join.jsx';
import {cardDescription} from '../../lib/discovery-card.js';
import {useFullEvent} from '../../lib/use-full-event.js';
import {eventPath} from '../../lib/seo.js';

// One event as shown on the map: the same picture top as the grid cards (date
// and title on the event's picture or its group's standard one, heart in the
// corner), then the place, the description, the actions and a link to the event
// page. Used by the desktop place panel and the phone sheet; following the place
// is in the panel's header, so it is not repeated on every card.
export default function EventDetailCard({event,today,clock,km,saved,onSave,onCalendar,outside=false,highlighted=false,isAdmin=false,className=''}){
 const [open,setOpen]=useState(false);
 // The list carries a shortened description; opening "Vairāk" loads the full one.
 const {event:full}=useFullEvent(event,(open&&event.description_more===true)||['online','hybrid'].includes(event.attendance_mode));
 const description=cardDescription(open?full:event);
 const long=description.length>220||event.description_more===true;
 return <article className={['event-detail-card','ec-detail',className,highlighted?'is-highlighted':'',outside?'outside':''].filter(Boolean).join(' ')} data-selected={!outside}>
  <EventCardMedia event={event} today={today} title={event.title} saved={saved} onSave={onSave} className="ec-detail-media"/>
  <div className="event-detail-facts">
   <EventFacts event={event} today={today} clock={clock} km={km} hideWhen/>
  </div>
  {description?<p className="event-detail-description">{long&&!open?description.slice(0,200).trimEnd()+'…':description}
   {long&&<button type="button" className="text-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Mazāk':'Vairāk'}</button>}</p>
   :null}
  <OnlineJoin event={full||event} compact/>
  <EventQuickActions event={event} quiet noFavorite onCalendar={onCalendar}/>
  <div className="event-detail-links">
   <a href={eventPath(event)}>Pasākuma lapa →</a>
   {isAdmin&&<a className="admin-popup-edit" href={'/admin?edit='+encodeURIComponent(event.id)}>Labot</a>}
  </div>
  {outside&&<small className="meets-mobile-sheet-outside-label">Neatbilst izvēlētajiem filtriem</small>}
 </article>;
}

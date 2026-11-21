import Link from 'next/link';
import {cardCategory,cardLocation} from '../../lib/discovery-card.js';
import {shortDate} from '../../lib/event-seo.js';
import {municipalityShortName,eventPath} from '../../lib/seo.js';

function when(event){
 const start=shortDate(event.date_from),end=event.date_to&&event.date_to!==event.date_from?shortDate(event.date_to):'';
 const time=event.time_from?String(event.time_from).slice(0,5):'';
 return [end?start+'–'+end:start,time].filter(Boolean).join(' · ');
}
function where(event){
 const place=event.settlement||municipalityShortName(event.municipality||'');
 const venue=cardLocation(event);
 return [venue,place&&place!==venue?place:''].filter(Boolean).join(', ');
}

// Plain server-rendered event links: readable without JavaScript and by search engines.
export default function EventLinkList({events,className=''}){
 if(!events?.length)return null;
 return <ul className={'event-link-list'+(className?' '+className:'')}>
  {events.map(event=><li key={event.id}>
   <Link href={eventPath(event)}><strong>{event.title}</strong></Link>
   <span className="event-link-meta">{when(event)} · {where(event)}</span>
   <span className="event-link-category">{cardCategory(event)}</span>
  </li>)}
 </ul>;
}

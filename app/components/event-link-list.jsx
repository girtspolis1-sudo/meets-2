import Link from 'next/link';
import EventListActions from './event-list-actions.jsx';
import {cardArt,cardCategory,cardLocation} from '../../lib/discovery-card.js';
import {shortDate} from '../../lib/event-seo.js';
import {nearbyMapPath,NEARBY_MAP_RADIUS} from '../../lib/event-sharing.js';
import {municipalityShortName,eventPath} from '../../lib/seo.js';
import './event-link-list.css';

const MONTHS=['JAN','FEB','MAR','APR','MAI','JŪN','JŪL','AUG','SEP','OKT','NOV','DEC'];

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
function dateParts(iso){
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));
 return m?{day:String(Number(m[3])),month:MONTHS[Number(m[2])-1]||''}:null;
}

// Event rows: a date tile in the group's colour, the title, when and where, and
// at the end the map link (the event's place in the centre, 20 km around it)
// and small calendar, save and share buttons. The title, facts and map link are
// plain server-rendered links, readable without JavaScript and by search engines.
export default function EventLinkList({events,className=''}){
 if(!events?.length)return null;
 return <ul className={'event-link-list elist'+(className?' '+className:'')}>
  {events.map(event=>{
   const parts=dateParts(event.date_from),art=cardArt(event),map=nearbyMapPath(event);
   return <li key={event.id} className="elist-row">
    <span className={'elist-date elist-'+art.palette} aria-hidden="true">
     {parts&&<><strong>{parts.day}</strong><small>{parts.month}</small></>}
    </span>
    <div className="elist-info">
     <Link href={eventPath(event)}><strong>{event.title}</strong></Link>
     <span className="event-link-meta">{when(event)} · {where(event)}</span>
     <span className="event-link-category">{cardCategory(event)}</span>
    </div>
    <div className="elist-end">
     {map&&<Link className="elist-map" href={map} title={'Atvērt kartē: '+NEARBY_MAP_RADIUS+' km ap '+(event.venue_name||'pasākuma vietu')}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
      <span>Kartē<span className="elist-map-radius"> · {NEARBY_MAP_RADIUS} km</span><span className="elist-map-around"> apkārtnē</span></span>
     </Link>}
     <EventListActions event={event}/>
    </div>
   </li>;
  })}
 </ul>;
}

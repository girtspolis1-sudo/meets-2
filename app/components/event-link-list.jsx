import Link from 'next/link';
import EventRow from './event-row.jsx';
import EventListActions from './event-list-actions.jsx';
import {nearbyMapPath,NEARBY_MAP_RADIUS} from '../../lib/event-sharing.js';

// Event rows on the listing pages and in related lists: the shared EventRow with
// the public actions at the end, the map link (the event's place in the centre,
// 20 km around it) and small calendar, save and share buttons. Title, facts and
// the map link are plain server-rendered links, readable without JavaScript and
// by search engines.
export default function EventLinkList({events,className=''}){
 if(!events?.length)return null;
 return <ul className={'event-link-list elist'+(className?' '+className:'')}>
  {events.map(event=>{
   const map=nearbyMapPath(event);
   return <EventRow key={event.id} event={event} actions={<>
    {map&&<Link className="elist-map" href={map} title={'Atvērt kartē: '+NEARBY_MAP_RADIUS+' km ap '+(event.venue_name||'pasākuma vietu')}>
     <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
     <span>Kartē</span>
    </Link>}
    <EventListActions event={event}/>
   </>}/>;
  })}
 </ul>;
}

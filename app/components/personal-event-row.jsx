import Link from 'next/link';
import EventRow from './event-row.jsx';
import EventListActions from './event-list-actions.jsx';

// The profile's event list: the shared EventRow (personal variant) with the
// reason it is here ("Saglabāts", "Sekoju vietai") and the public actions.
export function PersonalEventRow({event,badges=[]}){
 return <EventRow event={event} variant="personal" badges={badges} actions={<EventListActions event={event}/>}/>;
}
export function PersonalEventList({events=[],badgesFor=()=>[],empty='Nav gaidāmu pasākumu.'}){
 return events.length?<ul className="event-link-list elist">{events.map(e=><PersonalEventRow key={e.id} event={e} badges={badgesFor(e)}/>)}</ul>
  :<div className="meets-unified-event-empty">{empty} <Link href="/karte">Atrast pasākumus →</Link></div>;
}

import Link from 'next/link';
import {cardDate,cardLocation} from '../../lib/discovery-card.js';
export function PersonalEventRow({event,badges=[]}){
 return <div className="meets-unified-event-row">
  <span className="meets-unified-event-date" aria-hidden="true"><strong>{event.date_from?.slice(8,10)||'—'}</strong><small>{event.date_from?.slice(5,7)||'—'}.</small></span>
  <div className="meets-unified-event-details"><Link href={'/pasakumi/'+encodeURIComponent(event.id)} className="meets-unified-event-title">{event.title}</Link>
   <small>{cardDate(event)} · {cardLocation(event)}</small>
   {badges.length>0&&<span className="meets-unified-badges">{badges.map(b=><span key={b}>{b}</span>)}</span>}
  </div>
  <Link href={'/pasakumi/'+encodeURIComponent(event.id)} className="meets-unified-event-open" aria-label={'Atvērt pasākumu: '+event.title}>Atvērt <span aria-hidden="true">→</span></Link>
 </div>;
}
export function PersonalEventList({events=[],badgesFor=()=>[],empty='Nav gaidāmu pasākumu.'}){
 return events.length?<div className="meets-unified-event-list">{events.map(e=><PersonalEventRow key={e.id} event={e} badges={badgesFor(e)}/>)}</div>:<div className="meets-unified-event-empty">{empty} <Link href="/karte">Atrast pasākumus →</Link></div>;
}

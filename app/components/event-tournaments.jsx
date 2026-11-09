import Link from 'next/link';
import {eventTournaments} from '../../lib/tournament-server.js';
import {SPORTS} from '../../lib/tournament.js';

// On an event's public page: the tournament the organizer linked to it
// (schedule, results and tables), when it is published.
export default async function EventTournaments({eventId='',shareToken=''}){
 const list=await eventTournaments({eventId,shareToken});
 if(!list.length)return null;
 return <section className="event-tournaments" aria-labelledby="event-tournaments-title">
  <h2 id="event-tournaments-title">{list.length>1?'Turnīri':'Turnīrs'}</h2>
  <ul>{list.map(t=><li key={t.share_token}>
   <span className="event-tournaments-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h5v4H3zM3 15h5v4H3zM16 10h5v4h-5z"/><path d="M8 7h3v10H8M11 12h5"/></svg></span>
   <span className="event-tournaments-text"><strong>{t.title}</strong><small>{[SPORTS[t.sport]?.name,'spēļu grafiks, rezultāti un tabulas'].filter(Boolean).join(' · ')}</small></span>
   <Link className="button compact" href={'/turniri/'+t.share_token}>Atvērt turnīru →</Link>
  </li>)}</ul>
 </section>;
}

'use client';
import Link from 'next/link';
import EventFacts from './event-facts.jsx';
import EventQuickActions from './event-quick-actions.jsx';
import EventVenueFavorite from './event-venue-favorite.jsx';
import {cardCategory,cardDescription,cardGroup,cardImage} from '../../lib/discovery-card.js';
import {rigaClockMinutes,rigaTodayIso} from '../../lib/event-date.js';

const EMOJI={music:'🎵',stage:'🎭',culture:'🖼️',sport:'⚽',active:'🌿',markets:'🎉',learning:'💡',community:'🤝',other:'✦'};
// One event in the home and catalogue grids. The facts are the same as on the
// map; the whole card opens the event, the heart saves it.
export default function DiscoveryEventCard({event,onOpen,actions=false,footer=null}){
 const image=cardImage(event),group=cardGroup(event),summary=cardDescription(event);
 const detailHref='/pasakumi/'+encodeURIComponent(event.id);
 const title=onOpen
  ?<h3><button type="button" className="meets-card-open" onClick={()=>onOpen(event.id)}>{event.title}</button></h3>
  :<h3><Link className="meets-card-open" href={detailHref}>{event.title}</Link></h3>;
 return <article className={'meets-discovery-card catalog-event-card theme-'+group+(image?' has-image':' no-image')}>
  {image?<div className="meets-discovery-card-media">
   <img src={image} alt="" loading="lazy" decoding="async" onError={e=>{e.currentTarget.parentElement.hidden=true;}}/>
  </div>:<span className="meets-card-symbol" aria-hidden="true">{EMOJI[group]}</span>}
  <div className="meets-discovery-card-body">
   <span className="meets-card-category">{cardCategory(event)}</span>
   <div className="meets-discovery-card-facts">
    <EventFacts event={event} today={rigaTodayIso()} clock={rigaClockMinutes()} compact title={title}/>
   </div>
   {summary&&<p className="meets-discovery-description">{summary}</p>}
   <div className="meets-card-footer">
    <EventVenueFavorite event={event} compact/>
    {actions&&<details className="meets-card-secondary-actions"><summary>Darbības</summary><EventQuickActions event={event}/></details>}
   </div>
   {footer&&<div className="meets-card-additional">{footer}</div>}
  </div>
  <div className="meets-card-save"><EventQuickActions event={event} favoriteOnly/></div>
 </article>;
}

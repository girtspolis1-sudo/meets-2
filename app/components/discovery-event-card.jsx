'use client';
import Link from 'next/link';
import EventFacts from './event-facts.jsx';
import EventQuickActions from './event-quick-actions.jsx';
import EventVenueFavorite from './event-venue-favorite.jsx';
import FollowButton from './follow-button.jsx';
import {cardCategory,cardDescription,cardGroup,cardImage,isPaidEvent} from '../../lib/discovery-card.js';
import {eventTopicIcon} from '../../lib/event-map-icons.js';
import {officialEventUrl} from '../../lib/event-sharing.js';
import {priceLabel} from '../../lib/map-nearby.js';
import {rigaClockMinutes,rigaTodayIso} from '../../lib/event-date.js';
import {eventTerm} from '../../lib/event-term.js';

function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}

// The days badge, as on the map pin: today is a green pulsing dot, not "0d".
function DaysMark({term,className=''}){
 if(term.days===0)return <span className={'c3-days-chip c3-days-now'+(term.tone==='ended'?' ended':'')+(className?' '+className:'')} aria-hidden="true"/>;
 return <span className={'c3-days-chip'+(className?' '+className:'')} aria-hidden="true">{term.badge}</span>;
}

// One event in the home and catalogue grids. The facts are the same as on the
// map; the title opens the event, the heart saves it, and the footer row holds
// the same actions as the map card plus following the place and organizer.
export default function DiscoveryEventCard({event,onOpen,actions=false,footer=null}){
 const image=cardImage(event),group=cardGroup(event),summary=cardDescription(event);
 // The icon names the topic: the sport (🏀, 🤾, 🏒…) or what the event is about.
 const icon=eventTopicIcon(event);
 const term=eventTerm(event,rigaTodayIso());
 const paid=isPaidEvent(event),price=paid?priceLabel(event):'';
 const original=officialEventUrl(event),host=original?hostOf(original):'';
 const orgId=event.organization_id,orgName=event.organizer_name;
 const detailHref='/pasakumi/'+encodeURIComponent(event.id);
 const title=onOpen
  ?<h3><button type="button" className="meets-card-open" onClick={()=>onOpen(event.id)}>{event.title}</button></h3>
  :<h3><Link className="meets-card-open" href={detailHref}>{event.title}</Link></h3>;
 const euro=paid&&<span className="c3-price-chip" title={price?'Maksas pasākums: '+price:'Maksas pasākums'} aria-label="Maksas pasākums">€</span>;
 return <article className={'meets-discovery-card catalog-event-card theme-'+group+(image?' has-image':' no-image')}>
  {image?<div className="meets-discovery-card-media">
   <img src={image} alt="" loading="lazy" decoding="async" onError={e=>{e.currentTarget.parentElement.hidden=true;}}/>
   <span className={'c3-media-marks tone-'+term.tone} title={term.label}><DaysMark term={term}/>{euro}</span>
  </div>:<span className={'meets-card-symbol c3-card-symbol tone-'+term.tone} title={icon.label+', '+term.label+(paid?', maksas':'')} role="img" aria-label={icon.label}>
   <span aria-hidden="true">{icon.glyph}</span><DaysMark term={term}/>{euro}</span>}
  <div className="meets-discovery-card-body">
   <span className="meets-card-category">{cardCategory(event)}</span>
   <div className="meets-discovery-card-facts">
    <EventFacts event={event} today={rigaTodayIso()} clock={rigaClockMinutes()} compact title={title}/>
   </div>
   <p className={'meets-discovery-description'+(summary?'':' is-empty')}>{summary||'Apraksts nav norādīts.'}</p>
   <div className="meets-card-links">
    {orgId&&orgName&&<span className="meets-card-organizer">Organizē <Link href={'/organizatori/'+encodeURIComponent(orgId)}>{orgName}</Link></span>}
    {original?<a className="meets-card-original" href={original} target="_blank" rel="noopener noreferrer">Oriģinālais pasākums{host?' · '+host:''} <span aria-hidden="true">↗</span></a>
     :<span className="meets-card-original is-missing">Oriģinālā saite nav norādīta</span>}
   </div>
   <div className="meets-card-footer">
    <div className="meets-card-follows">
     <EventVenueFavorite event={event} compact fullLabel/>
     {orgId&&<FollowButton targetKind="organization" targetId={orgId} className="meets-card-follow-org" label="Sekot organizatoram" followingLabel="Sekoju organizatoram"/>}
    </div>
    {actions&&<EventQuickActions event={event} quiet compact noFavorite/>}
   </div>
   {footer&&<div className="meets-card-additional">{footer}</div>}
  </div>
  <div className="meets-card-save"><EventQuickActions event={event} favoriteOnly/></div>
 </article>;
}

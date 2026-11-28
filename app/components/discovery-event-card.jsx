'use client';
import Link from 'next/link';
import EventQuickActions from './event-quick-actions.jsx';
import EventVenueFavorite from './event-venue-favorite.jsx';
import FollowButton from './follow-button.jsx';
import EventCardMedia from './event-card-media.jsx';
import {cardGroup,cardImage} from '../../lib/discovery-card.js';
import {officialEventUrl} from '../../lib/event-sharing.js';
import {isApproximatePlace} from '../../lib/map-nearby.js';
import {rigaTodayIso} from '../../lib/event-date.js';
import {eventPath} from '../../lib/seo.js';

function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}

// One event in the home and catalogue grids. The picture (the event's own or a
// standard one for its group) carries the category, the date and the title; the
// row under it holds following the place and the same actions as on the map.
// Wide cards show the action names; narrow cards and small screens show icons
// only (event-card.css), so more events fit on one screen.
export default function DiscoveryEventCard({event,actions=false,footer=null}){
 const group=cardGroup(event),today=rigaTodayIso();
 const original=officialEventUrl(event),host=original?hostOf(original):'';
 const orgId=event.organization_id,orgName=event.organizer_name;
 const place=[event.venue_name,event.settlement||event.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'Vieta nav norādīta';
 const online={online:'Tiešsaistē',hybrid:'Klātienē un tiešsaistē'}[event.attendance_mode]||'';
 // The title always leads to the event's page.
 const title=<Link className="ec-open" href={eventPath(event)}>{event.title}</Link>;
 return <article className={'ec-card theme-'+group+(cardImage(event)?' has-image':' no-image')}>
  <EventCardMedia event={event} today={today} title={title}/>
  <div className="ec-body">
   <span className="ec-place">
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
    <span>{place}</span>
    {isApproximatePlace(event)&&<em title="Precīza vieta nav zināma — kartē rādīts apdzīvotās vietas centrs">aptuvena vieta</em>}
   </span>
   {(online||(orgId&&orgName)||original)&&<div className="ec-links">
    {online&&<span className="ec-online">{online}</span>}
    {orgId&&orgName&&<span className="ec-organizer">Organizē <Link href={'/organizatori/'+encodeURIComponent(orgId)}>{orgName}</Link>
     <FollowButton targetKind="organization" targetId={orgId} className="ec-follow-org" label="Sekot" followingLabel="Seko" ariaLabel={'Sekot rīkotājam '+orgName}/></span>}
    {original&&<a className="ec-source" href={original} target="_blank" rel="noopener noreferrer">Avots{host?' · '+host:''} <span aria-hidden="true">↗</span></a>}
   </div>}
  </div>
  {actions&&<div className="ec-actions">
   <EventQuickActions event={event} quiet compact noFavorite leading={<EventVenueFavorite event={event} asAction/>}/>
  </div>}
  {footer&&<div className="ec-extra">{footer}</div>}
 </article>;
}

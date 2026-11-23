'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import EventQuickActions from './event-quick-actions.jsx';
import EventVenueFavorite from './event-venue-favorite.jsx';
import FollowButton from './follow-button.jsx';
import {cardArt,cardCategory,cardGroup,cardImage,isPaidEvent} from '../../lib/discovery-card.js';
import {officialEventUrl} from '../../lib/event-sharing.js';
import {isApproximatePlace,liveBadge,priceLabel,shortDate,whenLabel} from '../../lib/map-nearby.js';
import {rigaClockMinutes,rigaTodayIso} from '../../lib/event-date.js';
import {eventTerm} from '../../lib/event-term.js';
import {isBackgroundLong,isLastDays} from '../../lib/event-duration.js';
import {eventPath} from '../../lib/seo.js';
import './event-card.css';

function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}

// Large line icons for the standard picture, one per event group.
const ART_PATHS={
 note:<><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></>,
 mask:<><path d="M4 5c5 2 11 2 16 0v6c0 5-3.6 9-8 9s-8-4-8-9Z"/><path d="M8.5 10.5h1.5M14 10.5h1.5M9 15c1.8 1.4 4.2 1.4 6 0"/></>,
 flag:<><path d="M3 9h18M5 9l1 11h12l1-11M8 9V6a4 4 0 0 1 8 0v3"/></>,
 frame:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></>,
 ball:<><circle cx="12" cy="12" r="9"/><path d="M12 3c2.5 3 2.5 15 0 18M3 12h18M5.5 5.5c3 2 10 2 13 0M5.5 18.5c3-2 10-2 13 0"/></>,
 leaf:<><path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Z"/><path d="M5 19 13 11"/></>,
 bulb:<><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3Z"/></>,
 people:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c.5-3.4 2.8-5.5 5.5-5.5s5 2.1 5.5 5.5M14.5 14c2.6-.6 5.2.9 6 4"/></>,
 hall:<><path d="M3 9 12 4l9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/></>,
 spark:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M12 13l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 15.3l2-.3Z"/></>
};

// When the event is: "Šodien 18:00", "Rīt", "Apskatāms līdz 28. nov.", coloured
// like the map pin (today, tomorrow, later, last days, long-running).
function WhenChip({event,today}){
 const clock=rigaClockMinutes();
 const multiDay=event.date_to&&event.date_to>event.date_from&&String(event.date_from)>=String(today);
 const live=liveBadge(event,today,clock);
 const tone=isBackgroundLong(event,today)?'long':isLastDays(event,today)?'lastdays':eventTerm(event,today).tone;
 return <span className={'ec-when event-facts-when term-'+tone}>
  {live==='now'?'Notiek tagad':whenLabel(event,today)}{multiDay?' – '+shortDate(event.date_to):''}
 </span>;
}

// One event in the home and catalogue grids. The picture (the event's own or a
// standard one for its group) carries the category, the date and the title; the
// row under it holds following the place and the same actions as on the map.
// Wide cards show the action names; narrow cards and small screens show icons
// only (event-card.css), so more events fit on one screen.
export default function DiscoveryEventCard({event,onOpen,actions=false,footer=null}){
 const [broken,setBroken]=useState(false),imgRef=useRef(null);
 // An image that failed before hydration never fires onError: check it once mounted.
 useEffect(()=>{const img=imgRef.current;if(img&&img.complete&&!img.naturalWidth)setBroken(true);},[]);
 const image=broken?'':cardImage(event),group=cardGroup(event),art=cardArt(event);
 const today=rigaTodayIso();
 const paid=isPaidEvent(event),price=priceLabel(event);
 const original=officialEventUrl(event),host=original?hostOf(original):'';
 const orgId=event.organization_id,orgName=event.organizer_name;
 const place=[event.venue_name,event.settlement||event.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'Vieta nav norādīta';
 const online={online:'Tiešsaistē',hybrid:'Klātienē un tiešsaistē'}[event.attendance_mode]||'';
 const title=onOpen
  ?<button type="button" className="ec-open" onClick={()=>onOpen(event.id)}>{event.title}</button>
  :<Link className="ec-open" href={eventPath(event)}>{event.title}</Link>;
 return <article className={'ec-card theme-'+group+(image?' has-image':' no-image')}>
  <div className={'ec-media'+(image?'':' ec-art ec-'+art.palette)}>
   {image?<img ref={imgRef} src={image} alt="" loading="lazy" decoding="async" onError={()=>setBroken(true)}/>
    :<svg className="ec-art-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ART_PATHS[art.icon]}</svg>}
   <div className="ec-top">
    <span className="ec-category">{cardCategory(event)}</span>
    <EventQuickActions event={event} favoriteOnly/>
   </div>
   <div className="ec-band">
    <div className="ec-chips">
     <WhenChip event={event} today={today}/>
     {paid&&<span className="ec-price" title={price?'Maksas pasākums: '+price:'Maksas pasākums'}>{price||'€'}</span>}
     {event.price_status==='free'&&<span className="ec-price free">Bezmaksas</span>}
    </div>
    <h3 className="ec-title">{title}</h3>
   </div>
  </div>
  <div className="ec-body">
   <span className="ec-place">
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
    <span>{place}</span>
    {isApproximatePlace(event)&&<em title="Precīza vieta nav zināma — kartē rādīts apdzīvotās vietas centrs">aptuvena vieta</em>}
   </span>
   {(online||(orgId&&orgName)||original)&&<div className="ec-links">
    {online&&<span className="ec-online">{online}</span>}
    {orgId&&orgName&&<span className="ec-organizer">Organizē <Link href={'/organizatori/'+encodeURIComponent(orgId)}>{orgName}</Link>
     <FollowButton targetKind="organization" targetId={orgId} className="ec-follow-org" label="Sekot" followingLabel="Seko"/></span>}
    {original&&<a className="ec-source" href={original} target="_blank" rel="noopener noreferrer">Avots{host?' · '+host:''} <span aria-hidden="true">↗</span></a>}
   </div>}
  </div>
  {actions&&<div className="ec-actions">
   <EventQuickActions event={event} quiet compact noFavorite leading={<EventVenueFavorite event={event} asAction/>}/>
  </div>}
  {footer&&<div className="ec-extra">{footer}</div>}
 </article>;
}

import Link from 'next/link';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import ShareButton from '../../components/share-button.jsx';
import OnlineJoin from '../../components/online-join.jsx';
import MeetsSunMark from '../../components/meets-sun-mark.jsx';
import SharedEventNav from './shared-nav.jsx';
import EventTournaments from '../../components/event-tournaments.jsx';
import {readSharedEvent} from '../../../lib/shared-event-server.js';
import {coverImageUrl,excerpt,flyerPath,placeLines,priceLine,rigaOffsetLabel,scheduleLines,sharedStatusNote,sharePath} from '../../../lib/shared-event.js';
import {navigationLinks} from '../../../lib/meets-personal.js';
import {organizerPath} from '../../../lib/organizer-path.js';

export const dynamic='force-dynamic';

// generateMetadata and the page share one read per request.
const findEvent=cache(async token=>{try{return await readSharedEvent(token);}catch{return null;}});

export async function generateMetadata({params}){
 const {token}=await params;
 const event=await findEvent(token);
 // A share link is not for search engines, whether the event is private or not.
 if(!event)return {title:'Pasākums nav pieejams',robots:{index:false,follow:false}};
 const image=coverImageUrl(process.env.SUPABASE_URL,event.cover_image_path);
 const description=[scheduleLines(event)[0],placeLines(event)[0]].join(' · ');
 return {
  title:event.title,
  description,
  robots:{index:false,follow:false},
  openGraph:{type:'website',title:event.title,description,url:sharePath(token),...(image?{images:[{url:image}]}:{})}
 };
}

function GlobeIcon(){
 return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
}
function LockIcon(){
 return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
}

export default async function SharedEventPage({params}){
 const {token}=await params;
 const event=await findEvent(token);
 if(!event)notFound();
 const image=coverImageUrl(process.env.SUPABASE_URL,event.cover_image_path);
 const note=sharedStatusNote(event);
 const description=excerpt(event.description,6000);
 const org=event.organization||{};
 const places=placeLines(event);
 const route=event.attendance_mode!=='online'?navigationLinks({latitude:event.latitude,longitude:event.longitude,address_raw:event.address,venue_name:event.venue_name}).google:null;
 const price=priceLine(event);
 return <article className="meets-event-page meets-shared-event">
  <SharedEventNav token={token} status={event.status}/>
  <p className={'shared-event-note '+(event.visibility==='private'?'is-private':event.status==='pending_review'&&!event.event_id?'is-pending':'is-public')} role="note">{event.visibility==='private'?<LockIcon/>:<GlobeIcon/>}{note}</p>
  <div className="meets-detail-hero">
   {image?<img src={image} alt="" className="catalog-detail-cover"/>:<div className="shared-event-cover-fallback" aria-hidden="true"><MeetsSunMark/></div>}
  </div>
  <div className="meets-detail-body">
   <div className="meets-detail-headline">
    <span className="meets-detail-tag">{event.category||'Pasākums'}</span>
    <h1>{event.title}</h1>
    {org.name&&<p className="shared-event-organizer">Organizē {org.slug||org.id?<Link href={organizerPath(org)}>{org.name}</Link>:<strong>{org.name}</strong>}</p>}
   </div>
   <dl className="shared-event-facts">
    <div><dt>Kad</dt><dd>{scheduleLines(event,{maxDays:62}).map((line,i)=><span key={i}>{line}</span>)}<small>{rigaOffsetLabel(event.date_from)} · Rīgas laiks</small></dd></div>
    <div><dt>Kur</dt><dd>{places.map((line,i)=><span key={i}>{line}</span>)}{route&&<a href={route} target="_blank" rel="noopener noreferrer">Kā nokļūt ↗</a>}</dd></div>
    {price&&<div><dt>Dalība</dt><dd><span>{price}</span></dd></div>}
   </dl>
   <OnlineJoin event={event}/>
   {description&&<section className="meets-detail-description"><h2>Par pasākumu</h2><p>{description}</p></section>}
   <EventTournaments shareToken={token}/>
   <div className="meets-detail-primary-actions shared-event-actions">
    <ShareButton path={sharePath(token)} title={event.title} label="Kopīgot saiti" className="button primary"/>
    <Link className="button" href={flyerPath(token)}>Sludinājums drukai</Link>
    {event.event_id&&<Link className="button" href={'/pasakumi/'+event.event_id}>Skatīt MEETS kartē →</Link>}
   </div>
  </div>
 </article>;
}

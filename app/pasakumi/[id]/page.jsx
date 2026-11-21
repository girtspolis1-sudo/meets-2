import Link from 'next/link';
import TrackView from '../../components/track-view.jsx';
import {notFound,permanentRedirect} from 'next/navigation';
import {cache} from 'react';
import {findPublicEvent,readEventsCached} from '../../../lib/events-server.js';
import {cardCategory,cardDate,cardDescription,cardImage,cardLocation} from '../../../lib/discovery-card.js';
import {timeLabel} from '../../../lib/catalog.js';
import {officialEventUrl} from '../../../lib/event-sharing.js';
import EventQuickActions from '../../components/event-quick-actions.jsx';
import EventVenueFavorite from '../../components/event-venue-favorite.jsx';
import EventFacts from '../../components/event-facts.jsx';
import OnlineJoin from '../../components/online-join.jsx';
import EventLinkList from '../../components/event-link-list.jsx';
import {addIsoDays,rigaClockMinutes,rigaTodayIso} from '../../../lib/event-date.js';
import EventTournaments from '../../components/event-tournaments.jsx';
import {eventDescription,eventJsonLd,eventTitle,jsonLdScript} from '../../../lib/event-seo.js';
import {eventPath,municipalityLocative,municipalitySlug,pageRobots,parseEventParam} from '../../../lib/seo.js';
import {eventGroup} from '../../../lib/home-category-filters.js';
import {municipalityBySlug,overlaps} from '../../../lib/event-listings.js';
import ListingPage,{buildListing,listingMetadata} from '../listing-page.jsx';

export const dynamic='force-dynamic';

// One read per request for generateMetadata and the page: an event, or a municipality listing.
const resolve=cache(async param=>{
 const parsed=parseEventParam(param);
 if(parsed.kind==='other'){
  const {events}=await readEventsCached();
  const municipality=municipalityBySlug(events,parsed.value);
  return municipality?{kind:'listing',municipality,events}:null;
 }
 const found=await findPublicEvent(parsed);
 if(!found)return null;
 const canonical=eventPath(found.event);
 return {kind:'event',...found,canonical,redirect:'/pasakumi/'+decodeURIComponent(String(param))!==canonical};
});

// Ended events stay indexable for 30 days, then the page remains but leaves search results.
const indexableEnded=event=>(event.date_to||event.date_from)>=addIsoDays(rigaTodayIso(),-30);

export async function generateMetadata({params}){
 const {id}=await params;
 const found=await resolve(id).catch(()=>null);
 if(!found)return {title:'Pasākums nav atrasts'};
 if(found.kind==='listing')return listingMetadata(buildListing(found.events,{municipality:found.municipality}));
 const {event,ended,canonical}=found;
 const image=cardImage(event);
 const description=eventDescription(event);
 return {
  title:(ended?'Beidzies: ':'')+eventTitle(event),
  description,
  alternates:{canonical},
  robots:pageRobots(!ended||indexableEnded(event)),
  openGraph:{
   type:'website',
   title:event.title,
   description:cardDate(event)+' · '+cardLocation(event),
   url:canonical,
   images:[image.startsWith('https://')?{url:image}:{url:'/og/'+event.id,width:1200,height:630}]
  }
 };
}

// Same day, same municipality (or the same group when the event has ended): up to six.
async function relatedEvents(event,ended){
 const {events}=await readEventsCached();
 const others=events.filter(e=>e.id!==event.id&&eventGroup(e)!=='civic');
 const today=rigaTodayIso();
 if(ended){
  const group=eventGroup(event);
  return others.filter(e=>e.municipality===event.municipality&&(!group||eventGroup(e)===group)).slice(0,6)
   .concat(others.filter(e=>e.municipality===event.municipality)).filter((e,i,a)=>a.indexOf(e)===i).slice(0,6);
 }
 const day=event.date_from<today?today:event.date_from;
 return others.filter(e=>e.municipality===event.municipality&&overlaps(e,{from:day,to:day})).slice(0,6);
}

export default async function EventPage({params}){
 const {id}=await params;
 const found=await resolve(id);
 if(!found)notFound();
 if(found.kind==='listing')return <ListingPage data={buildListing(found.events,{municipality:found.municipality})} allEvents={found.events} municipality={found.municipality}/>;
 if(found.redirect)permanentRedirect(found.canonical);
 const {event,ended}=found;
 const image=cardImage(event),description=cardDescription(event),official=officialEventUrl(event);
 const time=timeLabel(event);
 const related=await relatedEvents(event,ended);
 const townSlug=municipalitySlug(event.municipality);
 return <article className="meets-event-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(eventJsonLd(event,{image,officialUrl:official}))}}/>
  <TrackView name="event_view" params={{item_id:event.id,item_category:event.primary_category,municipality:event.municipality}}/>
  <nav className="meets-event-page-back" aria-label="Atpakaļ"><Link href="/pasakumi">← Visi pasākumi</Link>
   {townSlug&&<> · <Link href={'/pasakumi/'+townSlug}>Pasākumi {municipalityLocative(event.municipality)}</Link></>}</nav>
  {ended&&<p className="meets-event-ended" role="status"><strong>Pasākums ir beidzies.</strong> Zemāk ir citi pasākumi {townSlug?municipalityLocative(event.municipality):'tuvumā'}.</p>}
  {/* Without a picture the title comes first; an empty image area only pushes it down. */}
  {image&&<div className="meets-detail-hero"><img src={image} alt="" className="catalog-detail-cover"/></div>}
  <div className="meets-detail-body">
   <div className="meets-detail-headline"><span className="meets-detail-tag">{cardCategory(event)}</span><h1>{event.title}</h1></div>
   {/* The same facts as on the map card, plus the full date. */}
   <div className="meets-detail-key-facts event-facts-page">
    <EventFacts event={event} today={rigaTodayIso()} clock={rigaClockMinutes()}/>
    <span className="event-facts-date">{cardDate({...event,time_from:null})}{time!=='Nav norādīts'?' · '+time:''}</span>
    <EventVenueFavorite event={event} compact/>
   </div>
   <OnlineJoin event={event}/>
   {description&&<section className="meets-detail-description"><h2>Par pasākumu</h2><p>{description}</p></section>}
   {!ended&&<EventTournaments eventId={event.id}/>}
   {event.organizer_name&&event.organization_id&&<p className="meets-detail-organizer">Organizē <Link href={'/organizatori/'+encodeURIComponent(event.organization_id)}>{event.organizer_name}</Link></p>}
   {!ended&&<div className="meets-detail-follow"><EventQuickActions event={event} listOnly/></div>}
   <div className="meets-detail-primary-actions">
    {!ended&&event.latitude!=null&&event.longitude!=null&&<Link className="button primary" href={'/karte?event='+encodeURIComponent(event.id)}>Atvērt kartē →</Link>}
    {official&&<a className="button" href={official} target="_blank" rel="noopener noreferrer">Rīkotāja saite ↗</a>}
   </div>
   {!ended&&<div className="meets-detail-quick"><h2>Ātrās darbības</h2><EventQuickActions event={event}/></div>}
   {related.length>0&&<section className="meets-detail-related" aria-labelledby="related-title">
    <h2 id="related-title">{ended?'Gaidāmie pasākumi':'Citi pasākumi tajā pašā dienā'}{townSlug?' '+municipalityLocative(event.municipality):''}</h2>
    <EventLinkList events={related}/>
    {townSlug&&<p><Link href={'/pasakumi/'+townSlug}>Visi pasākumi {municipalityLocative(event.municipality)} →</Link></p>}
   </section>}
   {/* Imported events without an organizer: the organizer can take them over. */}
   {!ended&&!event.organization_id&&<aside className="meets-claim-callout" aria-labelledby="claim-callout-title">
    <h2 id="claim-callout-title">Vai tu rīko šo pasākumu?</h2>
    <p>Pievieno attēlu, aprakstu un cenu — pasākums tiks rādīts ar tavu rīkotāja vārdu.</p>
    <Link className="button" href={'/organizators/pieteikt?event='+encodeURIComponent(event.id)}>Tas ir mans pasākums</Link>
   </aside>}
  </div>
 </article>;
}

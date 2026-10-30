import Link from 'next/link';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../lib/events-server.js';
import {cardCategory,cardDate,cardDescription,cardGroup,cardImage,cardLocation} from '../../../lib/discovery-card.js';
import {timeLabel} from '../../../lib/catalog.js';
import {officialEventUrl} from '../../../lib/event-sharing.js';
import EventQuickActions from '../../components/event-quick-actions.jsx';
import EventVenueFavorite from '../../components/event-venue-favorite.jsx';
import EventFacts from '../../components/event-facts.jsx';
import {rigaClockMinutes,rigaTodayIso} from '../../../lib/event-date.js';

export const dynamic='force-dynamic';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// generateMetadata and the page share one catalogue read per request.
const findEvent=cache(async id=>{
 if(!UUID.test(String(id||'')))return null;
 const {events}=await readEventsCached();
 return events.find(event=>String(event.id)===String(id))||null;
});

function summary(event,max=200){
 const text=cardDescription(event);
 return text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
}

function addressLine(event){
 return [event.address_raw,event.settlement,event.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
}

function structuredData(event){
 const image=cardImage(event);
 const startDate=event.date_from+(event.time_from?'T'+String(event.time_from).slice(0,5):'');
 const endDate=(event.date_to||event.date_from)+(event.time_to?'T'+String(event.time_to).slice(0,5):'');
 const data={
  '@context':'https://schema.org',
  '@type':'Event',
  name:event.title,
  startDate,
  endDate,
  eventStatus:'https://schema.org/EventScheduled',
  eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',
  location:{
   '@type':'Place',
   name:cardLocation(event),
   address:addressLine(event)||undefined,
   ...(event.latitude!=null&&event.longitude!=null?{geo:{'@type':'GeoCoordinates',latitude:Number(event.latitude),longitude:Number(event.longitude)}}:{})
  },
  ...(summary(event,500)?{description:summary(event,500)}:{}),
  ...(image.startsWith('https://')?{image:[image]}:{}),
  ...(event.price_status==='free'?{isAccessibleForFree:true}:{})
 };
 // Escape "<" so event text can never close the script element.
 return JSON.stringify(data).replace(/</g,'\\u003c');
}

export async function generateMetadata({params}){
 const {id}=await params;
 const event=await findEvent(id).catch(()=>null);
 if(!event)return {title:'Pasākums nav atrasts'};
 const description=summary(event,160)||cardDate(event)+' · '+cardLocation(event);
 const image=cardImage(event);
 return {
  title:event.title,
  description,
  alternates:{canonical:'/pasakumi/'+event.id},
  openGraph:{
   type:'website',
   title:event.title,
   description:cardDate(event)+' · '+cardLocation(event),
   url:'/pasakumi/'+event.id,
   ...(image.startsWith('https://')?{images:[{url:image}]}:{})
  }
 };
}

export default async function EventPage({params}){
 const {id}=await params;
 const event=await findEvent(id);
 if(!event)notFound();
 const image=cardImage(event),description=cardDescription(event),official=officialEventUrl(event);
 const time=timeLabel(event);
 return <article className="meets-event-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredData(event)}}/>
  <nav className="meets-event-page-back" aria-label="Atpakaļ"><Link href="/pasakumi">← Visi pasākumi</Link></nav>
  <div className="meets-detail-hero">
   {image?<img src={image} alt="" className="catalog-detail-cover"/>:
    <div className={'meets-detail-image-fallback theme-'+cardGroup(event)} aria-hidden="true">✦</div>}
  </div>
  <div className="meets-detail-body">
   <div className="meets-detail-headline"><span className="meets-detail-tag">{cardCategory(event)}</span><h1>{event.title}</h1></div>
   {/* The same facts as on the map card, plus the full date. */}
   <div className="meets-detail-key-facts event-facts-page">
    <EventFacts event={event} today={rigaTodayIso()} clock={rigaClockMinutes()}/>
    <span className="event-facts-date">{cardDate({...event,time_from:null})}{time!=='Nav norādīts'?' · '+time:''}</span>
    <EventVenueFavorite event={event} compact/>
   </div>
   {description&&<section className="meets-detail-description"><h2>Par pasākumu</h2><p>{description}</p></section>}
   <div className="meets-detail-follow"><EventQuickActions event={event} listOnly/></div>
   <div className="meets-detail-primary-actions">
    {event.latitude!=null&&event.longitude!=null&&<Link className="button primary" href={'/karte?event='+encodeURIComponent(event.id)}>Atvērt kartē →</Link>}
    {official&&<a className="button" href={official} target="_blank" rel="noopener noreferrer">Organizatora saite ↗</a>}
   </div>
   <div className="meets-detail-quick"><h2>Ātrās darbības</h2><EventQuickActions event={event}/></div>
  </div>
 </article>;
}

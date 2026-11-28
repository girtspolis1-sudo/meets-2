import Link from 'next/link';
import TrackView from '../../components/track-view.jsx';
import {notFound,permanentRedirect} from 'next/navigation';
import {cache} from 'react';
import {findPublicEvent,readEventsCached} from '../../../lib/events-server.js';
import {cardDate,cardDescription,cardImage,cardLocation} from '../../../lib/discovery-card.js';
import {officialEventUrl} from '../../../lib/event-sharing.js';
import EventQuickActions from '../../components/event-quick-actions.jsx';
import EventVenueFavorite from '../../components/event-venue-favorite.jsx';
import EventCardMedia from '../../components/event-card-media.jsx';
import EventFacts from '../../components/event-facts.jsx';
import OnlineJoin from '../../components/online-join.jsx';
import EventLinkList from '../../components/event-link-list.jsx';
import {addIsoDays,rigaClockMinutes,rigaTodayIso} from '../../../lib/event-date.js';
import EventTournaments from '../../components/event-tournaments.jsx';
import Icon from '../../components/line-icon.jsx';
import {isYouthSport,sportLine} from '../../../lib/sport-line.js';
import {eventDescription,eventJsonLd,eventTitle,fullDateLine,jsonLdScript} from '../../../lib/event-seo.js';
import {eventPath,municipalityLocative,municipalitySlug,pageRobots,parseEventParam,slugify} from '../../../lib/seo.js';
import {eventGroup} from '../../../lib/home-category-filters.js';
import {eventMoreLinks,listingPath,municipalityBySlug,overlaps,teamGames} from '../../../lib/event-listings.js';
import {breadcrumbJsonLd,eventCrumbs} from '../../../lib/breadcrumbs.js';
import {pageMeta} from '../../../lib/page-meta.js';
import ListingPage,{buildListing,listingMetadata} from '../listing-page.jsx';

// Rendered on first visit, then served from the CDN and rebuilt in the background every
// five minutes. The catalogue read is not put into the data cache (it is over its 2 MB limit).
export const dynamic='force-static';
export const revalidate=300;
export async function generateStaticParams(){return [];}

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
  robots:pageRobots(!ended||indexableEnded(event)),
  ...pageMeta(canonical,{title:event.title,description:cardDate(event)+' · '+cardLocation(event),
   images:[image.startsWith('https://')?{url:image}:{url:'/og/'+event.id,width:1200,height:630}]})
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
 const related=await relatedEvents(event,ended);
 const {events:all}=await readEventsCached();
 const today=rigaTodayIso();
 const more=eventMoreLinks(event,all,today);
 const games=ended?[]:teamGames(event,all,today);
 const townSlug=municipalitySlug(event.municipality);
 // A match: the teams face to face, the league line and its games page. The league
 // page is linked even when it is too thin to be indexed (it stays noindex then).
 const game=event.event_type==='sports_match'&&event.home_team&&event.away_team;
 const league=sportLine(event);
 const leaguePath=event.competition_name&&all.some(e=>e.competition_name===event.competition_name)?listingPath({league:slugify(event.competition_name,70)}):'';
 const moreLinks=game&&leaguePath?more.filter(l=>l.path!==leaguePath):more;
 return <article className="meets-event-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(eventJsonLd(event,{image,officialUrl:official}))}}/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(breadcrumbJsonLd(eventCrumbs(event)))}}/>
  <TrackView name="event_view" params={{item_id:event.id,item_category:event.primary_category,municipality:event.municipality}}/>
  <nav className="meets-event-page-back" aria-label="Atpakaļ"><Link href="/pasakumi">← Visi pasākumi</Link>
   {townSlug&&<> · <Link href={'/pasakumi/'+townSlug}>Pasākumi {municipalityLocative(event.municipality)}</Link></>}</nav>
  {ended&&<p className="meets-event-ended" role="status"><strong>Pasākums ir beidzies.</strong> Zemāk ir citi pasākumi {townSlug?municipalityLocative(event.municipality):'tuvumā'}.</p>}
  {/* The same picture top as the cards: the event's image or its theme picture,
      with the theme, the heart, the date chip and the title. */}
  <EventCardMedia event={event} today={today} title={event.title} heading="h1" className="ec-page-media" fullDate={fullDateLine(event,today)} sport={!game}/>
  <div className="meets-detail-body">
   {/* The same facts as on the map card; the date chip and the full date are in the picture band. */}
   <div className="meets-detail-key-facts event-facts-page">
    <EventFacts event={event} today={today} clock={rigaClockMinutes()} hideWhen/>
    <EventVenueFavorite event={event} compact fullLabel/>
   </div>
   {game&&<section className="meets-detail-game" aria-labelledby="game-title">
    <h2 id="game-title">Spēle</h2>
    <div className="game-teams">
     <p className="game-team"><small>Mājinieki</small><strong>{event.home_team}</strong></p>
     <span className="game-vs" aria-hidden="true">pret</span>
     <p className="game-team away"><small>Viesi</small><strong>{event.away_team}</strong></p>
    </div>
    {league&&<p className="game-league"><Icon name="trophy" size={16}/><span>{league}</span>{isYouthSport(event)&&<span className="sport-youth">Jaunieši</span>}</p>}
    {leaguePath&&<Link className="game-league-link" href={leaguePath}>Visas sacensību spēles →</Link>}
   </section>}
   <OnlineJoin event={event}/>
   {description&&<section className="meets-detail-description"><h2>Par pasākumu</h2><p>{description}</p></section>}
   {!ended&&<EventTournaments eventId={event.id}/>}
   {event.organizer_name&&event.organization_id&&<p className="meets-detail-organizer">Organizē <Link href={'/organizatori/'+encodeURIComponent(event.organization_id)}>{event.organizer_name}</Link></p>}
   {/* One row of actions: the map and the organizer's page, then calendar, directions
       and sharing. Saving is the heart in the picture band. */}
   <div className="meets-detail-primary-actions">
    {!ended&&event.latitude!=null&&event.longitude!=null&&<Link className="button primary" href={'/karte?event='+encodeURIComponent(event.id)}>Atvērt kartē →</Link>}
    {official&&<a className="button" href={official} target="_blank" rel="noopener noreferrer">Rīkotāja lapa ↗</a>}
   </div>
   {!ended&&<div className="meets-detail-quick"><EventQuickActions event={event} noFavorite noOfficial/></div>}
   {/* A match: the teams' other games come before the rest of the day. */}
   {games.length>0&&<section className="meets-detail-related" aria-labelledby="team-games-title">
    <h2 id="team-games-title">Citas {[event.home_team,event.away_team].filter(Boolean).join(' un ')} spēles</h2>
    <EventLinkList events={games}/>
   </section>}
   {related.length>0&&<section className="meets-detail-related" aria-labelledby="related-title">
    <h2 id="related-title">{ended?'Gaidāmie pasākumi':'Citi pasākumi tajā pašā dienā'}{townSlug?' '+municipalityLocative(event.municipality):''}</h2>
    <EventLinkList events={related}/>
    {townSlug&&<p><Link href={'/pasakumi/'+townSlug}>Visi pasākumi {municipalityLocative(event.municipality)} →</Link></p>}
   </section>}
   {moreLinks.length>0&&<nav className="meets-event-more-links" aria-label="Vairāk pasākumu">
    <ul>{moreLinks.map(l=><li key={l.path}><Link href={l.path}>{l.label} →</Link></li>)}</ul>
   </nav>}
   {/* Imported events without an organizer: the organizer can take them over. */}
   {!ended&&!event.organization_id&&<aside className="meets-claim-callout" aria-labelledby="claim-callout-title">
    <h2 id="claim-callout-title">Vai tu rīko šo pasākumu?</h2>
    <p>Pievieno attēlu, aprakstu un cenu — pasākums tiks rādīts ar tavu rīkotāja vārdu.</p>
    <Link className="button" href={'/organizators/pieteikt?event='+encodeURIComponent(event.id)}>Tas ir mans pasākums</Link>
   </aside>}
  </div>
 </article>;
}

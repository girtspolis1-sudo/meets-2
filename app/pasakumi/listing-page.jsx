import Link from 'next/link';
import EventLinkList from '../components/event-link-list.jsx';
import {byDay,listing,listingHeading,listingPath,listingTail,municipalities,topLeagues} from '../../lib/event-listings.js';
import {breadcrumbJsonLd,listingCrumbs} from '../../lib/breadcrumbs.js';
import {pageMeta} from '../../lib/page-meta.js';
import {jsonLdScript,sentenceDate} from '../../lib/event-seo.js';
import {SITE_URL,TIME_SLUGS,eventPath,municipalityLocative,pageRobots} from '../../lib/seo.js';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../../lib/home-category-filters.js';
import {rigaTodayIso} from '../../lib/event-date.js';
import {sportLevel} from '../../lib/sport-level.js';
import SportLevelLinks from './sports/level-links.jsx';

const MAX_SHOWN=200;
const weekdayName=iso=>['svētdiena','pirmdiena','otrdiena','trešdiena','ceturtdiena','piektdiena','sestdiena'][new Date(iso+'T12:00:00Z').getUTCDay()];

function countWords(n){
 const last=n%10,teen=n%100>=11&&n%100<=19;
 return n+' '+(last===1&&!teen?'pasākums':'pasākumi');
}

// The words and data of one listing page; used by generateMetadata and the page.
export function buildListing(events,{municipality=null,category='',time='',league=null}){
 const today=rigaTodayIso();
 const result=listing(events,{municipality:municipality?.name||'',category,time,league:league?.slug||''},today);
 const heading=listingHeading({municipalityName:municipality?.name||'',category,time,leagueName:league?.name||''});
 const path=listingPath({municipalitySlug:municipality?.slug||'',category,time,league:league?.slug||''});
 const count=result.events.length;
 const lead=count
  ?(time?`${TIME_SLUGS[time][0].toUpperCase()+TIME_SLUGS[time].slice(1)} `:'Tuvākajos trīs mēnešos ')+
   (municipality?municipalityLocative(municipality.name)+' ':'')+'ir '+countWords(count)+'.'
  :'Šobrīd šeit nav neviena pasākuma.';
 const description=count
  ?`${heading}: ${countWords(count)} ar datumiem, laikiem un vietu kartē. ${listingTail({category,league:league?.slug||''})}`
  :`${heading}. Šobrīd nav pasākumu — skati citus novadus un kategorijas meets.lv.`;
 return {...result,heading,path,lead,description,today};
}

export function listingMetadata(data){
 return {
  title:data.heading,
  description:data.description.slice(0,160),
  robots:pageRobots(data.indexable),
  ...pageMeta(data.path,{title:data.heading,description:data.description.slice(0,200)})
 };
}

function itemList(data){
 return {'@context':'https://schema.org','@type':'ItemList',name:data.heading,url:SITE_URL+data.path,numberOfItems:data.events.length,
  itemListElement:data.events.slice(0,50).map((e,i)=>({'@type':'ListItem',position:i+1,url:SITE_URL+eventPath(e),name:e.title}))};
}

// A listing page: heading, count, events by day, links to related listings.
export default function ListingPage({data,allEvents,municipality=null,category='',time='',league=null}){
 const towns=municipalities(allEvents);
 const nearbyTowns=towns.filter(m=>m.slug!==municipality?.slug).slice(0,12);
 const shown=data.events.slice(0,MAX_SHOWN);
 const crumbs=listingCrumbs({municipality,category,time,league,heading:data.heading,path:data.path});
 const leagueLinks=category==='sport'&&!league?topLeagues(allEvents,data.today,40):[];
 return <section className="section catalog listing-page">
  {data.events.length>0&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(itemList(data))}}/>}
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(breadcrumbJsonLd(crumbs))}}/>
  <nav className="listing-crumbs" aria-label="Ceļš">{crumbs.slice(1,-1).map((c,i)=><span key={c.path}>{i>0&&' / '}<Link href={c.path}>{c.name}</Link></span>)}</nav>
  <h1>{data.heading}</h1>
  <p className="lead">{data.lead}</p>
  {/* Sports lists: adults and youth are separate pages, linked here. */}
  {category==='sport'&&!municipality&&<SportLevelLinks current={league&&data.events.some(e=>sportLevel(e)==='youth')?'youth':'senior'}/>}
  {municipality&&<nav className="listing-chips" aria-label="Laiks">
   <Link href={listingPath({municipalitySlug:municipality.slug})} aria-current={!time&&!category?'page':undefined}>Visi</Link>
   {Object.entries(TIME_SLUGS).map(([slug,word])=><Link key={slug} href={listingPath({municipalitySlug:municipality.slug,time:slug})} aria-current={time===slug?'page':undefined}>{word[0].toUpperCase()+word.slice(1)}</Link>)}
  </nav>}
  {byDay(shown,data.window?.from||data.today).map(group=><section key={group.date} className="listing-day">
   <h2>{group.date===data.today?'Šodien':weekdayName(group.date)[0].toUpperCase()+weekdayName(group.date).slice(1)}, {sentenceDate(group.date)}</h2>
   <EventLinkList events={group.events}/>
  </section>)}
  {data.events.length>MAX_SHOWN&&<p className="listing-more">Rādīti pirmie {MAX_SHOWN}. Visus vari filtrēt <Link href="/pasakumi">pasākumu sarakstā</Link> vai <Link href="/karte">kartē</Link>.</p>}
  <div className="listing-actions"><Link className="button primary" href="/karte">Atvērt karti →</Link></div>
  <nav className="listing-related" aria-labelledby="listing-related-title">
   <h2 id="listing-related-title">Skati arī</h2>
   <div>
    <h3>Pēc intereses{municipality?' '+municipalityLocative(municipality.name):''}</h3>
    <ul>{HOME_GROUP_KEYS.filter(k=>k!==category).map(k=><li key={k}><Link href={listingPath({category:k,municipalitySlug:municipality?.slug||''})}>{HOME_CATEGORY_FILTERS[k].title}</Link></li>)}</ul>
   </div>
   {leagueLinks.length>0&&<div>
    <h3>Līgas</h3>
    <ul>{leagueLinks.map(l=><li key={l.slug}><Link href={l.path}>{l.name}</Link></li>)}</ul>
   </div>}
   <div>
    <h3>Citos novados</h3>
    <ul>{nearbyTowns.map(m=><li key={m.slug}><Link href={listingPath({municipalitySlug:m.slug,category:category||''})}>{m.name}</Link></li>)}</ul>
   </div>
  </nav>
 </section>;
}

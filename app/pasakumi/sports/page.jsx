import Link from 'next/link';
import EventLinkList from '../../components/event-link-list.jsx';
import Icon from '../../components/line-icon.jsx';
import SportLevelLinks from './level-links.jsx';
import LeagueList from './league-list.jsx';
import {readEventsCached} from '../../../lib/events-server.js';
import {rigaTodayIso} from '../../../lib/event-date.js';
import {sportGames,sportLeagues,sportsOf} from '../../../lib/sports-pages.js';
import {SPORT_TYPES} from '../../../lib/home-category-filters.js';
import {MIN_INDEXABLE_EVENTS,pageRobots} from '../../../lib/seo.js';
import {YOUTH_SPORTS_PATH} from '../../../lib/nav-sections.js';
import {breadcrumbJsonLd} from '../../../lib/breadcrumbs.js';
import {jsonLdScript} from '../../../lib/event-seo.js';
import {pageMeta} from '../../../lib/page-meta.js';
import './sports.css';

// Rendered on first visit, then served from the CDN and rebuilt every five minutes.
export const dynamic='force-static';
export const revalidate=300;

const SHOWN=40;
const TITLE='Sports Latvijā';
const DESCRIPTION='Basketbola, hokeja, futbola, volejbola, handbola un florbola spēles Latvijā: līgas, tuvākās spēles, laiki un vietas.';

// The catalogue may be out of reach while the site is built (preview builds): the page
// is then built empty, as the home page is, and filled at the next revalidation.
async function data(){
 try{return await read();}
 catch{return {today:rigaTodayIso(),games:[],leagues:[],sports:[]};}
}
async function read(){
 const {events}=await readEventsCached();
 const today=rigaTodayIso();
 const games=sportGames(events,today);
 return {today,games,leagues:sportLeagues(events,today),sports:sportsOf(games)};
}

export async function generateMetadata(){
 const {games}=await data().catch(()=>({games:[]}));
 return {title:TITLE,description:DESCRIPTION,robots:pageRobots(games.length>=MIN_INDEXABLE_EVENTS),
  ...pageMeta('/pasakumi/sports',{title:TITLE,description:DESCRIPTION})};
}

// /pasakumi/sports — adult leagues and the coming games. Youth sport has its own page.
export default async function SportsPage(){
 const {today,games,leagues,sports}=await data();
 const crumbs=[{name:'Sākums',path:'/'},{name:'Pasākumi',path:'/pasakumi'},{name:TITLE,path:'/pasakumi/sports'}];
 const typeOf=label=>SPORT_TYPES.find(t=>t.label===label);
 return <section className="section catalog listing-page sports-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(breadcrumbJsonLd(crumbs))}}/>
  <nav className="listing-crumbs" aria-label="Ceļš"><Link href="/pasakumi">Pasākumi</Link></nav>
  <h1>{TITLE}</h1>
  <p className="lead">{games.length?'Pieaugušo līgas un tuvākās spēles: '+games.length+' '+(games.length%10===1&&games.length%100!==11?'spēle':'spēles')+' tuvākajos mēnešos.':'Šobrīd nav nevienas spēles.'}</p>
  <SportLevelLinks current="senior" page/>
  {sports.length>0&&<nav className="sport-type-chips" aria-label="Sporta veids">{sports.map(s=>{
   const type=typeOf(s.label);
   return <Link key={s.label} href={'/pasakumi?category=sport'+(type?'&types='+type.value:'')}>{type&&<Icon name={type.icon} size={16}/>}{s.label} <small>{s.count}</small></Link>;
  })}</nav>}
  {leagues.length>0&&<section className="sport-section" aria-labelledby="sport-leagues-title">
   <h2 id="sport-leagues-title">Līgas</h2>
   <LeagueList leagues={leagues} today={today}/>
  </section>}
  {games.length>0&&<section className="sport-section" aria-labelledby="sport-games-title">
   <h2 id="sport-games-title">Tuvākās spēles</h2>
   <EventLinkList events={games.slice(0,SHOWN)}/>
   {games.length>SHOWN&&<p className="listing-more">Rādītas tuvākās {SHOWN}. Visas spēles vari filtrēt <Link href="/pasakumi?category=sport">pasākumu sarakstā</Link> vai <Link href="/karte?category=sport">kartē</Link>.</p>}
  </section>}
  <aside className="sport-youth-link">
   <h2>Jauniešu sports</h2>
   <p>Jaunatnes līgas un čempionāti: spēļu laiki un vietas, bez rezultātiem.</p>
   <Link className="button" href={YOUTH_SPORTS_PATH}>Jauniešu sports →</Link>
  </aside>
 </section>;
}

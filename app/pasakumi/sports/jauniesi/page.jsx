import Link from 'next/link';
import EventLinkList from '../../../components/event-link-list.jsx';
import SportLevelLinks from '../level-links.jsx';
import LeagueList from '../league-list.jsx';
import YouthFilter from './youth-filter.jsx';
import {readEventsCached} from '../../../../lib/events-server.js';
import {rigaTodayIso} from '../../../../lib/event-date.js';
import {YOUTH_DAYS,agesOf,gameAge,sportGames,sportsOf,youthLeagues} from '../../../../lib/sports-pages.js';
import {sportIcon} from '../../../../lib/event-map-icons.js';
import {MIN_INDEXABLE_EVENTS,pageRobots} from '../../../../lib/seo.js';
import {SPORTS_PATH,YOUTH_SPORTS_PATH} from '../../../../lib/nav-sections.js';
import {breadcrumbJsonLd} from '../../../../lib/breadcrumbs.js';
import {jsonLdScript} from '../../../../lib/event-seo.js';
import {pageMeta} from '../../../../lib/page-meta.js';
import '../sports.css';

// Rendered on first visit, then served from the CDN and rebuilt every five minutes.
export const dynamic='force-static';
export const revalidate=300;

const SHOWN=150;
const TITLE='Jauniešu sports';
const DESCRIPTION='Jaunatnes līgas un čempionāti Latvijā: LJBL, hokeja, futbola, volejbola un handbola spēles nākamajās divās nedēļās, laiki un vietas.';

// The catalogue may be out of reach while the site is built (preview builds): the page
// is then built empty, as the home page is, and filled at the next revalidation.
async function data(){
 try{return await read();}
 catch{return {today:rigaTodayIso(),games:[],leagues:[],sports:[],ages:[]};}
}
async function read(){
 const {events}=await readEventsCached();
 const today=rigaTodayIso();
 const games=sportGames(events,today,{level:'youth',days:YOUTH_DAYS});
 return {today,games,leagues:youthLeagues(events,today),sports:sportsOf(games),ages:agesOf(games)};
}

export async function generateMetadata(){
 const {games}=await data().catch(()=>({games:[]}));
 return {title:TITLE,description:DESCRIPTION,robots:pageRobots(games.length>=MIN_INDEXABLE_EVENTS),
  ...pageMeta(YOUTH_SPORTS_PATH,{title:TITLE,description:DESCRIPTION})};
}

// /pasakumi/sports/jauniesi — chosen on purpose, so youth games are shown here.
// Times and places only: no results and no personal data.
export default async function YouthSportsPage(){
 const {today,games,leagues,sports,ages}=await data();
 const crumbs=[{name:'Sākums',path:'/'},{name:'Pasākumi',path:'/pasakumi'},{name:'Sports Latvijā',path:SPORTS_PATH},{name:TITLE,path:YOUTH_SPORTS_PATH}];
 const shown=games.slice(0,SHOWN);
 return <section className="section catalog listing-page sports-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(breadcrumbJsonLd(crumbs))}}/>
  <nav className="listing-crumbs" aria-label="Ceļš"><Link href="/pasakumi">Pasākumi</Link> / <Link href={SPORTS_PATH}>Sports Latvijā</Link></nav>
  <h1>{TITLE}</h1>
  <p className="lead">{games.length?'Jaunatnes līgas un čempionāti: '+games.length+' '+(games.length%10===1&&games.length%100!==11?'spēle':'spēles')+' nākamajās divās nedēļās. Rādām laikus un vietas, bez rezultātiem.':'Nākamajās divās nedēļās jauniešu spēļu nav.'}</p>
  <SportLevelLinks current="youth" page/>
  {leagues.length>0&&<section className="sport-section" aria-labelledby="youth-leagues-title">
   <h2 id="youth-leagues-title">Līgas un čempionāti</h2>
   <LeagueList leagues={leagues} today={today} label="Jauniešu līgas un čempionāti"/>
  </section>}
  {shown.length>0&&<section className="sport-section" aria-labelledby="youth-games-title">
   <h2 id="youth-games-title">Tuvākās spēles</h2>
   <YouthFilter sports={sports} ages={ages} total={games.length}/>
   <EventLinkList events={shown} className="youth-games" rowProps={e=>({'data-sport':sportIcon(e)?.label||'','data-age':gameAge(e)})}/>
   {games.length>SHOWN&&<p className="listing-more">Rādītas tuvākās {SHOWN}. Pārējās atradīsi līgu lapās augstāk.</p>}
  </section>}
 </section>;
}

import Link from 'next/link';
import HomeFeatured from './home-featured.jsx';
import CategoryIcon from './components/category-icon.jsx';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../lib/home-category-filters.js';
import {nearestEvents} from '../lib/home-server.js';
import {listingPath} from '../lib/event-listings.js';
import {SITE_URL,municipalityShortName} from '../lib/seo.js';
import {countLabel} from '../lib/map-nearby.js';
import {jsonLdScript} from '../lib/event-seo.js';
import {CONTROLLER} from '../lib/legal.js';
import {pageMeta} from '../lib/page-meta.js';

// Served from the CDN and rebuilt every five minutes.
export const dynamic='force-static';
export const revalidate=300;

const HOME_DESCRIPTION='Kas notiek tev blakus: šodien un brīvdienās. Koncerti, izrādes, izstādes un sporta spēles visā Latvijā.';
export const metadata={
 title:{absolute:'Pasākumi Latvijā šodien un brīvdienās — meets.lv'},
 description:HOME_DESCRIPTION,
 ...pageMeta('/',{title:'Pasākumi Latvijā šodien un brīvdienās',description:HOME_DESCRIPTION})
};

function siteJsonLd(){
 return [
  {'@context':'https://schema.org','@type':'Organization',name:'meets.lv',url:SITE_URL,logo:SITE_URL+'/meets-logo-512.png',email:CONTROLLER.email},
  {'@context':'https://schema.org','@type':'WebSite',name:'meets.lv',url:SITE_URL,inLanguage:'lv'}
 ];
}

const GROUPS=HOME_GROUP_KEYS.map(key=>({key,...HOME_CATEGORY_FILTERS[key]}));

// From the top: the hero (the only theme row), the "Kur un kad" bar, the coming
// days with saved and followed beside them, this week's games (HomeFeatured,
// client), the weekend towns, and the server-rendered links for search engines.
export default async function Home(){
 const {picks,games,sports,weekend,towns,leagues}=await nearestEvents(12);
 return <div className="meets-discovery-home">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(siteJsonLd())}}/>
  <section className="meets-discovery-hero" aria-labelledby="meets-welcome-title">
   <div className="meets-hero-message">
    <h1 id="meets-welcome-title">Pasākumi tev blakus.<br/><em>Visā Latvijā.</em></h1>
    <p>Kas notiek tev blakus: šodien un brīvdienās.</p>
    <div className="meets-hero-ctas"><Link className="meets-hero-cta-primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link><Link className="meets-hero-cta-secondary" href="/pasakumi">Skatīt pasākumus <span aria-hidden="true">→</span></Link></div>
    <div className="meets-hero-chips" aria-label="Tēmas">
     <Link href="/karte" className="active">Visi</Link>
     {GROUPS.map(group=><Link key={group.key} href={'/karte?category='+group.key}>
      <CategoryIcon name={group.key}/>{group.title}</Link>)}
    </div>
   </div>
  </section>
  <HomeFeatured initialPicks={picks} initialGames={games} initialSports={sports}/>
  {weekend.length>0&&<section className="meets-home-weekend" aria-labelledby="home-weekend-title">
   <header className="meets-home-section-header"><div><p className="eyebrow">Ceļojumam</p><h2 id="home-weekend-title">Brīvdienās Latvijā</h2></div>
    <Link href="/pasakumi?period=weekend">Visi brīvdienās <span aria-hidden="true">→</span></Link></header>
   <ul className="meets-home-towns">{weekend.map(t=><li key={t.slug}><Link href={t.path}><strong>{municipalityShortName(t.name)}</strong><small>{countLabel(t.count)}</small></Link></li>)}</ul>
  </section>}
  {towns.length>0&&<nav className="meets-home-browse" aria-labelledby="home-browse-title">
   <h2 id="home-browse-title">Pasākumi pa novadiem un interesēm</h2>
   <ul className="meets-home-browse-list">{towns.slice(0,16).map(t=><li key={t.slug}><Link href={listingPath({municipalitySlug:t.slug})}>{t.name}</Link></li>)}</ul>
   <ul className="meets-home-browse-list">{GROUPS.map(g=><li key={g.key}><Link href={listingPath({category:g.key})}>{g.title}</Link></li>)}</ul>
   {leagues.length>0&&<ul className="meets-home-browse-list" aria-label="Sporta līgas">{leagues.map(l=><li key={l.slug}><Link href={l.path}>{l.name}</Link></li>)}</ul>}
  </nav>}
 </div>;
}

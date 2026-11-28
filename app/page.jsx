import Link from 'next/link';
import HomeFeatured from './home-featured.jsx';
import CategoryIcon from './components/category-icon.jsx';
import Icon from './components/line-icon.jsx';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../lib/home-category-filters.js';
import DiscoveryEventCard from './components/discovery-event-card.jsx';
import {nearestEvents} from '../lib/home-server.js';
import {listingPath} from '../lib/event-listings.js';
import {SITE_URL} from '../lib/seo.js';
import {jsonLdScript} from '../lib/event-seo.js';
import {CONTROLLER} from '../lib/legal.js';
import {pageMeta} from '../lib/page-meta.js';

// Served from the CDN and rebuilt every five minutes.
export const dynamic='force-static';
export const revalidate=300;

const HOME_DESCRIPTION='Atrodi, kas notiek tev blakus šodien un brīvdienās: koncerti, izrādes, izstādes un sporta spēles visā Latvijā.';
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
const BENEFIT_ICON={nearby:'pin',categories:'grid',saved:'heart',follow:'bell'};
function BenefitIcon({name}){return <Icon name={BENEFIT_ICON[name]} size={22}/>;}
export default async function Home(){
 const {picks,towns,leagues}=await nearestEvents(12);
 return <div className="meets-discovery-home">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(siteJsonLd())}}/>
  <section className="meets-discovery-hero" aria-labelledby="meets-welcome-title">
   <div className="meets-hero-message">
    <span className="eyebrow">PASĀKUMI TUVUMĀ</span>
    <h1 id="meets-welcome-title">Pasākumi tev blakus.<br/><em>Visā Latvijā.</em></h1>
    <p>Atver karti un uzreiz redzi, kas notiek tuvumā: šovakar, rīt vai brīvdienās.</p>
    <div className="meets-hero-ctas"><Link className="meets-hero-cta-primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link><Link className="meets-hero-cta-secondary" href="/pasakumi">Skatīt pasākumus <span aria-hidden="true">→</span></Link></div>
    <div className="meets-hero-chips" aria-label="Populārākās kategorijas">
     <Link href="/karte" className="active">Visi</Link>
     {GROUPS.map(group=><Link key={group.key} href={'/karte?category='+group.key}>
      <CategoryIcon name={group.key}/>{group.title}</Link>)}
    </div>
   </div>
  </section>
  <nav className="meets-minimal-benefits" aria-label="meets.lv iespējas">
   <Link href="/karte"><span className="meets-minimal-benefit-icon"><BenefitIcon name="nearby"/></span><span><strong>Tuvākais vispirms</strong><small>Kas notiek tavā apkārtnē</small></span></Link>
   <Link href="/karte"><span className="meets-minimal-benefit-icon"><BenefitIcon name="categories"/></span><span><strong>Viss vienuviet</strong><small>Koncerti, sports, izstādes, tirdziņi</small></span></Link>
   <Link href="/mani-pasakumi"><span className="meets-minimal-benefit-icon"><BenefitIcon name="saved"/></span><span><strong>Saglabā iecienītos</strong><small>Atrodi tos vēlāk vienā vietā</small></span></Link>
   <Link href="/sekosana"><span className="meets-minimal-benefit-icon"><BenefitIcon name="follow"/></span><span><strong>Seko vietām un rīkotājiem</strong><small>Uzzini, kas tur notiek</small></span></Link>
  </nav>
  {/* The same cards the browser shows once the catalogue loads, so the page does not jump. */}
  <HomeFeatured fallback={picks.length?<div className="meets-discovery-grid">{picks.map(event=><DiscoveryEventCard key={event.id} event={event} actions/>)}</div>:null}/>
  <section className="meets-discovery-categories" aria-labelledby="all-categories-heading">
   <header className="meets-home-section-header"><div><p className="eyebrow">Izvēlies pēc intereses</p><h2 id="all-categories-heading">Visas kategorijas</h2></div><Link href="/karte">Skatīt kartē →</Link></header>
   <div className="meets-all-categories">{GROUPS.map(group=><Link href={'/karte?category='+group.key} key={group.key}><span className="meets-category-tile-icon"><CategoryIcon name={group.key} size={24}/></span><strong>{group.title}</strong><small>{group.subtitle}</small></Link>)}</div>
  </section>
  {towns.length>0&&<nav className="meets-home-browse" aria-labelledby="home-browse-title">
   <h2 id="home-browse-title">Pasākumi pa novadiem un interesēm</h2>
   <ul className="meets-home-browse-list">{towns.slice(0,16).map(t=><li key={t.slug}><Link href={listingPath({municipalitySlug:t.slug})}>{t.name}</Link></li>)}</ul>
   <ul className="meets-home-browse-list">{GROUPS.map(g=><li key={g.key}><Link href={listingPath({category:g.key})}>{g.title}</Link></li>)}</ul>
   {leagues.length>0&&<ul className="meets-home-browse-list" aria-label="Sporta līgas">{leagues.map(l=><li key={l.slug}><Link href={l.path}>{l.name}</Link></li>)}</ul>}
  </nav>}
 </div>;
}

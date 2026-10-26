import Link from 'next/link';
import HomeFeatured from './home-featured.jsx';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../lib/home-category-filters.js';

const GROUPS=HOME_GROUP_KEYS.map(key=>({key,...HOME_CATEGORY_FILTERS[key]}));
export default function Home(){
 return <div className="meets-discovery-home">
  <section className="meets-discovery-hero" aria-labelledby="meets-welcome-title">
   <div className="meets-hero-message">
    <span className="eyebrow">LATVIJAS PASĀKUMI VIENUVIET</span>
    <h1 id="meets-welcome-title">Atrodi pasākumus,<br/><em>kas iedvesmo.</em></h1>
    <p>Atrodi sev piemērotus pasākumus tuvumā un visā Latvijā — koncertus, kultūru, sportu un citus piedzīvojumus.</p>
    <div className="meets-hero-ctas"><Link className="meets-hero-cta-primary" href="/pasakumi">Skatīt pasākumus <span aria-hidden="true">→</span></Link><Link className="meets-hero-cta-secondary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link></div>
    <form action="/pasakumi" method="get" role="search" className="meets-hero-search">
     <label className="sr-only" htmlFor="meets-home-search">Meklēt pasākumu, vietu vai intereses</label>
     <span aria-hidden="true">⌕</span>
     <input id="meets-home-search" name="q" type="search" placeholder="Meklēt pasākumu vai vietu…" maxLength={100}/>
     <button type="submit" aria-label="Meklēt pasākumus">→</button>
    </form>
    <div className="meets-hero-chips" aria-label="Populārākās kategorijas">
     <Link href="/pasakumi" className="active">Visi</Link>
     {GROUPS.slice(0,6).map(group=><Link key={group.key} href={'/pasakumi?category='+group.key}>
      <span aria-hidden="true">{group.icon}</span>{group.title}</Link>)}
    </div>
   </div>
  </section>
  <nav className="meets-minimal-benefits" aria-label="MEETS iespējas">
   <Link href="/karte"><span className="meets-minimal-benefit-icon" aria-hidden="true">⌖</span><span><strong>Pasākumi tuvumā</strong><small>Atrodi notikumus savā apkārtnē</small></span></Link>
   <Link href="/pasakumi"><span className="meets-minimal-benefit-icon" aria-hidden="true">✧</span><span><strong>Dažādas kategorijas</strong><small>Izvēlies sev interesējošo</small></span></Link>
   <Link href="/mani-pasakumi"><span className="meets-minimal-benefit-icon" aria-hidden="true">♡</span><span><strong>Saglabā iecienītos</strong><small>Atgriezies pie saviem favorītiem</small></span></Link>
   <Link href="/sekosana"><span className="meets-minimal-benefit-icon" aria-hidden="true">♧</span><span><strong>Seko, kas interesē</strong><small>Organizatori un norises vietas</small></span></Link>
  </nav>
  <HomeFeatured/>
  <section className="meets-discovery-categories" aria-labelledby="all-categories-heading">
   <header className="meets-home-section-header"><div><p className="eyebrow">Atrodi pēc intereses</p><h2 id="all-categories-heading">Visas kategorijas</h2></div><Link href="/karte">Skatīt kartē →</Link></header>
   <div className="meets-all-categories">{GROUPS.map(group=><Link href={'/pasakumi?category='+group.key} key={group.key}><span aria-hidden="true">{group.icon}</span><strong>{group.title}</strong><small>{group.subtitle}</small></Link>)}</div>
  </section>
 </div>;
}

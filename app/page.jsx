import Link from 'next/link';
import HomeFeatured from './home-featured.jsx';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../lib/home-category-filters.js';

const GROUPS=HOME_GROUP_KEYS.map(key=>({key,...HOME_CATEGORY_FILTERS[key]}));
// Same stroke style as the mobile navigation icons.
function BenefitIcon({name}){
 const base={viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 if(name==='nearby')return <svg {...base}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>;
 if(name==='categories')return <svg {...base}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
 if(name==='saved')return <svg {...base}><path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg>;
 return <svg {...base}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>;
}
export default function Home(){
 return <div className="meets-discovery-home">
  <section className="meets-discovery-hero" aria-labelledby="meets-welcome-title">
   <div className="meets-hero-message">
    <span className="eyebrow">LATVIJAS PASĀKUMI VIENUVIET</span>
    <h1 id="meets-welcome-title">Atrodi pasākumus,<br/><em>kas iedvesmo.</em></h1>
    <p>Atrodi sev piemērotus pasākumus tuvumā un visā Latvijā — koncertus, kultūru, sportu un citus piedzīvojumus.</p>
    <div className="meets-hero-ctas"><Link className="meets-hero-cta-primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link><Link className="meets-hero-cta-secondary" href="/pasakumi">Skatīt pasākumus <span aria-hidden="true">→</span></Link></div>
    <div className="meets-hero-chips" aria-label="Populārākās kategorijas">
     <Link href="/karte" className="active">Visi</Link>
     {GROUPS.map(group=><Link key={group.key} href={'/karte?category='+group.key}>
      <span aria-hidden="true">{group.icon}</span>{group.title}</Link>)}
    </div>
   </div>
  </section>
  <nav className="meets-minimal-benefits" aria-label="MEETS iespējas">
   <Link href="/karte"><span className="meets-minimal-benefit-icon"><BenefitIcon name="nearby"/></span><span><strong>Pasākumi tuvumā</strong><small>Atrodi notikumus savā apkārtnē</small></span></Link>
   <Link href="/karte"><span className="meets-minimal-benefit-icon"><BenefitIcon name="categories"/></span><span><strong>Dažādas kategorijas</strong><small>Izvēlies sev interesējošo</small></span></Link>
   <Link href="/mani-pasakumi"><span className="meets-minimal-benefit-icon"><BenefitIcon name="saved"/></span><span><strong>Saglabā iecienītos</strong><small>Atgriezies pie saviem favorītiem</small></span></Link>
   <Link href="/sekosana"><span className="meets-minimal-benefit-icon"><BenefitIcon name="follow"/></span><span><strong>Seko, kas interesē</strong><small>Organizatori un norises vietas</small></span></Link>
  </nav>
  <HomeFeatured/>
  <section className="meets-discovery-categories" aria-labelledby="all-categories-heading">
   <header className="meets-home-section-header"><div><p className="eyebrow">Atrodi pēc intereses</p><h2 id="all-categories-heading">Visas kategorijas</h2></div><Link href="/karte">Skatīt kartē →</Link></header>
   <div className="meets-all-categories">{GROUPS.map(group=><Link href={'/karte?category='+group.key} key={group.key}><span aria-hidden="true">{group.icon}</span><strong>{group.title}</strong><small>{group.subtitle}</small></Link>)}</div>
  </section>
 </div>;
}

import Link from 'next/link';

import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../lib/home-category-filters.js';

const HOME_CATEGORIES=HOME_GROUP_KEYS.map(key=>({
 ...HOME_CATEGORY_FILTERS[key],key,href:'/karte?category='+key
}));

export default function Home(){
 return <>
  <section className="home-landing home-landing-rich">
   <div className="home-copy">
    <p className="eyebrow">Tavs nākamais piedzīvojums</p>
    <h1>Satiekamies<br/><em>kaut kur tepat.</em></h1>
    <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā.<br/>{' '}Vienuviet, tuvāk tev.</p>
    <div className="actions">
     <Link className="button primary" href="/karte?period=week">Atvērt karti <span aria-hidden="true">↗</span></Link>
     <Link className="button" href="/pasakumi">Pārlūkot pasākumus</Link>
    </div>

   </div>

   <div className="home-map-stage home-map-stage-concept">
    <Link className="home-concept-preview" href="/karte" aria-label="Atvērt pilno MEETS pasākumu karti">
     <img src="/images/meets-home-concept-2.webp" alt="Ilustratīva Latvijas pasākumu karte ar koncertiem, izstādēm, sportu, teātri, tirdziņiem un aktīvo atpūtu" width="320" height="282" decoding="async" fetchPriority="high"/>
    </Link>
    <p className="home-concept-note">Ilustratīvs ieskats pasākumos — <Link href="/karte">apskati aktuālos kartē ↗</Link></p>
   </div>
  </section>

  <section className="home-category-strip" aria-label="Populārākās pasākumu kategorijas">
   <div className="home-category-title">
    <h2>Atrodi sev<br/>tuvāko notikumu</h2>
    <i aria-hidden="true"/><Link className="button" href="/karte?period=week">Šonedēļ ↗</Link>
   </div>
   <div className="home-category-list">
    {HOME_CATEGORIES.map(item=><Link key={item.key} className={'home-category-pill '+item.key} href={item.href}>
     <span aria-hidden="true">{item.icon}</span>
     <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
    </Link>)}
   </div>
  </section>
 </>;
}

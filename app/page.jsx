import Link from 'next/link';
import HomeMapPreview from './home-map-preview.jsx';
import {readEvents} from '../lib/events-server.js';

import {HOME_CATEGORY_FILTERS} from '../lib/home-category-filters.js';

// Keep catalogue failures at build time from freezing an empty preview.
export const dynamic='force-dynamic';

const HOME_CATEGORIES=Object.entries(HOME_CATEGORY_FILTERS).map(([key,value])=>({
 ...value,key,href:'/karte?category='+key
}));

const CATEGORY_ICONS={
 music:'M9 18V5l11-2v13 M9 8l11-2 M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3 M20 16a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3',
 sport:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7l5 4-2 6H9l-2-6 5-4 M12 7V3 M17 11l4-1 M15 17l2 3 M9 17l-2 3 M7 11l-4-1',
 family:'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M2 21v-4a5 5 0 0 1 10 0v4 M20 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M14 21v-3a4 4 0 0 1 8 0v3',
 culture:'M3 9l9-6 9 6H3 M5 10v9 M10 10v9 M14 10v9 M19 10v9 M3 21h18'
};

export default async function Home(){
 let events=[];
 try{
  const data=await readEvents();
  events=data.events
   .filter(event=>event.country_code==='LV'&&Number.isFinite(Number(event.latitude))&&Number.isFinite(Number(event.longitude)))
   .map(event=>({
    id:event.id,
    date_from:event.date_from,
    date_to:event.date_to,
    latitude:event.latitude,
    longitude:event.longitude,
    country_code:event.country_code,
    sport_format:event.sport_format,
    governing_body:event.governing_body
   }));
 }catch(error){
  console.error(JSON.stringify({
   event:'home_map_catalog_failed',
   level:'warn',
   message:String(error?.message||'Home map catalogue failed').slice(0,200)
  }));
 }

 return <>
  <section className="home-landing home-landing-rich">
   <div className="home-copy">
    <p className="eyebrow">Tavs nākamais piedzīvojums</p>
    <h1>Satiekamies<br/><em>kaut kur tepat.</em></h1>
    <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā.<br/>{' '}Vienuviet, tuvāk tev.</p>
    <div className="actions">
     <Link className="button primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link>
     <Link className="button" href="/pasakumi">Pārlūkot pasākumus</Link>
    </div>

   </div>

   <div className="home-map-stage">
    <HomeMapPreview events={events}/>
    {HOME_CATEGORIES.map(item=><Link key={item.key} className={'home-float-card '+item.key} href={item.href}>
     <span className="home-card-thumb" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={CATEGORY_ICONS[item.key]}/></svg></span>
     <span><strong>{item.title}</strong><small>Atvērt kartē</small></span>
     <b aria-hidden="true">↗</b>
    </Link>)}
   </div>
  </section>

  <section className="home-category-strip" aria-label="Populārākās pasākumu kategorijas">
   <div className="home-category-title">
    <h2>Atrodi sev<br/>tuvāko notikumu</h2>
    <i aria-hidden="true"/>
   </div>
   <div className="home-category-list">
    {HOME_CATEGORIES.map(item=><Link key={item.key} className={'home-category-pill '+item.key} href={item.href}>
     <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={CATEGORY_ICONS[item.key]}/></svg></span>
     <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
    </Link>)}
   </div>
  </section>
 </>;
}

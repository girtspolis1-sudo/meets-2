import Link from 'next/link';
import HomeMapPreview from './home-map-preview.jsx';
import {readEvents} from '../lib/events-server.js';

const HOME_CATEGORIES=[
 {key:'music',icon:'♫',title:'Mūzika',subtitle:'Koncerti un festivāli',href:'/pasakumi?category=Mūzika'},
 {key:'sport',icon:'↗',title:'Sports',subtitle:'Sacensības, pārgājieni',href:'/pasakumi?category=Sports'},
 {key:'family',icon:'●●',title:'Ģimenēm',subtitle:'Bērniem un vecākiem',href:'/pasakumi?category=Ģimenēm'},
 {key:'culture',icon:'▥',title:'Kultūra',subtitle:'Izstādes, teātris',href:'/pasakumi?category=Kultūra'}
];

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
    <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā.<br/>Vienuviet, tuvāk tev.</p>
    <div className="actions">
     <Link className="button primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link>
     <Link className="button" href="/pasakumi">Pasākumu saraksts</Link>
    </div>
    <div className="home-scene" aria-hidden="true">
     <div className="home-sun"/>
     <div className="home-skyline"/>
     <div className="home-people">
      <span>●</span><span>●</span><span>●</span>
     </div>
    </div>
   </div>

   <div className="home-map-stage">
    <HomeMapPreview events={events}/>
    <Link className="home-float-card music" href={HOME_CATEGORIES[0].href}>
     <span className="home-card-thumb">♫</span>
     <span><strong>Mūzika</strong><small>Koncerti un festivāli</small></span><b>›</b>
    </Link>
    <Link className="home-float-card sport" href={HOME_CATEGORIES[1].href}>
     <span className="home-card-thumb">⚽</span>
     <span><strong>Sports</strong><small>Sacensības, pārgājieni</small></span><b>›</b>
    </Link>
    <Link className="home-float-card family" href={HOME_CATEGORIES[2].href}>
     <span className="home-card-thumb">👨‍👩‍👧</span>
     <span><strong>Ģimenēm</strong><small>Aktivitātes visai ģimenei</small></span><b>›</b>
    </Link>
    <Link className="home-float-card culture" href={HOME_CATEGORIES[3].href}>
     <span className="home-card-thumb">🏛</span>
     <span><strong>Kultūra</strong><small>Izstādes un notikumi</small></span><b>›</b>
    </Link>
   </div>
  </section>

  <section className="home-category-strip" aria-label="Populārākās pasākumu kategorijas">
   <div className="home-category-title">
    <h2>Atrodi sev<br/>tuvāko notikumu</h2>
    <i aria-hidden="true"/>
   </div>
   <div className="home-category-list">
    {HOME_CATEGORIES.map(item=><Link key={item.key} className={'home-category-pill '+item.key} href={item.href}>
     <span>{item.icon}</span>
     <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
    </Link>)}
   </div>
  </section>
 </>;
}

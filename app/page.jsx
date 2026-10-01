import Link from 'next/link';
import HomeMapPreview from './home-map-preview.jsx';
import {readEvents} from '../lib/events-server.js';

export default async function Home(){
 let events=[];
 try{
  const data=await readEvents();
  events=data.events;
 }catch(error){
  console.error(JSON.stringify({
   event:'home_map_catalog_failed',
   level:'warn',
   message:String(error?.message||'Home map catalogue failed').slice(0,200)
  }));
 }

 return <section className="home-landing">
  <div className="home-copy">
   <p className="eyebrow">Tavs nākamais piedzīvojums</p>
   <h1>Satiekamies<br/><em>kaut kur tepat.</em></h1>
   <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā. Vienuviet, tuvāk tev.</p>
   <div className="actions">
    <Link className="button primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link>
    <Link className="button" href="/pasakumi">Pasākumu saraksts</Link>
   </div>
  </div>
  <HomeMapPreview events={events}/>
 </section>;
}

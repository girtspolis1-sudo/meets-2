import Link from 'next/link';
import {readEvents} from '../../../lib/events-server.js';
import {navigationLinks} from '../../../lib/meets-personal.js';

export const dynamic='force-dynamic';
export const metadata={title:'Kopīgotie pasākumi · MEETS'};

export default async function SharedEventsPage({params}){
 const {token}=await params;
 const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token||'');
 let events=[];
 if(valid&&process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY){
  try{
   const [idsResponse,catalog]=await Promise.all([
    fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_shared_event_ids',{
     method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
     body:JSON.stringify({p_token:token}),cache:'no-store'
    }),readEvents()
   ]);
   if(idsResponse.ok){
    const ids=await idsResponse.json();
    const allowed=new Set(Array.isArray(ids)?ids:[]);
    events=(catalog.events||[]).filter(e=>allowed.has(e.id)&&e.status==='published')
     .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));
   }
  }catch{}
 }
 return <section className="meets-account-page meets-shared-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Kopīgotais saraksts</p><h1>Pasākumi, kurus iesaka apmeklēt</h1>
   <p className="meets-muted">Tikai publiski pieejami pasākumi. Personīgā konta dati nav redzami.</p></div>
   <Link href="/karte" className="button primary">Izpētīt karti ↗</Link></div>
  {events.length?<div className="meets-account-list">{events.map(e=>{
   const nav=navigationLinks(e);
   return <article className="meets-account-event" key={e.id}>
    <div className="meets-account-day"><strong>{e.date_from?.slice(8,10)}</strong><small>{e.date_from?.slice(5,7)}.</small></div>
    <div className="meets-account-event-body"><h3>{e.title}</h3><p>{[e.time_from?.slice(0,5),e.venue_name||e.municipality].filter(Boolean).join(' · ')}</p>
     <div className="meets-personal-links">{nav.google&&<a href={nav.google} target="_blank" rel="noopener noreferrer">⌖ Google Maps</a>}{nav.waze&&<a href={nav.waze} target="_blank" rel="noopener noreferrer">↗ Waze</a>}</div>
    </div>
   </article>;
  })}</div>:<div className="meets-account-empty"><span>♡</span><h3>Saraksts nav pieejams vai pašlaik ir tukšs</h3><p>Iespējams, kopīgošana ir izslēgta vai saglabātie pasākumi jau beigušies.</p><Link className="button primary" href="/karte">Atvērt MEETS karti</Link></div>}
 </section>;
}

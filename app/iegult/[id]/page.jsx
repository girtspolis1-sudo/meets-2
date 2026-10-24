import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readEvents} from '../../../lib/events-server.js';
import {filterRegistryEvents,validUuid} from '../../../lib/registry-filters.js';
export const dynamic='force-dynamic';
export const metadata={title:'MEETS pasākumu reģistrs',robots:{index:false,follow:false}};
async function registryById(id){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw Error('Configuration unavailable');
 const response=await fetch(base+'/rest/v1/rpc/meets_public_embed_registry',{
  method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
  body:JSON.stringify({p_id:id}),cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error('Registry service unavailable');
 const result=await response.json();
 return Array.isArray(result)?result[0]:null;
}
function eventDate(item){
 const from=String(item.date_from||''),to=String(item.date_to||'');
 const readable=date=>date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8,10)+'.'+date.slice(5,7)+'.'+date.slice(0,4):'';
 return readable(from)+(to&&to!==from?' – '+readable(to):'');
}
export default async function EmbeddedRegistryPage({params}){
 const {id}=await params;
 if(!validUuid(id))notFound();
 const registry=await registryById(id);
 if(!registry)notFound();
 const catalogue=await readEvents();
 const events=filterRegistryEvents(catalogue.events,registry.filters,registry.included_event_ids,registry.excluded_event_ids);
 const filter=registry.filters||{};
 const search=new URLSearchParams();
 if(filter.category)search.set('category',filter.category);
 if(filter.period&&filter.period!=='all'&&filter.period!=='custom')search.set('period',filter.period);
 if(filter.municipality)search.set('municipality',filter.municipality);
 if(filter.country)search.set('country',filter.country);
 if(filter.query)search.set('q',filter.query);
 if(filter.from)search.set('from',filter.from);
 if(filter.to)search.set('to',filter.to);
 return <section className="meets-embed-root">
  <style>{`
   body:has(.meets-embed-root) > .header,body:has(.meets-embed-root) > footer,
   body:has(.meets-embed-root) > .skip {display:none!important}
   body:has(.meets-embed-root){margin:0;background:#f7f8fc}
   body:has(.meets-embed-root) > main{padding:0!important;max-width:none!important;width:100%!important;margin:0!important;min-height:0!important}
   .meets-embed-root{font:15px/1.5 Arial,sans-serif;color:#21324a;padding:18px;max-width:1100px;margin:0 auto}
   .meets-embed-head{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px}
   .meets-embed-head h1{font-size:clamp(19px,3vw,27px);margin:0 0 5px;line-height:1.2}
   .meets-embed-head p{margin:0;color:#64748b}
   .meets-embed-brand{font-size:11px;font-weight:800;color:#614dba;text-decoration:none;letter-spacing:1px}
   .meets-embed-count{font-size:13px;color:#526179;margin:5px 0 12px}
   .meets-embed-list{display:grid;gap:9px}
   .meets-embed-event{padding:13px 15px;border-radius:12px;background:#fff;border:1px solid #e2e8f0}
   .meets-embed-event strong{font-size:16px;display:block;margin:3px 0}
   .meets-embed-event small{color:#5b6680;font-size:12px}
   .meets-embed-event p{margin:5px 0;color:#5b6680;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
   .meets-embed-event a{font-weight:700;color:#624fc6;text-decoration:none;font-size:13px}
   .meets-embed-footer{margin-top:18px;font-size:12px}
   .meets-embed-footer a{color:#624fc6}
  `}</style>
  <div className="meets-embed-head"><div><h1>{registry.title}</h1>{registry.description&&<p>{registry.description}</p>}</div>
   <Link className="meets-embed-brand" href="/karte" target="_blank" rel="noopener noreferrer">MEETS ↗</Link></div>
  <p className="meets-embed-count">{events.length} aktuāli pasākumi · Saraksts atjaunojas automātiski</p>
  <div className="meets-embed-list">
   {events.slice(0,100).map(event=><article key={event.id} className="meets-embed-event">
    <small>{eventDate(event)}{event.time_from?' · '+String(event.time_from).slice(0,5):''}</small>
    <strong>{event.title}</strong>
    <p>{[event.venue_name,event.municipality].filter(Boolean).join(' · ')}</p>
    <Link href={'/karte?'+new URLSearchParams({event:event.id}).toString()} target="_blank" rel="noopener noreferrer">Skatīt MEETS kartē ↗</Link>
   </article>)}
   {!events.length&&<article className="meets-embed-event">Šobrīd nav pasākumu, kas atbilst šim reģistram.</article>}
  </div>
  <div className="meets-embed-footer"><Link href={'/pasakumi'+(search.size?'?'+search.toString():'')} target="_blank" rel="noopener noreferrer">Visi pasākumi MEETS ↗</Link>
   {events.length>100&&<span> · Parādīti pirmie 100 no {events.length}</span>}</div>
 </section>;
}

'use client';
import Link from 'next/link';
import {useEvents} from '../lib/use-events.js';
import {dateLabel,timeLabel,prices} from '../lib/catalog.js';
export default function PublishedEvents() {
 const {data,loading,error,refresh}=useEvents();
 return <section className="published-section" aria-labelledby="published-heading"><div className="catalog-toolbar"><div><p className="eyebrow">Atklāj Latviju</p><h2 id="published-heading">Publicētie pasākumi</h2></div><Link href="/pasakumi" className="button">Saraksts un Excel ↗</Link></div>
 {loading&&!data&&<p role="status">Ielādējam pasākumus…</p>}
 {error&&<div role="alert" className="error-message">{error} <button className="text-button" onClick={refresh}>Mēģināt vēlreiz</button></div>}
 {data&&data.events.length===0&&<div className="empty"><span className="symbol" aria-hidden="true">◎</span><h3>Pašlaik nav publicētu pasākumu</h3><p>Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.</p></div>}
 {data&&data.events.length>0&&<div className="published-grid">{data.events.map(e=><article className="published-card" key={e.id}><div className="event-art" aria-hidden="true">◎</div><div className="published-body"><p className="eyebrow">{e.primary_category||'Pasākums'}</p><h3>{e.title}</h3><p>{dateLabel(e.date_from)} · {timeLabel(e)}</p>{(e.municipality||e.venue_name)&&<p>{[e.municipality,e.venue_name].filter(Boolean).join(' · ')}</p>}{e.price_status&&e.price_status!=='unknown'&&<span className="badge">{prices[e.price_status]||e.price_status}</span>}<Link className="source-link" href="/pasakumi">Apskatīt sarakstā ↗</Link></div></article>)}</div>}
 </section>;
}

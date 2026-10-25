import Link from 'next/link';
import {notFound} from 'next/navigation';
import {publicVenue} from '../../../lib/public-venues.js';
import VenueCalendar from './venue-calendar.jsx';
import CopyVenueEmbed from './copy-embed.jsx';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {id}=await params;const venue=await publicVenue(id);return {title:venue?.name?venue.name+' — MEETS vietas kalendārs':'MEETS norises vieta'};}
export default async function VenuePage({params}){
 const {id}=await params;
 const venue=await publicVenue(id);if(!venue)notFound();
 return <section className="quick-flow" style={{maxWidth:980,margin:'0 auto',padding:'20px 16px 60px'}}>
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Publiska norises vieta</p><h1>{venue.name}</h1>
   <p className="meets-muted">⌖ {venue.address}</p>{venue.description&&<p>{venue.description}</p>}
   {venue.directions&&<p className="meets-muted">Kā nokļūt: {venue.directions}</p>}</div>
   <Link className="button" href="/karte">MEETS karte ↗</Link></div>
  <section className="quick-flow-card" style={{maxWidth:'none'}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
    <h2>Pasākumu kalendārs</h2>
    <Link className="button" href={'/registre-pasakumu/vienkarsi'}>+ Pievienot pasākumu</Link>
   </div>
   <p className="quick-flow-note">Kalendārā automātiski redzami šai vietai piesaistītie, publicētie MEETS pasākumi.</p>
   <VenueCalendar events={venue.events}/>
   <CopyVenueEmbed id={venue.id} title={venue.name}/>
  </section>
 </section>;
}

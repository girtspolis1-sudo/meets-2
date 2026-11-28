import Link from 'next/link';
import {notFound} from 'next/navigation';
import {publicVenue} from '../../../lib/public-venues.js';
import VenueCalendar from './venue-calendar.jsx';
import CopyVenueEmbed from './copy-embed.jsx';
import FollowButton from '../../components/follow-button.jsx';
import PublicVenueMap from './public-venue-map.jsx';
import {pageMeta} from '../../../lib/page-meta.js';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){
 const {id}=await params;const venue=await publicVenue(id).catch(()=>null);
 if(!venue?.name)return {title:'meets.lv norises vieta'};
 const count=venue.events?.length||0;
 const description=((venue.description||'').trim()||venue.name+(venue.address?', '+venue.address:'')+'. Pasākumu kalendārs: '+(count?count+' gaidāmi pasākumi.':'gaidāmie pasākumi.')).slice(0,160);
 return {title:venue.name+' — pasākumu kalendārs',description,...pageMeta('/vietas/'+venue.id,{title:venue.name,description})};
}
export default async function VenuePage({params}){
 const {id}=await params;
 const venue=await publicVenue(id);if(!venue)notFound();
 return <section className="quick-flow" style={{maxWidth:980,margin:'0 auto',padding:'20px 16px 60px'}}>
  <div className="meets-account-heading"><div><p className="eyebrow">Norises vieta</p><h1>{venue.name}</h1>
   <p className="meets-muted">⌖ {venue.address}</p>{venue.description&&<p>{venue.description}</p>}
   {venue.directions&&<p className="meets-muted">Kā nokļūt: {venue.directions}</p>}</div>
   <div className="org-head-actions"><FollowButton targetKind="venue" targetId={venue.id} className="button primary" label="Sekot vietai" followingLabel="Seko vietai"/><Link className="button" href="/karte">meets.lv karte ↗</Link></div></div>
  <PublicVenueMap latitude={venue.latitude} longitude={venue.longitude} name={venue.name}/>
  <section className="quick-flow-card" style={{maxWidth:'none'}}>
   <h2>Pasākumu kalendārs</h2>
   <p className="quick-flow-note">Kalendārā automātiski redzami šai vietai piesaistītie, publicētie meets.lv pasākumi.</p>
   <VenueCalendar events={venue.events}/>
   <p className="venue-organizer-note">Rīko pasākumu šeit? <Link href="/registre-pasakumu/vienkarsi">Pievieno to</Link></p>
   <CopyVenueEmbed id={venue.id} title={venue.name}/>
  </section>
 </section>;
}

import {notFound} from 'next/navigation';
import {publicVenue} from '../../../lib/public-venues.js';
import VenueCalendar from '../../vietas/[id]/venue-calendar.jsx';
export const dynamic='force-dynamic';
export const metadata={title:'MEETS norises vietas kalendārs',robots:{index:false,follow:false}};
export default async function EmbedVenue({params}){
 const {id}=await params;
 const venue=await publicVenue(id);if(!venue)notFound();
 return <main className="venue-embed-page" style={{padding:'15px',maxWidth:860,margin:'0 auto'}}>
  <style>{`
   body:has(.venue-embed-page) .header,body:has(.venue-embed-page) footer{display:none!important}
   body:has(.venue-embed-page){margin:0;background:#f8f7fc}
   body:has(.venue-embed-page)>main{padding:0!important;max-width:none!important}
  `}</style>
  <header style={{marginBottom:16}}><h1 style={{fontSize:23,margin:'0 0 5px'}}>{venue.name}</h1>
   <p style={{color:'#667085',margin:0}}>{venue.address} · MEETS</p></header>
  <VenueCalendar events={venue.events} embedded/>
  <p style={{marginTop:20,fontSize:12}}><a href={'/vietas/'+venue.id} target="_blank" rel="noopener noreferrer">Atvērt norises vietu MEETS ↗</a></p>
 </main>;
}

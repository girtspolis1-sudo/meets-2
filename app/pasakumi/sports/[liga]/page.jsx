import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../../lib/events-server.js';
import {leagues} from '../../../../lib/event-listings.js';
import ListingPage,{buildListing,listingMetadata} from '../../listing-page.jsx';

export const dynamic='force-dynamic';

// /pasakumi/sports/<league> — the coming games of one competition.
const resolve=cache(async slug=>{
 const {events}=await readEventsCached();
 const league=leagues(events).find(l=>l.slug===String(slug||''));
 return league?{events,league}:null;
});
export async function generateMetadata({params}){
 const {liga}=await params;
 const found=await resolve(liga).catch(()=>null);
 if(!found)return {title:'Lapa nav atrasta'};
 return listingMetadata(buildListing(found.events,{league:found.league}));
}
export default async function LeagueListing({params}){
 const {liga}=await params;
 const found=await resolve(liga);
 if(!found)notFound();
 return <ListingPage data={buildListing(found.events,{league:found.league})} allEvents={found.events} league={found.league} category="sport"/>;
}

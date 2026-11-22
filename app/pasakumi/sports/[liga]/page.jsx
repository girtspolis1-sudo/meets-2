import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../../lib/events-server.js';
import {leagues} from '../../../../lib/event-listings.js';
import ListingPage,{buildListing,listingMetadata} from '../../listing-page.jsx';

// Rendered on first visit, then served from the CDN and rebuilt in the background every
// five minutes. The catalogue read is not put into the data cache (it is over its 2 MB limit).
export const dynamic='force-static';
export const revalidate=300;
export async function generateStaticParams(){return [];}

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

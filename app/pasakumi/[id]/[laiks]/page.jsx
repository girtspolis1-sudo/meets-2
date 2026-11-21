import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../../lib/events-server.js';
import {municipalityBySlug} from '../../../../lib/event-listings.js';
import {TIME_SLUGS} from '../../../../lib/seo.js';
import ListingPage,{buildListing,listingMetadata} from '../../listing-page.jsx';

export const dynamic='force-dynamic';

// /pasakumi/riga/sodien, /rit, /brivdienas, /sonedel
const resolve=cache(async(town,time)=>{
 if(!Object.hasOwn(TIME_SLUGS,time))return null;
 const {events}=await readEventsCached();
 const municipality=municipalityBySlug(events,town);
 return municipality?{events,municipality,time}:null;
});
export async function generateMetadata({params}){
 const {id,laiks}=await params;
 const found=await resolve(id,laiks).catch(()=>null);
 if(!found)return {title:'Lapa nav atrasta'};
 return listingMetadata(buildListing(found.events,{municipality:found.municipality,time:found.time}));
}
export default async function TimeListing({params}){
 const {id,laiks}=await params;
 const found=await resolve(id,laiks);
 if(!found)notFound();
 return <ListingPage data={buildListing(found.events,{municipality:found.municipality,time:found.time})} allEvents={found.events} municipality={found.municipality} time={found.time}/>;
}

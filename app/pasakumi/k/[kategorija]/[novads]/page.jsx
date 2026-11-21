import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../../../lib/events-server.js';
import {municipalityBySlug} from '../../../../../lib/event-listings.js';
import {categoryKeyFromSlug} from '../../../../../lib/seo.js';
import ListingPage,{buildListing,listingMetadata} from '../../../listing-page.jsx';

export const dynamic='force-dynamic';

// /pasakumi/k/muzika/jelgava — one discovery group in one municipality.
const resolve=cache(async(slug,town)=>{
 const category=categoryKeyFromSlug(slug);
 if(!category)return null;
 const {events}=await readEventsCached();
 const municipality=municipalityBySlug(events,town);
 return municipality?{events,category,municipality}:null;
});
export async function generateMetadata({params}){
 const {kategorija,novads}=await params;
 const found=await resolve(kategorija,novads).catch(()=>null);
 if(!found)return {title:'Lapa nav atrasta'};
 return listingMetadata(buildListing(found.events,{category:found.category,municipality:found.municipality}));
}
export default async function CategoryTownListing({params}){
 const {kategorija,novads}=await params;
 const found=await resolve(kategorija,novads);
 if(!found)notFound();
 return <ListingPage data={buildListing(found.events,{category:found.category,municipality:found.municipality})} allEvents={found.events} category={found.category} municipality={found.municipality}/>;
}

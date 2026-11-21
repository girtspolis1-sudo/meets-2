import {notFound} from 'next/navigation';
import {cache} from 'react';
import {readEventsCached} from '../../../../lib/events-server.js';
import {categoryKeyFromSlug} from '../../../../lib/seo.js';
import ListingPage,{buildListing,listingMetadata} from '../../listing-page.jsx';

export const dynamic='force-dynamic';

// /pasakumi/k/muzika — one discovery group across Latvia.
const resolve=cache(async slug=>{
 const category=categoryKeyFromSlug(slug);
 if(!category)return null;
 const {events}=await readEventsCached();
 return {events,category};
});
export async function generateMetadata({params}){
 const {kategorija}=await params;
 const found=await resolve(kategorija).catch(()=>null);
 if(!found)return {title:'Lapa nav atrasta'};
 return listingMetadata(buildListing(found.events,{category:found.category}));
}
export default async function CategoryListing({params}){
 const {kategorija}=await params;
 const found=await resolve(kategorija);
 if(!found)notFound();
 return <ListingPage data={buildListing(found.events,{category:found.category})} allEvents={found.events} category={found.category}/>;
}

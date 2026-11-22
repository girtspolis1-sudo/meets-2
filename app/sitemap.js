import {sitemapEntries,staticEntries} from '../lib/sitemap-server.js';
import {indexingAllowed} from '../lib/seo.js';
import {unstable_rethrow} from 'next/navigation';

// Built once an hour and served from the CDN, so crawlers get it at once.
export const dynamic='force-static';
export const revalidate=3600;

// https://www.meets.lv/sitemap.xml — empty where indexing is off (preview builds).
// When the catalogue cannot be read the request fails, so the CDN keeps the last good
// sitemap instead of caching an empty one; only the first build falls back to the fixed pages.
export default async function sitemap(){
 if(!indexingAllowed())return [];
 try{return await sitemapEntries();}
 catch(error){
  unstable_rethrow(error);
  console.error('sitemap_failed',{name:error?.name||'Error'});
  if(process.env.NEXT_PHASE==='phase-production-build')return staticEntries();
  throw error;
 }
}

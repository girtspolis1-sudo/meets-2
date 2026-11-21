import {sitemapEntries} from '../lib/sitemap-server.js';
import {indexingAllowed} from '../lib/seo.js';

export const dynamic='force-dynamic';

// https://meets.lv/sitemap.xml — empty where indexing is off (preview builds).
export default async function sitemap(){
 if(!indexingAllowed())return [];
 try{return await sitemapEntries();}
 catch(error){console.error('sitemap_failed',{name:error?.name||'Error'});return [];}
}

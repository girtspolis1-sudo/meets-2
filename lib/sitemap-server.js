import 'server-only';
import {readEventsCached} from './events-server.js';
import {rigaTodayIso} from './event-date.js';
import {indexableListings} from './event-listings.js';
import {sportPages} from './sports-pages.js';
import {SITE_URL,eventPath,isUuid} from './seo.js';

async function publicPages(){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)return {venues:[],organizers:[]};
 try{
  const r=await fetch(base+'/rest/v1/rpc/meets_public_sitemap_entries',{method:'POST',
   headers:{apikey:key,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return {venues:[],organizers:[]};
  const v=await r.json();
  return {venues:Array.isArray(v?.venues)?v.venues:[],organizers:Array.isArray(v?.organizers)?v.organizers:[]};
 }catch{return {venues:[],organizers:[]};}
}
const day=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?new Date(t):undefined;};

// The fixed pages, also the fallback when the catalogue cannot be read during a build.
export function staticEntries(now=new Date()){
 return [
  {url:SITE_URL+'/',lastModified:now,changeFrequency:'hourly',priority:1},
  {url:SITE_URL+'/pasakumi',lastModified:now,changeFrequency:'hourly',priority:0.9},
  {url:SITE_URL+'/karte',lastModified:now,changeFrequency:'hourly',priority:0.8},
  {url:SITE_URL+'/organizators',changeFrequency:'monthly',priority:0.3}
 ];
}

// Everything indexable: home, map, list, every coming event, listing pages with
// enough events, public venues and organizers.
export async function sitemapEntries(){
 const [{events},pages]=await Promise.all([readEventsCached(),publicPages()]);
 const today=rigaTodayIso();
 const now=new Date();
 const out=staticEntries(now);
 for(const l of indexableListings(events,today))out.push({url:SITE_URL+l.path,lastModified:now,changeFrequency:'daily',priority:0.7});
 for(const e of events)out.push({url:SITE_URL+eventPath(e),lastModified:day(e.updated_at),changeFrequency:'daily',priority:0.6});
 for(const v of pages.venues)if(isUuid(v.id))out.push({url:SITE_URL+'/vietas/'+v.id,lastModified:day(v.updated_at),changeFrequency:'weekly',priority:0.5});
 for(const o of pages.organizers)if(isUuid(o.id))out.push({url:SITE_URL+'/organizatori/'+(o.slug||o.id),lastModified:day(o.updated_at),changeFrequency:'weekly',priority:0.5});
 return out;
}

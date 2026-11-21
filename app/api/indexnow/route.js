import {readEventsCached} from '../../../lib/events-server.js';
import {INDEXNOW_ENDPOINT,changedUrls,indexNowBody,validIndexNowKey} from '../../../lib/indexnow.js';
import {SITE_URL,eventUrl,indexingAllowed} from '../../../lib/seo.js';

export const dynamic='force-dynamic';

// Vercel Cron, daily (vercel.json; daily also works on the Hobby plan): events changed
// in the last 26 hours are sent
// to IndexNow. Only in Production with indexing on; Vercel sends CRON_SECRET.
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return Response.json({error:'Unauthorized'},{status:401});
 const key=process.env.INDEXNOW_KEY;
 if(!indexingAllowed()||!validIndexNowKey(key))return Response.json({ok:true,skipped:'indexing off or no key'});
 const {events}=await readEventsCached();
 const urls=changedUrls(events,new Date(Date.now()-26*3600e3).toISOString(),eventUrl);
 if(!urls.length)return Response.json({ok:true,sent:0});
 const host=new URL(SITE_URL).host;
 const response=await fetch(INDEXNOW_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
  body:JSON.stringify(indexNowBody({host,key,keyLocation:SITE_URL+'/indexnow-key/'+key+'.txt',urls})),signal:AbortSignal.timeout(20000)});
 return Response.json({ok:response.ok,status:response.status,sent:urls.length},{status:response.ok?200:502});
}

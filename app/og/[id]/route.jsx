import {ImageResponse} from 'next/og';
import {findPublicEvent} from '../../../lib/events-server.js';
import {cardCategory,cardLocation} from '../../../lib/discovery-card.js';
import {sentenceDate} from '../../../lib/event-seo.js';
import {municipalityShortName,isUuid} from '../../../lib/seo.js';
import {OG_SIZE,ogCard} from '../../../lib/og-card.jsx';

export const dynamic='force-dynamic';

// Share image of an event without its own picture: title, date, time and place.
export async function GET(_request,{params}){
 const {id}=await params;
 const found=isUuid(id)?await findPublicEvent({kind:'uuid',id:String(id).toLowerCase()}).catch(()=>null):null;
 if(!found)return new Response('Not found',{status:404});
 const e=found.event;
 const time=e.time_from?' plkst. '+String(e.time_from).slice(0,5):'';
 const place=[cardLocation(e),e.settlement||municipalityShortName(e.municipality||'')].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
 return new ImageResponse(ogCard({kicker:cardCategory(e),title:e.title,line:[sentenceDate(e.date_from)+time,place].filter(Boolean).join(' · ')}),
  {...OG_SIZE,headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'}});
}

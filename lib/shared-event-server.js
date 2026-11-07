import 'server-only';
import {isShareToken} from './shared-event.js';

// One organizer event by its share link: private, waiting for review or
// published. null for an unknown link, a draft, a returned or a cancelled event.
export async function readSharedEvent(token){
 const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=process.env;
 if(!isShareToken(token)||!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return null;
 const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/meets_shared_event',{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({p_token:token}),
  cache:'no-store',
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error('Shared event upstream status '+response.status);
 const event=await response.json();
 return event&&typeof event==='object'&&typeof event.title==='string'?event:null;
}

// The address this request came in on, for absolute links (QR code, sharing).
export function requestOrigin(headerList){
 const host=(headerList.get('x-forwarded-host')||headerList.get('host')||'').split(',')[0].trim();
 const forwarded=(headerList.get('x-forwarded-proto')||'').split(',')[0].trim();
 const local=host.startsWith('localhost')||host.startsWith('127.');
 const proto=forwarded==='http'||forwarded==='https'?forwarded:local?'http':'https';
 return /^[a-z0-9.-]+(:\d+)?$/i.test(host)?proto+'://'+host:(process.env.NEXT_PUBLIC_SITE_URL||'https://meets.lv');
}

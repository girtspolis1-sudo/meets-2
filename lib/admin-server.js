import 'server-only';
import {publicEvent} from './catalog.js';

function config(){
 const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=process.env;
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)throw new Error('Admin catalogue configuration missing');
 return {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY};
}
async function rpc(name,body){
 const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=config();
 const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify(body),
  cache:'no-store',
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw new Error(`Admin upstream status ${response.status}`);
 return response.json();
}
export async function readAdminEvents(token){
 const data=await rpc('meets_admin_catalog',{p_token:token});
 if(!Array.isArray(data.events))throw new Error('Invalid admin catalogue response');
 const events=data.events.map(publicEvent);
 return {events,total:events.length,fetchedAt:data.fetchedAt};
}
export async function updateAdminEvent(token,input){
 return rpc('meets_admin_update_event',{
  p_token:token,
  p_event_id:input.eventId,
  p_status:input.status??null,
  p_venue_name:input.venueName??null,
  p_latitude:input.latitude??null,
  p_longitude:input.longitude??null
 });
}

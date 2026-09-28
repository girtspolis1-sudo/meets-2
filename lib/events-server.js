import 'server-only';
import { publicEvent } from './catalog.js';

export async function readEvents({includePending=false}={}) {
 const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MEETS_CATALOG_TOKEN } = process.env;
 if(!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !MEETS_CATALOG_TOKEN) throw new Error('Catalogue configuration missing');
 const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/meets_public_catalog`, {
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({p_token:MEETS_CATALOG_TOKEN}),
  cache:'no-store',
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok) throw new Error(`Catalogue upstream status ${response.status}`);
 const data=await response.json();
 if(!Array.isArray(data.events)) throw new Error('Invalid catalogue response');
 const allowed=includePending ? new Set(['published','pending_review']) : new Set(['published']);
 const events=data.events.filter(event=>allowed.has(event.status)).map(publicEvent);
 return {events,total:events.length,fetchedAt:data.fetchedAt};
}

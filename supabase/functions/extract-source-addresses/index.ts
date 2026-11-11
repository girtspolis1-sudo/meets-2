import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {extractAddresses,fetchableUrl} from "../_shared/source-address.js";

// Step 4 of the automatic map points, switchable: reads the source pages of events
// whose place nothing else resolved and stores the street addresses found there.
// It stores text only. Coordinates are taken later, in the database, from the
// State Address Register (meets_private.location_auto_plan).
// On: update meets_private.app_settings set value='on' where key='location_auto_source_pages'.
// Body {"force":true} reads one batch while the setting is off (for a trial).
const SB=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_BYTES=1_500_000;

async function rpc(name:string,body:unknown){
 const r=await fetch(SB+"/rest/v1/rpc/"+name,{method:"POST",
  headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const t=await r.text();
 if(!r.ok)throw new Error(name+" "+r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}

async function readPage(url:string){
 const res=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(15000),
  headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)",Accept:"text/html"}});
 if(!res.ok)return {status:"http_"+res.status,addresses:[]};
 if(!/html/i.test(res.headers.get("content-type")||""))return {status:"not_html",addresses:[]};
 const bytes=new Uint8Array(await res.arrayBuffer());
 const html=new TextDecoder().decode(bytes.subarray(0,MAX_BYTES));
 return {status:"ok",addresses:extractAddresses(html)};
}

Deno.serve(async(req)=>{
 try{
  let body:Record<string,unknown>={};
  try{body=await req.json();}catch{/* empty body */}
  const limit=Math.min(Math.max(Number(body.limit)||15,1),40);
  const pages=await rpc("meets_location_source_pages_next",{p_limit:limit,p_force:body.force===true})||[];
  const rows=[];
  for(const page of pages){
   const url=fetchableUrl(page.url);
   if(!url){rows.push({event_id:page.event_id,url:String(page.url),status:"bad_url",addresses:[]});continue;}
   try{rows.push({event_id:page.event_id,url,...await readPage(url)});}
   catch(e){rows.push({event_id:page.event_id,url,status:"failed",addresses:[]});console.error("source_page_failed",url,String(e));}
  }
  if(rows.length)await rpc("meets_location_source_pages_store",{p_rows:rows});
  return Response.json({ok:true,pages:rows.length,withAddress:rows.filter(r=>r.addresses.length).length});
 }catch(e){
  console.error("extract_source_addresses_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});

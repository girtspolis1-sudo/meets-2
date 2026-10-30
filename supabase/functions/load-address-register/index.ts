import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Loads street addresses with coordinates from the State Address Register
// (VZD open data, aw_eka.csv, ~140 MB) one 5 MB part per call. The database
// keeps the byte offset; a cron job calls this every minute while a load runs.
const SB=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CSV_URL="https://data.gov.lv/dati/dataset/6b06a7e8-dedf-4705-a47b-2a7c51177473/resource/a510737a-18ce-400f-ad4b-04fce5228272/download/aw_eka.csv";
const PART=5*1024*1024;
// KODS,TIPS_CD,STATUSS,…,STD,KOORD_X,KOORD_Y,DD_N,DD_E
const COLUMNS=21,KODS=0,STATUSS=2,STD=16,DD_N=19,DD_E=20;

async function rpc(name:string,body:unknown){
 const r=await fetch(SB+"/rest/v1/rpc/"+name,{method:"POST",
  headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const t=await r.text();
 if(!r.ok)throw new Error(name+" "+r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}

// Existing street addresses ("Kalēju iela 9/11, Rīga, LV-1050"); named farmsteads are left out.
export function parseLine(line:string):[string,string,number,number]|null{
 if(!line.startsWith('"')||!line.endsWith('"'))return null;
 const f=line.slice(1,-1).split('","');
 if(f.length!==COLUMNS||f[STATUSS]!=="EKS")return null;
 const std=f[STD].replaceAll('""','"'),lat=Number(f[DD_N]),lon=Number(f[DD_E]);
 if(std.startsWith('"')||!/\d/.test(std.split(", ")[0])||!Number.isFinite(lat)||!Number.isFinite(lon)||!lat||!lon)return null;
 return [f[KODS],std,lat,lon];
}

Deno.serve(async()=>{
 try{
  const state=await rpc("meets_address_register_next",{});
  if(state?.state!=="running")return Response.json({ok:true,idle:true,state:state?.state});
  const from=Number(state.offset)||0;
  const res=await fetch(CSV_URL,{headers:{Range:`bytes=${from}-${from+PART-1}`,"User-Agent":"MEETS/1.0 (+https://meets.lv)"},signal:AbortSignal.timeout(60000)});
  if(res.status!==206&&res.status!==200)throw new Error("aw_eka.csv HTTP "+res.status);
  const bytes=new Uint8Array(await res.arrayBuffer());
  const total=res.status===206?Number((res.headers.get("content-range")||"").split("/")[1]):bytes.length;
  if(!Number.isFinite(total)||total<=0)throw new Error("Unknown file size");
  const last=from+bytes.length>=total;
  // Only whole lines: the rest of the last line starts the next part.
  let end=bytes.length;
  if(!last){end=bytes.lastIndexOf(10)+1;if(end<=0)throw new Error("No line break in part");}
  let text=new TextDecoder().decode(bytes.subarray(0,end));
  if(from===0)text=text.replace(/^﻿?[^\n]*\n/,"");
  const rows=text.split(/\r?\n/).map(parseLine).filter(Boolean);
  const result=await rpc("meets_address_register_import",{p_from:from,p_next:from+end,p_total:total,p_rows:rows});
  return Response.json({ok:true,from,next:from+end,total,rows:rows.length,...result});
 }catch(e){
  try{await rpc("meets_address_register_failed",{p_error:String(e)});}catch{}
  console.error("address_register_load_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});

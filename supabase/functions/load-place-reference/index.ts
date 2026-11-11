import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {csvObjects,centroidRow,institutionRow,chunks} from "../_shared/place-reference.js";

// Reference tables for the automatic map points (meets_private.place_centroids,
// meets_private.culture_institutions), reloaded monthly by cron:
//  - VZD address register "Vietu centroidi": centres of towns, villages, parishes;
//  - "Latvijas kultūras institūcijas" (data.gov.lv, source kulturasdati.lv).
// Body {"only":"centroids"|"institutions"} loads one of them.
const SB=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FILES={
 centroids:"https://data.gov.lv/dati/dataset/6b06a7e8-dedf-4705-a47b-2a7c51177473/resource/68f1152c-0f4c-4fc3-abb3-df4b8bfea992/download/aw_vietu_centroidi.csv",
 institutions:"https://data.gov.lv/dati/lv/dataset/6d564a05-1d8c-49b8-835f-c969c61da182/resource/92af15f3-9674-426e-925c-86c6254baa0d/download/objektusaraksts.csv",
};
// A file much smaller than usual is a broken download, not a real change.
const MIN_ROWS={centroids:3000,institutions:1000};

async function rpc(name:string,body:unknown){
 const r=await fetch(SB+"/rest/v1/rpc/"+name,{method:"POST",
  headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const t=await r.text();
 if(!r.ok)throw new Error(name+" "+r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}

async function load(kind:"centroids"|"institutions"){
 const res=await fetch(FILES[kind],{headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)"},signal:AbortSignal.timeout(90000)});
 if(!res.ok)throw new Error(kind+" HTTP "+res.status);
 const rows=csvObjects(await res.text()).map(kind==="centroids"?centroidRow:institutionRow).filter(Boolean);
 if(rows.length<MIN_ROWS[kind])throw new Error(kind+": only "+rows.length+" usable rows");
 const parts=chunks(rows,1000);
 for(let i=0;i<parts.length;i++){
  await rpc("meets_place_reference_import",{p_kind:kind,p_rows:parts[i],p_first:i===0,p_last:i===parts.length-1});
 }
 // The coordinate check runs in parts: one call may not take longer than a few seconds.
 if(kind==="institutions"){
  for(let i=0;i<60;i++){
   if(Number(await rpc("meets_place_reference_check",{p_limit:300}))===0)break;
  }
 }
 return rows.length;
}

Deno.serve(async(req)=>{
 let only="";
 try{only=String((await req.json())?.only||"");}catch{/* empty body */}
 const result:Record<string,unknown>={};
 let ok=true;
 // Centroids first: the institutions' coordinate check uses them.
 for(const kind of ["centroids","institutions"] as const){
  if(only&&only!==kind)continue;
  try{result[kind]=await load(kind);}
  catch(e){
   ok=false;result[kind]=String(e);
   console.error("place_reference_load_failed",kind,e);
   try{await rpc("meets_place_reference_failed",{p_kind:kind,p_error:String(e)});}catch{/* reported above */}
  }
 }
 return Response.json({ok,...result},{status:ok?200:500});
});

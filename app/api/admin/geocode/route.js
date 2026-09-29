export const dynamic='force-dynamic';

let lastNominatimRequestAt=0;

async function validateSession(sessionToken){
 const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=process.env;
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return false;
 const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/meets_admin_session_valid`,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({p_session_token:sessionToken}),
  cache:'no-store',
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)return false;
 return (await response.json())===true;
}

function osmUrl(item){
 const type=String(item.osm_type||'').toLowerCase();
 const id=String(item.osm_id||'');
 if(!id||!['node','way','relation'].includes(type))return null;
 return `https://www.openstreetmap.org/${type}/${id}`;
}

export async function POST(request){
 try{
  const auth=request.headers.get('authorization')||'';
  const sessionToken=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!sessionToken||!(await validateSession(sessionToken))){
   return Response.json({error:'Nav admin autorizācijas.'},{status:401});
  }

  const body=await request.json();
  const query=String(body?.query||'').trim();
  if(query.length<3){
   return Response.json({error:'Ievadi vismaz 3 rakstzīmes.'},{status:400});
  }

  const wait=Math.max(0,1100-(Date.now()-lastNominatimRequestAt));
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastNominatimRequestAt=Date.now();

  const params=new URLSearchParams({
   q:query,
   format:'jsonv2',
   addressdetails:'1',
   limit:'8',
   countrycodes:'lv',
   bounded:'1',
   viewbox:'20.5,58.2,28.5,55.5',
   'accept-language':'lv,en'
  });

  const response=await fetch('https://nominatim.openstreetmap.org/search?'+params.toString(),{
   headers:{
    'User-Agent':'MEETS-2/1.0 (+https://meets-2.vercel.app; contact: girts.polis@icloud.com)',
    'Accept':'application/json'
   },
   next:{revalidate:86400},
   signal:AbortSignal.timeout(15000)
  });

  if(!response.ok){
   return Response.json({error:'Vietu meklēšanas serviss šobrīd nav pieejams.'},{status:502});
  }

  const raw=await response.json();
  const seen=new Set();
  const results=[];
  for(const item of Array.isArray(raw)?raw:[]){
   const lat=Number(item.lat),lon=Number(item.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   if(lat<55.5||lat>58.2||lon<20.5||lon>28.5)continue;
   const key=String(item.osm_type||'')+':'+String(item.osm_id||'');
   if(seen.has(key))continue;
   seen.add(key);
   results.push({
    id:key,
    label:item.name||String(item.display_name||'').split(',')[0]||'Vieta',
    displayName:String(item.display_name||''),
    latitude:lat,
    longitude:lon,
    type:item.type||null,
    category:item.category||null,
    sourceUrl:osmUrl(item)
   });
  }

  return Response.json(
   {results,query,attribution:'© OpenStreetMap contributors'},
   {headers:{'Cache-Control':'private, max-age=0, must-revalidate'}}
  );
 }catch(error){
  console.error('admin_geocode_failed',{name:error?.name||'Error'});
  return Response.json({error:'Vietu meklēšana neizdevās.'},{status:500});
 }
}

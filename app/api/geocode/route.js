export const dynamic='force-dynamic';

let lastRequestAt=0;

function osmUrl(item){
 const type=String(item.osm_type||'').toLowerCase();
 const id=String(item.osm_id||'');
 if(!id||!['node','way','relation'].includes(type))return null;
 return `https://www.openstreetmap.org/${type}/${id}`;
}

export async function POST(request){
 try{
  const body=await request.json();
  const query=String(body?.query||'').trim();
  if(query.length<2){
   return Response.json({error:'Ievadi vismaz 2 rakstzīmes.'},{status:400});
  }

  const wait=Math.max(0,1100-(Date.now()-lastRequestAt));
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastRequestAt=Date.now();

  const params=new URLSearchParams({
   q:query,
   format:'jsonv2',
   addressdetails:'1',
   limit:'8',
   countrycodes:'lv,ee,lt',
   bounded:'1',
   viewbox:'16,60.8,31.5,53.5',
   'accept-language':'lv,en'
  });

  const response=await fetch('https://nominatim.openstreetmap.org/search?'+params.toString(),{
   headers:{
    'User-Agent':'MEETS-2/1.0 (+https://meets-2.vercel.app; contact: girts.polis@icloud.com)',
    'Accept':'application/json'
   },
   cache:'no-store',
   signal:AbortSignal.timeout(12000)
  });

  if(!response.ok){
   return Response.json({error:'Vietu meklēšanas serviss šobrīd nav pieejams.'},{status:502});
  }

  const raw=await response.json();
  const seen=new Set();
  const results=[];
  for(const item of Array.isArray(raw)?raw:[]){
   const latitude=Number(item.lat),longitude=Number(item.lon);
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
   if(latitude<53.5||latitude>60.8||longitude<16||longitude>31.5)continue;
   const id=String(item.osm_type||'')+':'+String(item.osm_id||'');
   if(seen.has(id))continue;
   seen.add(id);
   results.push({
    id,
    label:item.name||String(item.display_name||'').split(',')[0]||'Vieta',
    displayName:String(item.display_name||''),
    latitude,
    longitude,
    sourceUrl:osmUrl(item)
   });
  }

  return Response.json({results,query,attribution:'© OpenStreetMap contributors'},{headers:{'Cache-Control':'private, max-age=0, must-revalidate'}});
 }catch(error){
  console.error('public_geocode_failed',{name:error?.name||'Error'});
  return Response.json({error:'Vietu meklēšana neizdevās.'},{status:500});
 }
}

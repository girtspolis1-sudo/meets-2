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
function norm(value=''){
 return String(value).toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function scorePlace(item,{venueName,settlement,municipality}){
 const display=norm(item.display_name||'');
 const label=norm(item.name||'');
 const venueTokens=norm(venueName).split(' ').filter(v=>v.length>2);
 let score=0;
 for(const token of venueTokens)if(label.includes(token)||display.includes(token))score+=2;
 if(settlement&&display.includes(norm(settlement)))score+=5;
 if(municipality&&display.includes(norm(municipality).replace(' valstspilseta','').replace(' novads','')))score+=2;
 if(['stadium','sports_centre','pitch','sports_hall'].includes(String(item.type||'')))score+=4;
 score+=Math.min(3,Number(item.importance||0)*3);
 return score;
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
  const context={
   venueName:String(body?.venueName||query).trim(),
   settlement:String(body?.settlement||'').trim(),
   municipality:String(body?.municipality||'').trim()
  };
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
   if(lat<53.5||lat>60.8||lon<16||lon>31.5)continue;
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
    sourceUrl:osmUrl(item),
    score:scorePlace(item,context)
   });
  }
  results.sort((a,b)=>b.score-a.score||String(a.displayName).localeCompare(String(b.displayName),'lv'));

  return Response.json(
   {results,query,attribution:'© OpenStreetMap contributors'},
   {headers:{'Cache-Control':'private, max-age=0, must-revalidate'}}
  );
 }catch(error){
  console.error('admin_geocode_failed',{name:error?.name||'Error'});
  return Response.json({error:'Vietu meklēšana neizdevās.'},{status:500});
 }
}

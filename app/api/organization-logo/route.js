import {NextResponse} from 'next/server';
export const runtime='nodejs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
export async function POST(request){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)return NextResponse.json({error:'Nav konfigurēta attēlu glabātuve.'},{status:503});
 try{
  const form=await request.formData(),token=form.get('token'),org=form.get('organization_id'),file=form.get('file');
  if(typeof token!=='string'||!UUID.test(String(org||'')))return NextResponse.json({error:'Nepieciešama pieslēgšanās.'},{status:401});
  if(!file||!(file.type in MIME)||file.size>2*1024*1024||file.size<100)return NextResponse.json({error:'Atļauts JPG, PNG vai WebP attēls līdz 2 MB.'},{status:400});
  const headers={apikey:key,Authorization:'Bearer '+token};
  const auth=await fetch(base+'/auth/v1/user',{headers,cache:'no-store'});
  if(!auth.ok)return NextResponse.json({error:'Sesija beigusies.'},{status:401});
  const me=await auth.json();
  const own=await fetch(base+'/rest/v1/meets_organizations?id=eq.'+org+'&owner_id=eq.'+me.id+'&select=id',{headers,cache:'no-store'});
  if(!own.ok||(await own.json()).length===0)return NextResponse.json({error:'Logo var mainīt tikai organizācijas īpašnieks.'},{status:403});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const good=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:
   file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:
   String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!good)return NextResponse.json({error:'Attēla saturs neatbilst tā formātam.'},{status:400});
  const path=org+'/'+crypto.randomUUID()+'.'+MIME[file.type];
  const uploaded=await fetch(base+'/storage/v1/object/meets-org-logos/'+path,{method:'POST',headers:{...headers,'Content-Type':file.type,'x-upsert':'false'},body:bytes,cache:'no-store'});
  if(!uploaded.ok)return NextResponse.json({error:'Logo neizdevās augšupielādēt.'},{status:502});
  return NextResponse.json({url:base+'/storage/v1/object/public/meets-org-logos/'+path});
 }catch{return NextResponse.json({error:'Logo apstrāde neizdevās.'},{status:500});}
}

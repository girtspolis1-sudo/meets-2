import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const UUID=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
const MIME={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const bad=(message,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
function matches(bytes,mime){
 if(mime==='image/png')return bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10;
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='image/webp')return String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return false;
}
export async function POST(request){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)return bad('Nav konfigurēta failu glabātuve.',503);
 const form=await request.formData().catch(()=>null);
 if(!form)return bad('Neizdevās nolasīt attēlu.');
 const token=form.get('token'),id=form.get('submission_id'),file=form.get('file');
 if(typeof token!=='string'||token.length>8000||typeof id!=='string'||!UUID.test(id))return bad('Nepieciešama derīga sesija.',401);
 if(!file||typeof file.arrayBuffer!=='function'||!(file.type in MIME)||file.size<100||file.size>4*1024*1024)
  return bad('Atļauts PNG, JPG vai WebP attēls līdz 4 MB.');
 const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},cache:'no-store'});
 if(!auth.ok)return bad('Sesija beigusies.',401);
 const user=await auth.json();
 if(!UUID.test(user.id||''))return bad('Nederīga sesija.',401);
 const headers={apikey:key,Authorization:'Bearer '+token};
 const own=await fetch(base+'/rest/v1/meets_submissions?select=id,status,author_id&id=eq.'+id+'&author_id=eq.'+user.id,{
  headers,cache:'no-store'
 });
 if(!own.ok)return bad('Neizdevās pārbaudīt iesniegumu.',502);
 const [submission]=await own.json();
 if(!submission||submission.status!=='draft')return bad('Attēlu var pievienot tikai savam melnrakstam.',403);
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(!matches(bytes,file.type))return bad('Attēla saturs neatbilst izvēlētajam formātam.');
 const path=user.id+'/'+id+'/'+crypto.randomUUID()+'.'+MIME[file.type];
 const uploaded=await fetch(base+'/storage/v1/object/meets-event-images/'+path,{
  method:'POST',headers:{...headers,'Content-Type':file.type,'Cache-Control':'3600','x-upsert':'false'},
  body:bytes,cache:'no-store'
 });
 if(!uploaded.ok)return bad('Attēlu neizdevās augšupielādēt.',502);
 const saved=await fetch(base+'/rest/v1/meets_submissions?id=eq.'+id+'&author_id=eq.'+user.id,{
  method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify({cover_image_path:path,updated_at:new Date().toISOString()}),cache:'no-store'
 });
 if(!saved.ok||!(await saved.json()).length)return bad('Attēls ir augšupielādēts, bet neizdevās to sasaistīt ar pasākumu.',502);
 return NextResponse.json({path,url:base+'/storage/v1/object/public/meets-event-images/'+path},{headers:{'Cache-Control':'no-store'}});
}

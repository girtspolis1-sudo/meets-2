import {NextResponse} from 'next/server';
import {cleanRegistryFilters,cleanRegistryIds,validUuid} from '../../../lib/registry-filters.js';
export const dynamic='force-dynamic';

const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
const TABLE='meets_embed_registries';
function reply(error,status=400){return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});}
async function rest(table,token,method='GET',query='',payload){
 const headers={apikey:KEY(),Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'};
 const response=await fetch(BASE()+'/rest/v1/'+table+query,{method,headers,cache:'no-store',
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 if(!response.ok)throw Error('Datus neizdevās saglabāt vai nolasīt.');
 if(response.status===204)return [];
 return response.json();
}
export async function POST(request){
 try{
  if(!BASE()||!KEY())return reply('Nav konfigurēts kontu serviss.',503);
  const input=await request.json();
  if(!input||typeof input!=='object')return reply('Nederīgi dati.');
  const {action,token}=input;
  if(typeof token!=='string'||token.length<20||token.length>8000)return reply('Nepieciešama pieslēgšanās.',401);
  const auth=await fetch(BASE()+'/auth/v1/user',{headers:{apikey:KEY(),Authorization:'Bearer '+token},cache:'no-store'});
  if(!auth.ok)return reply('Sesija beigusies. Pieslēdzies vēlreiz.',401);
  const user=await auth.json();
  if(!validUuid(user.id))return reply('Nederīga sesija.',401);
  const owner='?user_id=eq.'+encodeURIComponent(user.id);
  if(action==='list'){
   const [registries,profiles]=await Promise.all([
    rest(TABLE,token,'GET',owner+'&select=id,title,description,filters,included_event_ids,excluded_event_ids,is_published,created_at,updated_at&order=created_at.desc&limit=50'),
    rest('meets_profiles',token,'GET',owner+'&select=display_name')
   ]);
   return NextResponse.json({registries,profile:profiles[0]||{display_name:''},email:user.email},{headers:{'Cache-Control':'no-store'}});
  }
  if(action==='profile'){
   const display_name=String(input.display_name||'').trim();
   if(display_name.length>100)return reply('Profila nosaukums nedrīkst pārsniegt 100 rakstzīmes.');
   const result=await rest('meets_profiles',token,'POST','?on_conflict=user_id',{user_id:user.id,display_name});
   return NextResponse.json({profile:result[0]||{display_name}});
  }
  if(action==='save'){
   const title=String(input.title||'').trim(),description=String(input.description||'').trim();
   if(title.length<3||title.length>120||description.length>500)return reply('Norādi reģistra nosaukumu (3–120 rakstzīmes) un īsu aprakstu.');
   const filters=cleanRegistryFilters(input.filters);
   const included_event_ids=cleanRegistryIds(input.included_event_ids||[]);
   const excluded_event_ids=cleanRegistryIds(input.excluded_event_ids||[]);
   const row={user_id:user.id,title,description,filters,included_event_ids,excluded_event_ids,is_published:input.is_published===true,updated_at:new Date().toISOString()};
   if(input.id&&!validUuid(input.id))return reply('Nederīgs reģistra ID.');
   if(!input.id){
    const existing=await rest(TABLE,token,'GET',owner+'&select=id&limit=51');
    if(existing.length>=50)return reply('Vienam profilam var būt ne vairāk kā 50 reģistri.');
   }
   const saved=input.id
    ?await rest(TABLE,token,'PATCH',owner+'&id=eq.'+input.id,row)
    :await rest(TABLE,token,'POST','',row);
   if(!saved.length)return reply('Reģistrs nav atrasts vai nav tiesību to labot.',404);
   return NextResponse.json({registry:saved[0]},{headers:{'Cache-Control':'no-store'}});
  }
  if(action==='delete'){
   if(!validUuid(input.id))return reply('Nederīgs reģistra ID.');
   const existing=await rest(TABLE,token,'DELETE',owner+'&id=eq.'+input.id);
   return NextResponse.json({ok:existing.length>0},{headers:{'Cache-Control':'no-store'}});
  }
  return reply('Neatbalstīta darbība.');
 }catch(error){
  if(error?.message?.startsWith('Sarakstā drīkst')||error?.message?.startsWith('Nederīgs pasākuma'))return reply(error.message);
  console.error('registry_api_failed',{error:error?.name||'Error'});
  return reply('Neizdevās izpildīt pieprasījumu.',502);
 }
}

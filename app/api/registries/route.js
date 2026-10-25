import {NextResponse} from 'next/server';
import {cleanRegistryFilters,cleanRegistryIds,validUuid} from '../../../lib/registry-filters.js';
export const dynamic='force-dynamic';

const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
const TABLE='meets_embed_registries';

function reply(error,status=400){return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});}
async function rest(table,token,method='GET',query='',payload){
 const headers={apikey:KEY(),Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:query.includes('on_conflict=')?'resolution=merge-duplicates,return=representation':'return=representation'};
 const response=await fetch(BASE()+'/rest/v1/'+table+query,{method,headers,cache:'no-store',
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 if(!response.ok){
  const details=await response.text().catch(()=>'');
  console.error('registries_rest_failed',{table,method,status:response.status,details:details.slice(0,220)});
  throw Error('Datus neizdevās saglabāt vai nolasīt.');
 }
 if(response.status===204)return [];
 const raw=await response.text();
 return raw?JSON.parse(raw):[];
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
    rest(TABLE,token,'GET','?select=id,user_id,organization_id,title,description,filters,included_event_ids,excluded_event_ids,is_published,created_at,updated_at&order=created_at.desc&limit=100'),
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
   if(title.length<3||title.length>120||description.length>500)return reply('Norādi saraksta nosaukumu (3–120 rakstzīmes) un īsu aprakstu.');
   const organization_id=input.organization_id?String(input.organization_id):null;
   if(organization_id&&!validUuid(organization_id))return reply('Nederīga organizācija.');
   const filters=cleanRegistryFilters(input.filters);
   if(organization_id===null&&input.filters?.selection_mode==='manual')filters.selection_mode='manual';
   const included_event_ids=cleanRegistryIds(input.included_event_ids||[]);
   const excluded_event_ids=cleanRegistryIds(input.excluded_event_ids||[]);
   const row={user_id:user.id,organization_id,title,description,filters,included_event_ids,excluded_event_ids,is_published:input.is_published===true,updated_at:new Date().toISOString()};
   if(input.id&&!validUuid(input.id))return reply('Nederīgs saraksta ID.');
   if(!input.id){
    const existing=await rest(TABLE,token,'GET','?select=id&limit=101');
    if(existing.length>=100)return reply('Sasniegts pieejamo sarakstu limits.');
   }
   const saved=input.id
    ?await rest(TABLE,token,'PATCH','?id=eq.'+input.id,row)
    :await rest(TABLE,token,'POST','',row);
   if(!saved.length)return reply('Saraksts nav atrasts vai nav tiesību to labot.',404);
   return NextResponse.json({registry:saved[0]},{headers:{'Cache-Control':'no-store'}});
  }

  if(action==='createQuick'){
   const title=String(input.title||'').trim();
   if(title.length<3||title.length>120)return reply('Saraksta nosaukumam jābūt 3–120 rakstzīmes garam.');
   if(!validUuid(input.event_id))return reply('Nederīgs pasākuma ID.');
   const saved=await rest(TABLE,token,'POST','',{
    user_id:user.id,organization_id:null,title,description:'',filters:{period:'all',selection_mode:'manual'},
    included_event_ids:[input.event_id],excluded_event_ids:[],is_published:false,updated_at:new Date().toISOString()
   });
   return NextResponse.json({registry:saved[0]},{headers:{'Cache-Control':'no-store'}});
  }

  if(action==='toggleEvent'){
   if(!validUuid(input.id)||!validUuid(input.event_id))return reply('Nederīgs saraksta vai pasākuma ID.');
   const found=await rest(TABLE,token,'GET','?id=eq.'+input.id+'&select=id,user_id,organization_id,included_event_ids,excluded_event_ids&limit=1');
   const item=found[0];
   if(!item)return reply('Saraksts nav atrasts vai nav pieejams.',404);
   if(item.organization_id)return reply('Personiskajā izvēlnē var mainīt tikai savus sarakstus.',403);
   const included=new Set(cleanRegistryIds(item.included_event_ids||[]));
   const excluded=new Set(cleanRegistryIds(item.excluded_event_ids||[]));
   if(input.enabled===false){included.delete(input.event_id);excluded.add(input.event_id);}
   else{included.add(input.event_id);excluded.delete(input.event_id);}
   const saved=await rest(TABLE,token,'PATCH','?id=eq.'+input.id,{
    included_event_ids:[...included],excluded_event_ids:[...excluded],updated_at:new Date().toISOString()
   });
   if(!saved.length)return reply('Sarakstu neizdevās atjaunināt.',409);
   return NextResponse.json({registry:saved[0]},{headers:{'Cache-Control':'no-store'}});
  }

  if(action==='delete'){
   if(!validUuid(input.id))return reply('Nederīgs saraksta ID.');
   const existing=await rest(TABLE,token,'DELETE','?id=eq.'+input.id);
   return NextResponse.json({ok:existing.length>0},{headers:{'Cache-Control':'no-store'}});
  }
  return reply('Neatbalstīta darbība.');
 }catch(error){
  if(error?.message?.startsWith('Sarakstā drīkst')||error?.message?.startsWith('Nederīgs pasākuma'))return reply(error.message);
  console.error('registry_api_failed',{error:error?.name||'Error'});
  return reply('Neizdevās izpildīt pieprasījumu.',502);
 }
}

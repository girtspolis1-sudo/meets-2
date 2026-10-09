import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
const TABLES={organizations:'meets_organizations',venues:'meets_venues',submissions:'meets_submissions'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function api(table,token,method='GET',body=null,query=''){
 const headers={apikey:KEY(),Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'};
 const res=await fetch(BASE()+'/rest/v1/'+table+query,{method,headers,...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 if(!res.ok)throw Error('Darbība neizdevās. Pārbaudi ievadītos datus un piekļuves tiesības.');
 return res.json();
}
export async function POST(request){
 try{
  const data=await request.json();
  const {action,token,id}=data;
  if(!BASE()||!KEY())return NextResponse.json({error:'Nav savienojuma ar kontu servisu.'},{status:503});
  if(typeof token!=='string'||!token)return NextResponse.json({error:'Lūdzu, pieslēdzies.'},{status:401});
  const userResponse=await fetch(BASE()+'/auth/v1/user',{headers:{apikey:KEY(),Authorization:'Bearer '+token},cache:'no-store'});
  if(!userResponse.ok)return NextResponse.json({error:'Sesija beigusies. Pieslēdzies atkārtoti.'},{status:401});
  const user=await userResponse.json();
  if(!UUID.test(user.id||''))return NextResponse.json({error:'Nepareiza sesija.'},{status:401});
  if(action==='list'){
   const [organizations,venues,submissions]=await Promise.all([
    api(TABLES.organizations,token,'GET',null,'?select=id,name,kind,owner_id&order=created_at.desc'),
    api(TABLES.venues,token,'GET',null,'?select=id,organization_id,name,address,latitude,longitude,directions,description&order=created_at.desc'),
    api(TABLES.submissions,token,'GET',null,'?select=id,organization_id,venue_id,title,date_from,date_to,time_from,time_to,status,venue_name,address,category,description,price_status,admin_note,latitude,longitude,schedule_kind,recurrence_note&order=created_at.desc')
   ]);
   return NextResponse.json({organizations,venues,submissions});
  }
  if(action==='createOrganization'){
   const name=String(data.name||'').trim();
   if(name.length<2||name.length>160)return NextResponse.json({error:'Organizācijas nosaukumam jābūt 2–160 rakstzīmes garam.'},{status:400});
   if(!['organizer','venue'].includes(data.kind))return NextResponse.json({error:'Izvēlies profila veidu.'},{status:400});
   const result=await api(TABLES.organizations,token,'POST',{name,kind:data.kind,owner_id:user.id});
   return NextResponse.json({item:result[0]});
  }
  if(action==='acceptInvite'){
   if(typeof data.invite_token!=='string'||data.invite_token.length>128)return NextResponse.json({error:'Nederīga uzaicinājuma saite.'},{status:400});
   const result=await api('rpc/meets_org_invite_accept',token,'POST',{p_token:data.invite_token});
   return NextResponse.json({item:result});
  }
  if(!UUID.test(data.organization_id||''))return NextResponse.json({error:'Izvēlies organizāciju.'},{status:400});
  if(action==='team'){
   const result=await api('rpc/meets_org_team',token,'POST',{p_organization_id:data.organization_id});
   return NextResponse.json({team:result});
  }
  if(action==='invite'){
   if(!['admin','editor','viewer'].includes(data.role))return NextResponse.json({error:'Nepareiza loma.'},{status:400});
   const result=await api('rpc/meets_org_invite_create',token,'POST',{p_organization_id:data.organization_id,p_role:data.role});
   return NextResponse.json({invite:result});
  }
  const canEdit=await api('rpc/meets_org_can_edit',token,'POST',{p_org:data.organization_id});
  if(canEdit!==true)return NextResponse.json({error:'Nav tiesību veikt izmaiņas šajā organizācijā.'},{status:403});
  if(action==='createVenue'||action==='updateVenue'){
   const name=String(data.name||'').trim(),address=String(data.address||'').trim();
   if(name.length<2||name.length>160||address.length<5||address.length>300)return NextResponse.json({error:'Norādi vietas nosaukumu un pilnu adresi.'},{status:400});
   const latitude=data.latitude===''||data.latitude==null?null:Number(data.latitude);
   const longitude=data.longitude===''||data.longitude==null?null:Number(data.longitude);
   if((latitude===null)!==(longitude===null)||latitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)))return NextResponse.json({error:'Koordinātām jānorāda gan platums, gan garums.'},{status:400});
   const payload={organization_id:data.organization_id,name,address,latitude,longitude,directions:String(data.directions||'').slice(0,2000),description:String(data.description||'').slice(0,4000)};
   if(action==='updateVenue'&&!UUID.test(data.venue_id||''))return NextResponse.json({error:'Nederīgs vietas ieraksts.'},{status:400});
   const result=await api(TABLES.venues,token,action==='updateVenue'?'PATCH':'POST',payload,action==='updateVenue'?'?id=eq.'+data.venue_id+'&organization_id=eq.'+data.organization_id:'');
   if(!result.length)return NextResponse.json({error:'Vietu nevar labot.'},{status:404});
   return NextResponse.json({item:result[0]});
  }
  if(action==='saveEvent'){
   const title=String(data.title||'').trim(),date_from=String(data.date_from||'');
   if(title.length<3||title.length>200||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date_from))return NextResponse.json({error:'Norādi pasākuma nosaukumu un datumu.'},{status:400});
   if(data.date_to&&data.date_to<date_from)return NextResponse.json({error:'Beigu datums nevar būt pirms sākuma datuma.'},{status:400});
   if(!['draft','pending_review'].includes(data.status))return NextResponse.json({error:'Nepareizs pasākuma statuss.'},{status:400});
   let venue=null;
   if(data.venue_id){if(!UUID.test(data.venue_id))return NextResponse.json({error:'Nepareiza norises vieta.'},{status:400});
    const found=await api(TABLES.venues,token,'GET',null,'?select=*&id=eq.'+data.venue_id+'&organization_id=eq.'+data.organization_id);
    venue=found[0];if(!venue)return NextResponse.json({error:'Norises vieta nav pieejama.'},{status:400});
   }
   const payload={organization_id:data.organization_id,author_id:user.id,venue_id:venue?.id||null,title,description:String(data.description||'').slice(0,6000),schedule_kind:['once','recurring','ongoing'].includes(data.schedule_kind)?data.schedule_kind:'once',recurrence_note:String(data.recurrence_note||'').slice(0,300),category:String(data.category||'Cits').slice(0,100),date_from,date_to:data.date_to||null,time_from:data.time_from||null,time_to:data.time_to||null,venue_name:venue?.name||String(data.venue_name||'').slice(0,200),address:venue?.address||String(data.address||'').slice(0,300),latitude:venue?.latitude??null,longitude:venue?.longitude??null,price_status:['free','paid','mixed','unknown'].includes(data.price_status)?data.price_status:'unknown',status:data.status};
   if(payload.status==='pending_review'&&(!payload.venue_name||!payload.address))return NextResponse.json({error:'Iesniegšanai norādi norises vietu un adresi.'},{status:400});
   let result;
   if(data.id){
    if(!UUID.test(data.id))return NextResponse.json({error:'Nederīgs ieraksts.'},{status:400});
    result=await api(TABLES.submissions,token,'PATCH',{...payload,updated_at:new Date().toISOString()},'?id=eq.'+data.id+'&organization_id=eq.'+data.organization_id);
   }else result=await api(TABLES.submissions,token,'POST',payload);
   if(!result.length)return NextResponse.json({error:'Ierakstu nevar labot tā pašreizējā statusā.'},{status:409});
   return NextResponse.json({item:result[0]});
  }
  return NextResponse.json({error:'Neatbalstīta darbība.'},{status:400});
 }catch(error){return NextResponse.json({error:error.message==='Darbība neizdevās. Pārbaudi ievadītos datus un piekļuves tiesības.'?error.message:'Neizdevās izpildīt pieprasījumu.'},{status:400});}
}

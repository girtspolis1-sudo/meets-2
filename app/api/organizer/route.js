import {validateQuickEvent} from '../../../lib/event-entry.js';
import {cleanSlots,countOccurrences,cleanPrice} from '../../../lib/event-schedule.js';
import {rigaDate} from '../../../lib/meets-personal.js';
import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';
const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
const TABLES={
 organizations:'meets_organizations',
 members:'meets_organization_members',
 venueLinks:'meets_organization_venues',
 venues:'meets_venues',
 submissions:'meets_submissions',contacts:'meets_org_contact_details'
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function coordinates(input){
 const latitude=input.latitude===''||input.latitude==null?null:Number(input.latitude);
 const longitude=input.longitude===''||input.longitude==null?null:Number(input.longitude);
 if((latitude===null)!==(longitude===null))throw Error('Norādi abas koordinātas.');
 if(latitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180))throw Error('Nepareizas kartes koordinātas.');
 return {latitude,longitude};
}
function normalizeVenue(value){
 return String(value||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function duplicatesVenue(a,b){
 const sameName=normalizeVenue(a.name)===normalizeVenue(b.name);
 if(!sameName)return false;
 const sameAddress=normalizeVenue(a.address)===normalizeVenue(b.address)&&normalizeVenue(a.address).length>=5;
 const aLat=Number(a.latitude),aLon=Number(a.longitude),bLat=Number(b.latitude),bLon=Number(b.longitude);
 const close=a.latitude!=null&&a.longitude!=null&&b.latitude!=null&&b.longitude!=null&&
  Math.abs(aLat-bLat)<=0.0006&&Math.abs(aLon-bLon)<=0.001;
 return sameAddress||close;
}
async function api(table,token,method='GET',body=null,query=''){
 const prefer=query.includes('on_conflict=')?'resolution=merge-duplicates,return=representation':'return=representation';
 const headers={apikey:KEY(),Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:prefer};
 const res=await fetch(BASE()+'/rest/v1/'+table+query,{method,headers,...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 if(!res.ok){
  const details=await res.text().catch(()=>'');
  console.error('organizer_rest_failed',{table,method,status:res.status,details:details.slice(0,240)});
  throw Error('Darbība neizdevās. Pārbaudi ievadītos datus un piekļuves tiesības.');
 }
 if(res.status===204)return [];
 const raw=await res.text();
 return raw?JSON.parse(raw):[];
}
async function linkVenue(token,organizationId,venueId,relationType='used'){
 if(!organizationId||!venueId)return;
 await api(TABLES.venueLinks,token,'POST',{
  organization_id:organizationId,venue_id:venueId,relation_type:relationType
 },'?on_conflict=organization_id,venue_id');
}
function publicVenue(item,orgIds){
 return item?.is_public===true&&!orgIds.has(item.organization_id);
}

function cleanOrgContacts(input){
 if(!Array.isArray(input))return [];
 return input.slice(0,25).map(x=>({type:['email','phone','website','facebook','instagram','person','other'].includes(x?.type)?x.type:'other',label:String(x?.label||'').trim().slice(0,80),value:String(x?.value||'').trim().slice(0,254),public:x?.public===true})).filter(x=>x.value);
}
export async function POST(request){
 try{
  const data=await request.json();
  const {action,token}=data;
  if(!BASE()||!KEY())return NextResponse.json({error:'Nav savienojuma ar kontu servisu.'},{status:503});
  if(typeof token!=='string'||!token)return NextResponse.json({error:'Lūdzu, pieslēdzies.'},{status:401});

  const userResponse=await fetch(BASE()+'/auth/v1/user',{headers:{apikey:KEY(),Authorization:'Bearer '+token},cache:'no-store'});
  if(!userResponse.ok)return NextResponse.json({error:'Sesija beigusies. Pieslēdzies atkārtoti.'},{status:401});
  const user=await userResponse.json();
  if(!UUID.test(user.id||''))return NextResponse.json({error:'Nepareiza sesija.'},{status:401});

  if(action==='list'){
   const [organizations,memberships,visibleVenues,submissions,venueLinks,contacts]=await Promise.all([
    api(TABLES.organizations,token,'GET',null,'?select=id,name,kind,owner_id,description,image_url,public_email,public_phone,public_url,is_public,created_at,updated_at&order=created_at.desc'),
    api(TABLES.members,token,'GET',null,'?select=organization_id,role&user_id=eq.'+user.id),
    api(TABLES.venues,token,'GET',null,'?select=id,organization_id,name,address,latitude,longitude,directions,description,is_public,created_at&order=created_at.desc'),
    api(TABLES.submissions,token,'GET',null,'?select=id,organization_id,venue_id,title,date_from,date_to,time_from,time_to,status,venue_name,address,category,description,price_status,price_min,price_max,cover_image_path,recurrence_slots,admin_note,latitude,longitude,schedule_kind,recurrence_note,event_id,created_at,updated_at&order=created_at.desc'),
    api(TABLES.venueLinks,token,'GET',null,'?select=organization_id,venue_id,relation_type,created_at'),
    api(TABLES.contacts,token,'GET',null,'?select=organization_id,address,contacts,contacts_public,address_public,website_public')
   ]);
   const memberRole=new Map((memberships||[]).map(x=>[x.organization_id,x.role]));
   const details=new Map((contacts||[]).map(c=>[c.organization_id,c]));
   const orgs=(organizations||[]).map(org=>({...org,...(details.get(org.id)||{}),role:org.owner_id===user.id?'owner':memberRole.get(org.id)||'viewer'}));
   const orgIds=new Set(orgs.map(org=>org.id));
   const venues=(visibleVenues||[]).filter(v=>orgIds.has(v.organization_id));
   const publicVenues=(visibleVenues||[]).filter(v=>publicVenue(v,orgIds));
   return NextResponse.json({organizations:orgs,venues,publicVenues,venueLinks:venueLinks||[],submissions:submissions||[]});
  }

  if(action==='createOrganization'){
   const name=String(data.name||'').trim();
   const description=String(data.description||'').trim().slice(0,2000);
   if(name.length<2||name.length>160)return NextResponse.json({error:'Organizācijas nosaukumam jābūt 2–160 rakstzīmes garam.'},{status:400});
   const kind=['organizer','venue'].includes(data.kind)?data.kind:'organizer';
   const result=await api(TABLES.organizations,token,'POST',{name,description,kind,owner_id:user.id,is_public:false});
   if(result[0]?.id){await api(TABLES.contacts,token,'POST',{organization_id:result[0].id,address:String(data.address||'').slice(0,300),contacts:cleanOrgContacts(data.contacts),contacts_public:false});}
   return NextResponse.json({item:{...result[0],role:'owner'}});
  }

  if(action==='acceptInvite'){
   if(typeof data.invite_token!=='string'||data.invite_token.length>128)return NextResponse.json({error:'Nederīga uzaicinājuma saite.'},{status:400});
   const result=await api('rpc/meets_org_invite_accept',token,'POST',{p_token:data.invite_token});
   return NextResponse.json({item:result});
  }

  if(!UUID.test(data.organization_id||''))return NextResponse.json({error:'Izvēlies organizāciju.'},{status:400});

  if(action==='saveOrgContacts'){
   const owned=await api(TABLES.organizations,token,'GET',null,'?select=owner_id,is_public&id=eq.'+data.organization_id);
   const mayEdit=await api('rpc/meets_org_can_edit',token,'POST',{p_org:data.organization_id});
   if(!owned.length||mayEdit!==true)return NextResponse.json({error:'Nav tiesību mainīt organizācijas kontaktus.'},{status:403});
   const contacts=cleanOrgContacts(data.contacts);
   const details={organization_id:data.organization_id,address:String(data.address||'').trim().slice(0,300),contacts,contacts_public:data.contacts_public===true&&owned[0].is_public===true,address_public:data.address_public===true,website_public:data.website_public===true,updated_at:new Date().toISOString()};
   const saved=await api(TABLES.contacts,token,'POST',details,'?on_conflict=organization_id');
   return NextResponse.json({item:saved[0]||details});
  }
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

  if(action==='updateOrganization'){
   const name=String(data.name||'').trim();
   const result=await api('rpc/meets_update_organization_profile',token,'POST',{
    p_organization_id:data.organization_id,
    p_name:name,
    p_description:String(data.description||''),
    p_image_url:String(data.image_url||'')||null,
    p_public_email:String(data.public_email||'')||null,
    p_public_phone:String(data.public_phone||'')||null,
    p_public_url:String(data.public_url||'')||null,
    p_is_public:data.is_public===true
   });
   return NextResponse.json({item:result});
  }

  if(action==='useVenue'){
   if(!UUID.test(data.venue_id||''))return NextResponse.json({error:'Nederīga norises vieta.'},{status:400});
   const found=await api(TABLES.venues,token,'GET',null,'?select=id,organization_id,name,address,latitude,longitude,is_public&id=eq.'+data.venue_id);
   const venue=found[0];
   if(!venue||venue.is_public!==true)return NextResponse.json({error:'Publiskā norises vieta nav pieejama.'},{status:404});
   if(venue.organization_id===data.organization_id)await linkVenue(token,data.organization_id,venue.id,'managed');
   else await linkVenue(token,data.organization_id,venue.id,'used');
   return NextResponse.json({item:venue});
  }

  if(action==='createVenue'||action==='updateVenue'){
   const name=String(data.name||'').trim(),address=String(data.address||'').trim();
   const {latitude,longitude}=coordinates(data);
   if(name.length<2||name.length>160||address.length>300||(address.length<5&&latitude===null))return NextResponse.json({error:'Norādi vietas nosaukumu un pilnu adresi vai izvēlies punktu kartē.'},{status:400});
   const locationAddress=address.length>=5?address:`Kartē atzīmēta vieta (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
   const payload={organization_id:data.organization_id,name,address:locationAddress,latitude,longitude,directions:String(data.directions||'').slice(0,2000),description:String(data.description||'').slice(0,4000),is_public:data.is_public===true};
   if(action==='updateVenue'&&!UUID.test(data.venue_id||''))return NextResponse.json({error:'Nederīgs vietas ieraksts.'},{status:400});
   const owned=await api(TABLES.venues,token,'GET',null,'?select=id,name,address,latitude,longitude,organization_id&organization_id=eq.'+data.organization_id);
   const duplicate=owned.find(item=>item.id!==data.venue_id&&duplicatesVenue(payload,item));
   if(duplicate)return NextResponse.json({error:'Šī vieta organizācijā jau ir reģistrēta. Izvēlies to no vietu saraksta vai labo esošo ierakstu.',existingVenueId:duplicate.id},{status:409});
   if(action==='createVenue'){
    const publicMatches=await api(TABLES.venues,token,'GET',null,'?select=id,name,address,latitude,longitude,organization_id,is_public&is_public=eq.true');
    const publicDuplicate=publicMatches.find(item=>item.organization_id!==data.organization_id&&duplicatesVenue(payload,item));
    if(publicDuplicate){
     await linkVenue(token,data.organization_id,publicDuplicate.id,'used');
     return NextResponse.json({item:publicDuplicate,reused_public:true});
    }
   }
   const result=await api(TABLES.venues,token,action==='updateVenue'?'PATCH':'POST',payload,action==='updateVenue'?'?id=eq.'+data.venue_id+'&organization_id=eq.'+data.organization_id:'');
   if(!result.length)return NextResponse.json({error:'Vietu nevar labot.'},{status:404});
   await linkVenue(token,data.organization_id,result[0].id,'managed');
   return NextResponse.json({item:result[0]});
  }

  if(action==='saveEvent'){
   const isDraft=data.status==='draft';
   if(!['draft','pending_review'].includes(data.status))return NextResponse.json({error:'Nepareizs pasākuma statuss.'},{status:400});

   const title=String(data.title||'').trim();
   const date_from=String(data.date_from||'');
   if(title.length>200)return NextResponse.json({error:'Pasākuma nosaukums nedrīkst pārsniegt 200 rakstzīmes.'},{status:400});
   if(!isDraft&&(title.length<3||!DATE.test(date_from)))return NextResponse.json({error:'Norādi pasākuma nosaukumu un datumu.'},{status:400});
   if(isDraft&&date_from&&!DATE.test(date_from))return NextResponse.json({error:'Norādi derīgu pasākuma datumu.'},{status:400});
   if(data.date_to&&(!DATE.test(String(data.date_to))||date_from&&data.date_to<date_from))return NextResponse.json({error:'Beigu datums nevar būt pirms sākuma datuma.'},{status:400});

   const recurring=data.schedule_kind==='recurring';
   let slots=[],pricing;
   try{
    slots=recurring?cleanSlots(data.recurrence_slots):[];
    if(recurring&&!isDraft)countOccurrences(date_from,String(data.date_to||''),slots);
    const incompleteDraft=isDraft&&['paid','mixed'].includes(data.price_status)&&
      (data.price_min==null||data.price_min===''||data.price_max==null||data.price_max==='');
    pricing=incompleteDraft?{price_min:null,price_max:null}:
      cleanPrice(String(data.price_status||'unknown'),data.price_min,data.price_max);
   }catch(error){return NextResponse.json({error:error.message},{status:400});}

   let venue=null;
   if(data.venue_id){
    if(!UUID.test(data.venue_id))return NextResponse.json({error:'Nepareiza norises vieta.'},{status:400});
    const found=await api(TABLES.venues,token,'GET',null,'?select=*&id=eq.'+data.venue_id);
    venue=found[0];
    if(!venue)return NextResponse.json({error:'Norises vieta nav pieejama.'},{status:400});
    if(venue.organization_id!==data.organization_id&&venue.is_public!==true)return NextResponse.json({error:'Šo norises vietu nevar izmantot.'},{status:403});
   }

   let point={latitude:null,longitude:null};
   try{point=venue?{latitude:venue.latitude??null,longitude:venue.longitude??null}:coordinates(data);}
   catch(error){if(!isDraft)return NextResponse.json({error:error.message},{status:400});}

   const enteredAddress=venue?.address||String(data.address||'').trim().slice(0,300);
   const locationAddress=enteredAddress||(point.latitude!==null&&point.longitude!==null?`Kartē atzīmēta vieta (${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)})`:'');
   const payload={
    organization_id:data.organization_id,
    author_id:user.id,
    venue_id:venue?.id||null,
    title,
    description:String(data.description||'').slice(0,6000),
    schedule_kind:['once','recurring','ongoing'].includes(data.schedule_kind)?data.schedule_kind:'once',
    recurrence_note:String(data.recurrence_note||'').slice(0,300),
    category:String(data.category||'Cits').slice(0,100),
    date_from:date_from||null,
    date_to:data.date_to||null,
    time_from:data.time_from||null,
    time_to:data.time_to||null,
    venue_name:venue?.name||String(data.venue_name||'').slice(0,200),
    address:locationAddress,
    ...point,
    price_status:['free','paid','mixed','unknown'].includes(data.price_status)?data.price_status:'unknown',
    ...pricing,
    recurrence_slots:slots,
    status:data.status
   };

   if(!isDraft){
    const problem=validateQuickEvent(recurring?{...payload,time_from:'',time_to:''}:payload);
    if(problem)return NextResponse.json({error:problem},{status:400});
    if(String(payload.date_to||payload.date_from)<rigaDate())return NextResponse.json({error:'Pasākuma beigu datums jau ir pagājis.'},{status:400});
   }

   if(data.save_venue===true&&!venue&&!isDraft){
    const name=payload.venue_name.trim();
    if(name.length<2||name.length>160||!payload.address)
     return NextResponse.json({error:'Lai saglabātu vietu, norādi nosaukumu un adresi vai kartes punktu.'},{status:400});
    const existing=await api(TABLES.venues,token,'GET',null,'?select=id,name,address,latitude,longitude,organization_id,is_public');
    const duplicate=existing.find(item=>item.organization_id===data.organization_id&&duplicatesVenue({name,address:payload.address,...point},item));
    const publicDuplicate=existing.find(item=>item.organization_id!==data.organization_id&&item.is_public===true&&duplicatesVenue({name,address:payload.address,...point},item));
    if(duplicate)payload.venue_id=duplicate.id;
    else if(publicDuplicate){
     payload.venue_id=publicDuplicate.id;
     await linkVenue(token,data.organization_id,publicDuplicate.id,'used');
    }else{
     const created=await api(TABLES.venues,token,'POST',{organization_id:data.organization_id,name,address:payload.address,latitude:point.latitude,longitude:point.longitude,directions:'',description:'',is_public:false});
     if(!created?.[0]?.id)return NextResponse.json({error:'Norises vietu neizdevās saglabāt.'},{status:409});
     payload.venue_id=created[0].id;
     await linkVenue(token,data.organization_id,created[0].id,'managed');
    }
   }

   if(!data.id&&!isDraft){
    const timeFilter=payload.time_from?'&time_from=eq.'+encodeURIComponent(payload.time_from):'&time_from=is.null';
    const same=await api(TABLES.submissions,token,'GET',null,'?select=id&organization_id=eq.'+data.organization_id+'&title=eq.'+encodeURIComponent(payload.title)+'&date_from=eq.'+payload.date_from+timeFilter+'&limit=1');
    if(same.length)return NextResponse.json({error:'Šāds pasākums ar tādu pašu datumu un sākuma laiku jau ir iesniegts. Atver esošo ierakstu vai izmanto dublēšanu ar jauniem datumiem.'},{status:409});
   }

   let result;
   if(data.id){
    if(!UUID.test(data.id))return NextResponse.json({error:'Nederīgs ieraksts.'},{status:400});
    result=await api(TABLES.submissions,token,'PATCH',{...payload,updated_at:new Date().toISOString()},'?id=eq.'+data.id+'&organization_id=eq.'+data.organization_id);
   }else result=await api(TABLES.submissions,token,'POST',payload);

   if(!result.length)return NextResponse.json({error:'Ierakstu nevar labot tā pašreizējā statusā.'},{status:409});
   if(payload.venue_id){
    const relation=venue?.organization_id===data.organization_id?'managed':'used';
    await linkVenue(token,data.organization_id,payload.venue_id,relation);
   }
   return NextResponse.json({item:result[0]});
  }

  return NextResponse.json({error:'Neatbalstīta darbība.'},{status:400});
 }catch(error){
  const safe=['Norādi abas koordinātas.','Nepareizas kartes koordinātas.','Darbība neizdevās. Pārbaudi ievadītos datus un piekļuves tiesības.'];
  return NextResponse.json({error:safe.includes(error?.message)?error.message:'Neizdevās izpildīt pieprasījumu.'},{status:400});
 }
}

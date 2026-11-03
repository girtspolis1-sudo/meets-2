import 'server-only';
const UUID=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function validOrganizerId(value){return typeof value==='string'&&UUID.test(value);}
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// The page address is the organizer's name (/organizatori/balvu-sporta-zale); old id links still work.
export async function publicOrganizer(idOrSlug){
 const wanted=String(idOrSlug||'').toLowerCase();
 if(!validOrganizerId(wanted)&&!(SLUG.test(wanted)&&wanted.length<=80))return null;
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw Error('Organizer catalogue configuration missing');
 let id=wanted;
 if(!validOrganizerId(wanted)){
  const found=await fetch(base+'/rest/v1/rpc/meets_public_organizer_id',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_slug:wanted}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!found.ok)throw Error('Organizer information unavailable');
  id=await found.json();
  if(!validOrganizerId(id))return null;
 }
 const r=await fetch(base+'/rest/v1/rpc/meets_public_organizer_profile',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_organization_id:id}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Organizer information unavailable');
 const value=await r.json();
 if(!value?.organization?.id)return null;
 const details=await fetch(base+'/rest/v1/rpc/meets_public_org_contact_details',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_org:id}),cache:'no-store'}).then(async r=>r.ok?(await r.json())||null:null).catch(()=>null);
 return {...value,contactDetails:details};
}

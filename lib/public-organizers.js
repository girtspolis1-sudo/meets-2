import 'server-only';
const UUID=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function validOrganizerId(value){return typeof value==='string'&&UUID.test(value);}
export async function publicOrganizer(id){
 if(!validOrganizerId(id))return null;
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw Error('Organizer catalogue configuration missing');
 const r=await fetch(base+'/rest/v1/rpc/meets_public_organizer_profile',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_organization_id:id}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Organizer information unavailable');
 const value=await r.json();
 return value?.organization?.id?value:null;
}

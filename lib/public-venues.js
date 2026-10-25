import 'server-only';
const UUID=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
export const validVenueId=value=>typeof value==='string'&&UUID.test(value);
export async function publicVenue(id){
 if(!validVenueId(id))return null;
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw Error('Venue catalogue configuration missing');
 const response=await fetch(base+'/rest/v1/rpc/meets_public_venue',{
  method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
  body:JSON.stringify({p_id:id}),cache:'no-store',signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error('Venue information unavailable');
 const value=await response.json();
 if(!value||!value.id)return null;
 return {...value,events:(Array.isArray(value.events)?value.events:[]).map(e=>{
  const path=typeof e.cover_image_path==='string'&&/^[a-f\d-]+\/[a-f\d-]+\/[a-f\d-]+\.(jpg|png|webp)$/.test(e.cover_image_path)?e.cover_image_path:'';
  return {...e,image_url:path?base+'/storage/v1/object/public/meets-event-images/'+path:null};
 })};
}

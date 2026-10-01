export const dynamic='force-dynamic';

export async function POST(request){
 const authorization=request.headers.get('authorization')||'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
 if(!token||token.length>512){
  return Response.json({valid:false},{headers:{'Cache-Control':'no-store'}});
 }

 const url=process.env.SUPABASE_URL||'';
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
 if(!url||!key){
  return Response.json({valid:false},{status:503,headers:{'Cache-Control':'no-store'}});
 }

 try{
  const response=await fetch(url+'/rest/v1/rpc/meets_admin_session_valid',{
   method:'POST',
   headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify({p_session_token:token}),
   cache:'no-store'
  });
  if(!response.ok)return Response.json({valid:false},{headers:{'Cache-Control':'no-store'}});
  const valid=(await response.json())===true;
  return Response.json({valid},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error(JSON.stringify({event:'admin_session_check_failed',level:'warn',message:String(error?.message||'Session check failed').slice(0,200)}));
  return Response.json({valid:false},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}

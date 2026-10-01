export const dynamic='force-dynamic';

export async function POST(request){
 const authorization=request.headers.get('authorization')||'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
 if(!token||token.length>512)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});

 const url=process.env.SUPABASE_URL||'';
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
 if(!url||!key)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});

 try{
  await fetch(url+'/rest/v1/rpc/meets_admin_logout',{
   method:'POST',
   headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify({p_session_token:token}),
   cache:'no-store'
  });
 }catch(error){
  console.error(JSON.stringify({event:'admin_logout_failed',level:'warn',message:String(error?.message||'Logout failed').slice(0,200)}));
 }

 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}

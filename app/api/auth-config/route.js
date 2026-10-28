// Public Supabase Auth settings for the browser. The publishable key is meant to be
// public; signing in from the browser keeps Supabase's per-IP limits per visitor
// instead of sharing them across every user behind the Vercel server.
export async function GET(){
 const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
 if(!url||!key)return Response.json({error:'Kontu serviss nav konfigurēts.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({url,key},{headers:{'Cache-Control':'public, max-age=3600'}});
}

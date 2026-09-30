function safeText(value,max=300){
 return String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,max);
}

export async function POST(request){
 const fetchSite=request.headers.get('sec-fetch-site');
 if(fetchSite&&!['same-origin','same-site'].includes(fetchSite)){
  return Response.json({error:'Forbidden'},{status:403});
 }
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.toLowerCase().includes('application/json')){
  return Response.json({error:'Unsupported media type'},{status:415});
 }
 const raw=await request.text();
 if(raw.length>4096)return Response.json({error:'Payload too large'},{status:413});

 let body;
 try{body=JSON.parse(raw);}catch{return Response.json({error:'Invalid payload'},{status:400});}

 const report={
  event:'client_render_error',
  level:'error',
  message:safeText(body?.message||'Client render error'),
  digest:safeText(body?.digest||'',120)||null,
  path:safeText(body?.path||'',500)||null,
  deployment:process.env.VERCEL_GIT_COMMIT_SHA||null
 };
 console.error(JSON.stringify(report));
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}

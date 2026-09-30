function safeText(value,max=300){
 return String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,max);
}

export function register(){}

export function onRequestError(error,request,context){
 const report={
  event:'next_request_error',
  level:'error',
  message:safeText(error?.message||'Unhandled server error'),
  digest:safeText(error?.digest||'',120)||null,
  method:safeText(request?.method||'',12)||null,
  path:safeText(request?.path||'',500)||null,
  routePath:safeText(context?.routePath||'',300)||null,
  routeType:safeText(context?.routeType||'',40)||null,
  routerKind:safeText(context?.routerKind||'',40)||null,
  runtime:process.env.NEXT_RUNTIME||'nodejs',
  deployment:process.env.VERCEL_GIT_COMMIT_SHA||null
 };
 console.error(JSON.stringify(report));
}

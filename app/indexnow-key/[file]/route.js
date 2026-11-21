import {validIndexNowKey} from '../../../lib/indexnow.js';

// IndexNow checks that the key file belongs to the site: /indexnow-key/<key>.txt holds the key.
export function GET(_request,{params}){
 return params.then(({file})=>{
  const key=process.env.INDEXNOW_KEY;
  if(!validIndexNowKey(key)||file!==key+'.txt')return new Response('Not found',{status:404});
  return new Response(key,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 });
}

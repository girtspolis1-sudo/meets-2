'use client';
import {useEffect} from 'react';

// Supabase sends people to the site address when the return address it was
// given is not on its allowed list. A session or error in the URL hash is then
// taken on to the page that reads it (lib/auth-client.js readAuthRedirect).
const READERS=['/profils','/mani-pasakumi','/sekosana','/konta-iestatijumi','/atjaunot-paroli'];
export default function AuthReturn(){
 useEffect(()=>{
  const {hash,pathname}=window.location;
  if(!/(^#|&)(access_token|error_code)=/.test(hash))return;
  if(READERS.some(path=>pathname===path||pathname.startsWith(path+'/')))return;
  window.location.replace((/(^#|&)type=recovery(&|$)/.test(hash)?'/atjaunot-paroli':'/profils')+hash);
 },[]);
 return null;
}

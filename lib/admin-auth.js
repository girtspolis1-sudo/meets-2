'use client';
// Admin requests run as the signed-in MEETS account; the database checks that
// the account is in admin_users.
import {freshSession,renewSession,saveSession,currentSession} from './account-store.js';
import {signOut} from './auth-client.js';

async function call(url,key,path,body,accessToken){
 const response=await fetch(url+'/rest/v1/rpc/'+path,{method:'POST',cache:'no-store',
  headers:{apikey:key,'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
  body:JSON.stringify(body||{})});
 const text=await response.text();
 if(!response.ok){const error=new Error(text||('HTTP '+response.status));error.status=response.status;throw error;}
 return text?JSON.parse(text):null;
}

// Every admin RPC still takes the old p_session_token parameter; access now comes from the account token.
export async function adminRpc(url,key,path,body){
 const session=await freshSession();
 if(!session)throw Object.assign(new Error('Lūdzu, pieslēdzies.'),{status:401});
 const payload={...body,p_session_token:null};
 try{return await call(url,key,path,payload,session.access_token);}
 catch(error){
  if(error.status!==401)throw error;
  const renewed=await renewSession();
  if(!renewed)throw error;
  return call(url,key,path,payload,renewed.access_token);
 }
}

// Bearer header for the app's own admin API routes.
export async function adminAuthorization(){
 const session=await freshSession();
 return session?.access_token?'Bearer '+session.access_token:'';
}

export async function signOutAccount(){
 const token=currentSession()?.access_token;
 if(token)await signOut(token);
 saveSession(null);
}

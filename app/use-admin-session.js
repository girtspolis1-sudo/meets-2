'use client';

import {useEffect,useState} from 'react';
import {freshSession,useAccountSession} from '../lib/account-store.js';

// Admin rights belong to the signed-in MEETS account. A confirmed admin is
// remembered per account; a "no" is never cached, because it is often just an
// expired session: after signing in again the same account is checked afresh.
const checks=new Map();
export function forgetAdminCheck(){checks.clear();}

async function checkAccount(){
 const session=await freshSession();
 if(!session?.access_token)return false;
 const response=await fetch('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 return data?.valid===true;
}

export function useAdminSession(){
 const {session,ready}=useAccountSession();
 const userId=session?.user?.id||'';
 const token=session?.access_token||'';
 const [result,setResult]=useState({key:'',isAdmin:false});
 const key=userId&&userId+':'+token;

 useEffect(()=>{
  if(!userId)return;
  let cancelled=false;
  if(!checks.has(userId)){
   const pending=checkAccount().catch(()=>false).then(isAdmin=>{
    if(!isAdmin&&checks.get(userId)===pending)checks.delete(userId);
    return isAdmin;
   });
   checks.set(userId,pending);
  }
  checks.get(userId).then(isAdmin=>{if(!cancelled)setResult({key,isAdmin});});
  return()=>{cancelled=true;};
 },[userId,key]);

 const checked=ready&&(!userId||result.key===key);
 return {isAdmin:Boolean(userId)&&result.key===key&&result.isAdmin,checked};
}

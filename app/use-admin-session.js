'use client';

import {useEffect,useState} from 'react';
import {freshSession,useAccountSession} from '../lib/account-store.js';

// Admin rights belong to the signed-in MEETS account; checked once per account.
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
 const [result,setResult]=useState({userId:'',isAdmin:false});

 useEffect(()=>{
  if(!userId)return;
  let cancelled=false;
  if(!checks.has(userId))checks.set(userId,checkAccount().catch(()=>{checks.delete(userId);return false;}));
  checks.get(userId).then(isAdmin=>{if(!cancelled)setResult({userId,isAdmin});});
  return()=>{cancelled=true;};
 },[userId]);

 const checked=ready&&(!userId||result.userId===userId);
 return {isAdmin:Boolean(userId)&&result.userId===userId&&result.isAdmin,checked};
}

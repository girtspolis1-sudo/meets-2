'use client';
// Shared account session and data cache for the "Mans MEETS" pages.
// The session is read synchronously from localStorage, so a signed-in user never
// sees the sign-in form while a page loads. Account data is kept in memory across
// client navigation and revalidated in the background (stale-while-revalidate).
import {useCallback,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {refreshSession as renewToken} from './auth-client.js';

export const SESSION_KEY='meets_user_session_v1';
const FRESH_MS=30*1000;

function readRaw(){try{return localStorage.getItem(SESSION_KEY)||'';}catch{return '';}}
function subscribeSession(callback){
 window.addEventListener('meets-user-changed',callback);
 window.addEventListener('storage',callback);
 return()=>{window.removeEventListener('meets-user-changed',callback);window.removeEventListener('storage',callback);};
}
function parseSession(raw){
 try{const value=JSON.parse(raw||'null');return value?.access_token?value:null;}catch{return null;}
}
export function currentSession(){return parseSession(readRaw());}

// session: undefined while unknown (server render, hydration), null when signed out.
export function useAccountSession(){
 const raw=useSyncExternalStore(subscribeSession,readRaw,()=>null);
 const session=useMemo(()=>raw===null?undefined:parseSession(raw),[raw]);
 return {session,ready:session!==undefined};
}

export function saveSession(value){
 try{
  if(value?.access_token){
   const expires=value.expires_at||Date.now()+Math.max(60,value.expires_in||3600)*1000;
   localStorage.setItem(SESSION_KEY,JSON.stringify({...value,expires_at:expires}));
  }else{
   localStorage.removeItem(SESSION_KEY);
   clearAccountData();
  }
 }catch{}
 window.dispatchEvent(new Event('meets-user-changed'));
}

async function post(endpoint,body){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'Datus neizdevās ielādēt.');error.status=response.status;throw error;}
 return data;
}

let refreshing=null;
async function refreshSession(session){
 if(!session?.refresh_token)return null;
 refreshing??=renewToken(session.refresh_token)
  .then(value=>{saveSession(value);return currentSession();})
  .catch(()=>null)
  .finally(()=>{refreshing=null;});
 return refreshing;
}

// The stored session, renewed first when its token expires within a minute.
export async function freshSession(){
 const session=currentSession();
 if(session?.expires_at&&session.expires_at-Date.now()<60*1000)return (await refreshSession(session))||session;
 return session;
}
// Renews the stored session now (after a 401); signs out when that fails.
export async function renewSession(){
 const renewed=await refreshSession(currentSession());
 if(!renewed)saveSession(null);
 return renewed;
}

// Calls an account API with the stored session; renews an expired token once.
export async function accountRequest(endpoint,action,fields={}){
 const session=await freshSession();
 if(!session)throw Object.assign(new Error('Lūdzu, pieslēdzies.'),{status:401});
 try{return await post(endpoint,{action,token:session.access_token,...fields});}
 catch(error){
  if(error.status!==401)throw error;
  const renewed=await renewSession();
  if(!renewed)throw error;
  return post(endpoint,{action,token:renewed.access_token,...fields});
 }
}

const entries=new Map();
const listeners=new Set();
function notify(){for(const listener of listeners)listener();}
function entryKey(key){return (currentSession()?.user?.id||'anonymous')+':'+key;}

export function clearAccountData(){entries.clear();notify();}
export function setAccountData(key,update){
 const id=entryKey(key),entry=entries.get(id);
 if(!entry?.data)return;
 entries.set(id,{...entry,data:typeof update==='function'?update(entry.data):update});
 notify();
}
export function invalidateAccountData(key){
 const id=entryKey(key),entry=entries.get(id);
 if(entry){entries.set(id,{...entry,at:0});notify();}
}

const LOADERS={
 list:()=>accountRequest('/api/account','list'),
 dashboard:()=>accountRequest('/api/account','dashboard'),
 registries:()=>accountRequest('/api/registries','list'),
 avatar:()=>accountRequest('/api/account','getProfile')
};

async function load(key){
 const id=entryKey(key),entry=entries.get(id)||{};
 if(entry.promise)return entry.promise;
 const promise=LOADERS[key]()
  .then(data=>{entries.set(id,{data,at:Date.now(),error:null});notify();return data;})
  .catch(error=>{entries.set(id,{...entries.get(id),promise:null,error});notify();throw error;});
 entries.set(id,{...entry,promise});
 return promise;
}

// Cached account data for one loader key: list, dashboard, registries or avatar.
export function useAccountData(key,{enabled=true}={}){
 const [,setVersion]=useState(0);
 useEffect(()=>{const listener=()=>setVersion(v=>v+1);listeners.add(listener);return()=>listeners.delete(listener);},[]);
 const entry=enabled?entries.get(entryKey(key)):null;
 const stale=!entry?.at||Date.now()-entry.at>FRESH_MS;
 useEffect(()=>{if(enabled&&stale&&!entry?.promise&&!entry?.error)load(key).catch(()=>{});},[enabled,key,stale,entry?.promise,entry?.error]);
 const reload=useCallback(()=>{const id=entryKey(key);entries.set(id,{...entries.get(id),at:0,error:null,promise:null});return load(key);},[key]);
 return {data:entry?.data,error:entry?.error||null,loading:enabled&&!entry?.data&&!entry?.error,reload};
}

// Saving or following from the map and catalogue happens outside these hooks.
if(typeof window!=='undefined'){
 window.addEventListener('meets-favorites-changed',()=>invalidateAccountData('list'));
 window.addEventListener('meets-location-follows-changed',()=>invalidateAccountData('dashboard'));
}

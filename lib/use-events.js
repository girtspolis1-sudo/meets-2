'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
const REFRESH_MS=5*60*1000;
// The last catalogue stays in memory across client navigation, so moving
// between pages shows events at once instead of reloading them every time.
const cache={};
export function useEvents({includePending=false}={}) {
 const key=includePending?'pending':'public';
 const [data,setData]=useState(()=>cache[key]?.data||null),[loading,setLoading]=useState(()=>!cache[key]),[error,setError]=useState('');
 const active=useRef(null);
 const refresh=useCallback(async()=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  // Background refreshes keep showing the current events instead of a loading state.
  if(!cache[key])setLoading(true);setError('');
  try {
   const url=includePending?'/api/events?includePending=1':'/api/events';
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');
   const result=await response.json();if(!Array.isArray(result.events))throw new Error('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');
   cache[key]={data:result,at:Date.now()};
   if(!controller.signal.aborted)setData(result);
  }catch(e){if(!controller.signal.aborted)setError('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[includePending,key]);
 // The catalogue changes a few times a day: refresh every 5 minutes while visible,
 // and once when a tab that has been hidden longer than that becomes visible again.
 const loadedAt=useRef(cache[key]?.at||0);
 useEffect(()=>{
  const reload=()=>{loadedAt.current=Date.now();refresh();};
  const stale=()=>Date.now()-loadedAt.current>=REFRESH_MS;
  const onVisible=()=>{if(document.visibilityState==='visible'&&stale())reload();};
  if(stale())reload();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')reload();},REFRESH_MS);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);active.current?.abort();};
 },[refresh]);
 return {data,loading,error,refresh};
}

'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
const REFRESH_MS=5*60*1000;
export function useEvents({includePending=false}={}) {
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const active=useRef(null);
 const refresh=useCallback(async()=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  setLoading(true);setError('');
  try {
   const url=includePending?'/api/events?includePending=1':'/api/events';
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');
   const result=await response.json();if(!Array.isArray(result.events))throw new Error('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');
   if(!controller.signal.aborted)setData(result);
  }catch(e){if(!controller.signal.aborted)setError('Pasākumus pašlaik neizdevās ielādēt. Mēģini vēlreiz.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[includePending]);
 // The catalogue changes a few times a day: refresh every 5 minutes while visible,
 // and once when a tab that has been hidden longer than that becomes visible again.
 const loadedAt=useRef(0);
 useEffect(()=>{
  const reload=()=>{loadedAt.current=Date.now();refresh();};
  const stale=()=>Date.now()-loadedAt.current>=REFRESH_MS;
  const onVisible=()=>{if(document.visibilityState==='visible'&&stale())reload();};
  reload();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')reload();},REFRESH_MS);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);active.current?.abort();};
 },[refresh]);
 return {data,loading,error,refresh};
}

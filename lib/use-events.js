'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
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
 useEffect(()=>{refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);return()=>{clearInterval(timer);active.current?.abort();};},[refresh]);
 return {data,loading,error,refresh};
}

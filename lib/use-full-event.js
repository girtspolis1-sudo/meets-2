'use client';
import {useEffect,useState} from 'react';
import {fullEventUrl} from './catalog-wire.js';

// The list payload carries a shortened description and no detail-only fields.
// Detail views load the full public record of one event and merge it in.
const loaded=new Map();

export async function loadFullEvent(event){
 const id=event?.id;
 if(!id)return event;
 if(!loaded.has(id)){
  const pending=fetch(fullEventUrl(id),{signal:AbortSignal.timeout(10000)})
   .then(response=>response.ok?response.json():null)
   .then(body=>body?.event||null)
   .catch(()=>null)
   .then(full=>{if(!full)loaded.delete(id);return full;});
  loaded.set(id,pending);
 }
 const full=await loaded.get(id);
 return full?{...event,...full,description_more:false}:event;
}

// Returns the event, replaced by its full record once loaded. While loading, or
// if loading fails, the list version is shown, so the view never goes blank.
export function useFullEvent(event,enabled=true){
 const [state,setState]=useState({id:null,event:null});
 const id=event?.id;
 useEffect(()=>{
  if(!enabled||!id)return;
  let cancelled=false;
  loadFullEvent(event).then(full=>{if(!cancelled)setState({id,event:full});});
  return()=>{cancelled=true;};
 // The list object changes on every refresh; the record only depends on the id.
 },[id,enabled]);
 const ready=state.id===id&&state.event;
 return {event:ready?{...event,...state.event}:event,loading:enabled&&Boolean(id)&&!ready};
}

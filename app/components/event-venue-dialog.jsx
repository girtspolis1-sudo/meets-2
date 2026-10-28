'use client';
import {useEffect,useRef,useState} from 'react';
import VenueLocationPicker from '../organizators/venue-location-picker.jsx';
import {QUICK_VENUE_EMPTY,validateQuickVenue,isCoordinatePair} from '../../lib/event-entry.js';

export default function EventVenueDialog({open,onClose,onSave,busy=false,existingVenues=[],publicVenues=[]}){
 const ref=useRef(null),firstInput=useRef(null);
 const [draft,setDraft]=useState({...QUICK_VENUE_EMPTY});
 const [chosenId,setChosenId]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open){
   setDraft({...QUICK_VENUE_EMPTY});setChosenId('');setError('');
   if(!dialog.open)dialog.showModal();
   firstInput.current?.focus();
  }else if(dialog.open)dialog.close();
  return()=>{if(dialog.open)dialog.close();};
 },[open]);
 function pick(place){
  const existing=[...existingVenues,...publicVenues].find(v=>v.id===place.venueId);
  setChosenId(existing?.id||'');
  setDraft(prev=>({...prev,
   name:existing?.name||place.name||prev.name,
   address:existing?.address||place.address||'',
   latitude:existing?.latitude??place.latitude??'',
   longitude:existing?.longitude??place.longitude??''
  }));
  setError('');
 }
 async function commit(){
  if(busy)return;
  const issue=chosenId?'':validateQuickVenue(draft);
  if(issue){setError(issue);return;}
  if(!chosenId&&!isCoordinatePair(draft)&&draft.address.trim().length<5){
   setError('Norādi adresi vai atzīmē precīzu punktu kartē.');return;
  }
  try{await onSave({...draft,venue_id:chosenId});onClose();}
  catch(e){setError(e.message||'Adresi neizdevās saglabāt.');}
 }
 return <dialog ref={ref} className="event-address-dialog"
  aria-labelledby="event-address-dialog-title"
  onCancel={e=>{if(busy){e.preventDefault();return;}e.preventDefault();onClose();}}
  onClick={e=>{if(e.target===ref.current&&!busy)onClose();}}>
  <div className="event-address-dialog-content">
   <div className="event-address-dialog-heading">
    <div><p className="eyebrow">ORGANIZATORA ADRESES</p><h2 id="event-address-dialog-title">Pievienot jaunu adresi</h2>
     <p>Atrodi adresi, izvēlies punktu kartē un saglabā organizatora sarakstā.</p></div>
    <button type="button" className="event-address-dialog-close" aria-label="Aizvērt" disabled={busy} onClick={onClose}>×</button>
   </div>
   <label className="event-address-dialog-name">Vietas nosaukums *
    <input ref={firstInput} type="text" maxLength={160} minLength={2} value={draft.name}
     placeholder="Piemēram, Sporta halle" onChange={e=>{setChosenId('');setDraft(v=>({...v,name:e.target.value}));setError('');}}/>
   </label>
   <VenueLocationPicker
    value={{name:draft.name,address:draft.address,latitude:draft.latitude,longitude:draft.longitude,venueId:chosenId}}
    existingVenues={existingVenues} publicVenues={publicVenues} onSelect={pick}/>
   {!!(draft.address||isCoordinatePair(draft))&&<div className="event-address-dialog-selected" role="status">
    <strong>{draft.address||'Kartē izvēlēts punkts'}</strong>
    {isCoordinatePair(draft)&&<small>{Number(draft.latitude).toFixed(6)}, {Number(draft.longitude).toFixed(6)}</small>}
   </div>}
   {error&&<p role="alert" className="meets-inline-error">{error}</p>}
   <div className="event-address-dialog-actions">
    <button type="button" className="button" disabled={busy} onClick={onClose}>Atcelt</button>
    <button type="button" className="button primary" disabled={busy} onClick={commit}>{busy?'Saglabā…':chosenId?'Izvēlēties šo adresi':'Saglabāt adresi un turpināt'}</button>
   </div>
  </div>
 </dialog>;
}

'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

const ADMIN_EMAIL='girts.polis@icloud.com';
const SESSION_KEY='meets_admin_access_token';
const LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function loadLeaflet(){
 return new Promise((resolve,reject)=>{
  if(window.L)return resolve(window.L);
  if(!document.querySelector('link[data-leaflet]')){
   const link=document.createElement('link');
   link.rel='stylesheet';link.href=LEAFLET_CSS;link.dataset.leaflet='1';
   document.head.appendChild(link);
  }
  const existing=document.querySelector('script[data-leaflet]');
  if(existing){
   existing.addEventListener('load',()=>resolve(window.L),{once:true});
   existing.addEventListener('error',reject,{once:true});
   return;
  }
  const script=document.createElement('script');
  script.src=LEAFLET_JS;script.async=true;script.dataset.leaflet='1';
  script.onload=()=>resolve(window.L);script.onerror=reject;
  document.head.appendChild(script);
 });
}

function dateText(v){
 if(!v)return '—';
 const d=new Date(v+'T12:00:00');
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}

function sourceText(event){
 return (event.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'—';
}

async function apiFetch(url,key,token,path,body){
 const response=await fetch(url+'/rest/v1/rpc/'+path,{
  method:'POST',
  headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body||{}),
  cache:'no-store'
 });
 const text=await response.text();
 if(!response.ok)throw new Error(text||('HTTP '+response.status));
 return text?JSON.parse(text):null;
}

function parseAuthHash(){
 const hash=window.location.hash.replace(/^#/,'');
 if(!hash)return null;
 const p=new URLSearchParams(hash);
 const token=p.get('access_token');
 if(token){
  sessionStorage.setItem(SESSION_KEY,token);
  history.replaceState(null,'',window.location.pathname+window.location.search);
 }
 return token;
}

export default function AdminDashboard({supabaseUrl,publishableKey}){
 const [token,setToken]=useState('');
 const [authChecked,setAuthChecked]=useState(false);
 const [isAdmin,setIsAdmin]=useState(false);
 const [message,setMessage]=useState('');
 const [events,setEvents]=useState([]);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('pending_review');
 const [editing,setEditing]=useState(null);

 async function checkAdmin(activeToken){
  if(!activeToken){setAuthChecked(true);return;}
  try{
   const ok=await apiFetch(supabaseUrl,publishableKey,activeToken,'meets_is_admin',{});
   setIsAdmin(ok===true);
   if(ok===true)await loadEvents(activeToken);
   else setMessage('Šim kontam nav MEETS admin tiesību.');
  }catch{
   sessionStorage.removeItem(SESSION_KEY);
   setToken('');setIsAdmin(false);
  }finally{
   setAuthChecked(true);
  }
 }

 async function loadEvents(activeToken=token){
  if(!activeToken)return;
  setLoading(true);
  try{
   const data=await apiFetch(supabaseUrl,publishableKey,activeToken,'meets_admin_catalog',{});
   setEvents(Array.isArray(data?.events)?data.events:[]);
   setMessage('');
  }catch{
   setMessage('Admin datus neizdevās ielādēt.');
  }finally{
   setLoading(false);
  }
 }

 useEffect(()=>{
  const active=parseAuthHash()||sessionStorage.getItem(SESSION_KEY)||'';
  setToken(active);
  checkAdmin(active);
 },[]);

 async function sendMagicLink(){
  setMessage('Sūtām pieslēgšanās saiti…');
  try{
   const redirect=window.location.origin+'/admin';
   const response=await fetch(supabaseUrl+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{
    method:'POST',
    headers:{apikey:publishableKey,'Content-Type':'application/json'},
    body:JSON.stringify({email:ADMIN_EMAIL,create_user:true})
   });
   if(!response.ok)throw new Error();
   setMessage('Pieslēgšanās saite nosūtīta uz '+ADMIN_EMAIL+'. Atver to šajā pārlūkā.');
  }catch{
   setMessage('Pieslēgšanās saiti neizdevās nosūtīt.');
  }
 }

 async function changeStatus(event,newStatus){
  setLoading(true);
  try{
   await apiFetch(supabaseUrl,publishableKey,token,'meets_admin_update_event',{
    p_event_id:event.id,p_status:newStatus,p_venue_name:null,p_latitude:null,p_longitude:null
   });
   await loadEvents();
   setMessage(newStatus==='published'?'Pasākums publicēts.':'Pasākuma statuss atjaunots.');
  }catch{
   setMessage('Statusu neizdevās mainīt.');
  }finally{setLoading(false);}
 }

 function logout(){
  sessionStorage.removeItem(SESSION_KEY);
  setToken('');setIsAdmin(false);setEvents([]);setAuthChecked(true);
 }

 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('lv');
  return events.filter(e=>
   (!status||e.status===status)&&
   (!q||[e.title,e.venue_name,e.municipality,e.settlement,sourceText(e)].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q)))
  ).sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title).localeCompare(String(b.title),'lv'));
 },[events,search,status]);

 const counts=useMemo(()=>events.reduce((acc,e)=>{acc[e.status]=(acc[e.status]||0)+1;return acc;},{}),[events]);

 if(!authChecked)return <div className="admin-login"><p>Pārbaudām admin piekļuvi…</p></div>;

 if(!token||!isAdmin){
  return <div className="admin-login">
   <h2>Admin pieslēgšanās</h2>
   <p>Piekļuve paredzēta tikai <strong>{ADMIN_EMAIL}</strong>.</p>
   <button className="button primary" onClick={sendMagicLink}>Nosūtīt magic link</button>
   {message&&<p className="sync-text" role="status">{message}</p>}
  </div>;
 }

 return <>
  <div className="admin-summary">
   <article><strong>{events.length}</strong><span>Kopā</span></article>
   <article><strong>{counts.pending_review||0}</strong><span>Jāpārbauda</span></article>
   <article><strong>{counts.published||0}</strong><span>Publicēti</span></article>
   <article><strong>{events.filter(e=>e.latitude==null||e.longitude==null).length}</strong><span>Bez koordinātām</span></article>
  </div>

  <div className="admin-toolbar">
   <label>Meklēt<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nosaukums, vieta, avots…"/></label>
   <label>Statuss<select value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">Visi</option>
    <option value="pending_review">Pending review</option>
    <option value="published">Published</option>
    <option value="cancelled">Cancelled</option>
    <option value="archived">Archived</option>
    <option value="draft">Draft</option>
   </select></label>
   <button className="button" onClick={()=>loadEvents()} disabled={loading}>{loading?'Ielādē…':'Pārlasīt'}</button>
   <button className="text-button" onClick={logout}>Iziet</button>
  </div>

  {message&&<p className="sync-text" role="status">{message}</p>}

  <div className="table-scroll" role="region" aria-label="Admin pasākumu tabula" tabIndex={0}>
   <table className="events-table admin-events-table">
    <thead><tr>
     <th>Datums</th><th>Pasākums</th><th>Statuss</th><th>Vieta</th><th>Pašvaldība</th><th>Koordinātas</th><th>Avots</th><th>Darbības</th>
    </tr></thead>
    <tbody>
     {filtered.map(event=><tr key={event.id}>
      <td>{dateText(event.date_from)}</td>
      <td><strong>{event.title}</strong></td>
      <td><span className={'badge '+event.status}>{event.status}</span></td>
      <td>{event.venue_name||event.address_raw||'—'}</td>
      <td>{event.municipality||'—'}</td>
      <td>{event.latitude!=null&&event.longitude!=null?Number(event.latitude).toFixed(5)+', '+Number(event.longitude).toFixed(5):'—'}</td>
      <td>{sourceText(event)}</td>
      <td><div className="admin-actions">
       {event.status!=='published'&&<button className="text-button" onClick={()=>changeStatus(event,'published')}>Publicēt</button>}
       {event.status==='published'&&<button className="text-button" onClick={()=>changeStatus(event,'pending_review')}>Atgriezt pārbaudei</button>}
       <button className="text-button" onClick={()=>setEditing(event)}>Labot lokāciju</button>
      </div></td>
     </tr>)}
    </tbody>
   </table>
  </div>
  <p className="sync-text"><strong>{filtered.length}</strong> no {events.length} ierakstiem.</p>

  {editing&&<LocationEditor
   event={editing}
   close={()=>setEditing(null)}
   save={async values=>{
    setLoading(true);
    try{
     await apiFetch(supabaseUrl,publishableKey,token,'meets_admin_update_event',{
      p_event_id:editing.id,p_status:null,p_venue_name:values.venueName,
      p_latitude:Number(values.latitude),p_longitude:Number(values.longitude)
     });
     setEditing(null);
     await loadEvents();
     setMessage('Lokācija saglabāta.');
    }catch{
     setMessage('Lokāciju neizdevās saglabāt.');
    }finally{setLoading(false);}
   }}
  />}
 </>;
}

function LocationEditor({event,close,save}){
 const dialog=useRef(null);
 const mapEl=useRef(null);
 const mapRef=useRef(null);
 const markerRef=useRef(null);
 const [venueName,setVenueName]=useState(event.venue_name||event.address_raw||'');
 const [latitude,setLatitude]=useState(event.latitude??56.95);
 const [longitude,setLongitude]=useState(event.longitude??24.1);

 useEffect(()=>{
  dialog.current?.showModal();
  let cancelled=false;
  loadLeaflet().then(L=>{
   if(cancelled||!mapEl.current)return;
   const map=L.map(mapEl.current,{minZoom:5,maxBounds:[[53.5,16],[60.8,31.5]],maxBoundsViscosity:1}).setView([Number(latitude),Number(longitude)],12);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
   const marker=L.marker([Number(latitude),Number(longitude)],{draggable:true}).addTo(map);
   function apply(latlng){setLatitude(latlng.lat.toFixed(6));setLongitude(latlng.lng.toFixed(6));marker.setLatLng(latlng);}
   map.on('click',e=>apply(e.latlng));
   marker.on('dragend',()=>apply(marker.getLatLng()));
   mapRef.current=map;markerRef.current=marker;
  });
  return()=>{cancelled=true;mapRef.current?.remove();};
 },[]);

 function syncMarker(){
  const lat=Number(latitude),lon=Number(longitude);
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&markerRef.current&&mapRef.current){
   markerRef.current.setLatLng([lat,lon]);mapRef.current.panTo([lat,lon]);
  }
 }

 return <dialog ref={dialog} className="event-dialog location-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><div><p className="eyebrow">Lokācijas labošana</p><h2>{event.title}</h2></div><button className="button" onClick={close}>Aizvērt ✕</button></div>
  <div className="location-form">
   <label>Norises vietas nosaukums<input value={venueName} onChange={e=>setVenueName(e.target.value)}/></label>
   <label>Latitude<input type="number" step="0.000001" value={latitude} onChange={e=>setLatitude(e.target.value)} onBlur={syncMarker}/></label>
   <label>Longitude<input type="number" step="0.000001" value={longitude} onChange={e=>setLongitude(e.target.value)} onBlur={syncMarker}/></label>
  </div>
  <p className="sync-text">Klikšķini kartē vai pārvelc marķieri uz pareizo vietu.</p>
  <div ref={mapEl} className="admin-location-map"/>
  <div className="actions"><button className="button primary" onClick={()=>save({venueName,latitude,longitude})}>Saglabāt lokāciju</button><button className="button" onClick={close}>Atcelt</button></div>
 </dialog>;
}

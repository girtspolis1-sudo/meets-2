'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

const ADMIN_EMAIL='girts.polis@icloud.com';
const SESSION_KEY='meets_admin_access_token';
const LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

const QUALITY={
 verified_exact:{label:'Precīzi verificēta',tone:'ok',priority:6},
 source_exact:{label:'Precīza pēc avota, jāpārbauda',tone:'warn',priority:5},
 venue_unverified:{label:'Punkts nav verificēts',tone:'warn',priority:4},
 venue_area:{label:'Aptuvena norises vieta',tone:'warn',priority:3},
 fallback_center:{label:'Pilsētas/pašvaldības centrs',tone:'bad',priority:2},
 missing_point:{label:'Nav koordinātu',tone:'bad',priority:1}
};

function qualityMeta(value){return QUALITY[value]||{label:value||'Nav novērtēts',tone:'bad',priority:0};}
function loadLeaflet(){
 return new Promise((resolve,reject)=>{
  if(window.L)return resolve(window.L);
  if(!document.querySelector('link[data-leaflet]')){
   const link=document.createElement('link');link.rel='stylesheet';link.href=LEAFLET_CSS;link.dataset.leaflet='1';document.head.appendChild(link);
  }
  const existing=document.querySelector('script[data-leaflet]');
  if(existing){existing.addEventListener('load',()=>resolve(window.L),{once:true});existing.addEventListener('error',reject,{once:true});return;}
  const script=document.createElement('script');script.src=LEAFLET_JS;script.async=true;script.dataset.leaflet='1';
  script.onload=()=>resolve(window.L);script.onerror=reject;document.head.appendChild(script);
 });
}
function dateText(v){
 if(!v)return '—';
 const d=new Date(v+'T12:00:00');
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}
function sourceText(event){return (event.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'—';}
function sourceLinks(event){return (event.sources||[]).filter(s=>s?.url);}
async function apiFetch(url,key,path,body){
 const response=await fetch(url+'/rest/v1/rpc/'+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body||{}),cache:'no-store'});
 const text=await response.text();
 if(!response.ok)throw new Error(text||('HTTP '+response.status));
 return text?JSON.parse(text):null;
}

export default function AdminDashboard({supabaseUrl,publishableKey}){
 const [token,setToken]=useState('');
 const [password,setPassword]=useState('');
 const [authChecked,setAuthChecked]=useState(false);
 const [isAdmin,setIsAdmin]=useState(false);
 const [message,setMessage]=useState('');
 const [events,setEvents]=useState([]);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('pending_review');
 const [quality,setQuality]=useState('');
 const [editing,setEditing]=useState(null);

 async function checkAdmin(activeToken){
  if(!activeToken){setAuthChecked(true);return;}
  try{
   const ok=await apiFetch(supabaseUrl,publishableKey,'meets_admin_session_valid',{p_session_token:activeToken});
   setIsAdmin(ok===true);
   if(ok===true)await loadEvents(activeToken);
   else{sessionStorage.removeItem(SESSION_KEY);setToken('');setIsAdmin(false);}
  }catch{sessionStorage.removeItem(SESSION_KEY);setToken('');setIsAdmin(false);}
  finally{setAuthChecked(true);}
 }
 async function loadEvents(activeToken=token){
  if(!activeToken)return;
  setLoading(true);
  try{
   const data=await apiFetch(supabaseUrl,publishableKey,'meets_admin_catalog',{p_session_token:activeToken});
   setEvents(Array.isArray(data?.events)?data.events:[]);setMessage('');
  }catch{setMessage('Admin datus neizdevās ielādēt.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  const active=sessionStorage.getItem(SESSION_KEY)||'';
  setToken(active);checkAdmin(active);
 },[]);
 async function login(event){
  event.preventDefault();
  if(!password){setMessage('Ievadi paroli.');return;}
  setLoading(true);setMessage('');
  try{
   const sessionToken=await apiFetch(supabaseUrl,publishableKey,'meets_admin_login',{p_password:password});
   if(!sessionToken||typeof sessionToken!=='string')throw new Error();
   sessionStorage.setItem(SESSION_KEY,sessionToken);
   setToken(sessionToken);setPassword('');setIsAdmin(true);await loadEvents(sessionToken);
  }catch{setMessage('Nepareiza parole.');}
  finally{setLoading(false);setAuthChecked(true);}
 }
 async function changeStatus(event,newStatus){
  if(newStatus==='published'&&event.location_quality!=='verified_exact'){
   setMessage('Publicēt drīkst tikai pasākumu ar precīzi verificētu lokāciju. Vispirms izlabo/verificē vietu.');
   return;
  }
  setLoading(true);
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_event',{
    p_session_token:token,p_event_id:event.id,p_status:newStatus,p_venue_name:null,p_latitude:null,p_longitude:null
   });
   await loadEvents();setMessage(newStatus==='published'?'Pasākums publicēts.':'Pasākuma statuss atjaunots.');
  }catch{setMessage('Statusu neizdevās mainīt.');}
  finally{setLoading(false);}
 }
 async function saveLocation(event,values,publish){
  setLoading(true);
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_event',{
    p_session_token:token,p_event_id:event.id,p_status:publish?'published':null,p_venue_name:values.venueName,
    p_latitude:Number(values.latitude),p_longitude:Number(values.longitude)
   });
   setEditing(null);await loadEvents();
   setMessage(publish?'Lokācija verificēta un pasākums publicēts.':'Lokācija verificēta. Pasākums paliek pārbaudē līdz publicēšanai.');
  }catch{setMessage('Lokāciju neizdevās saglabāt.');}
  finally{setLoading(false);}
 }
 async function logout(){
  try{if(token)await apiFetch(supabaseUrl,publishableKey,'meets_admin_logout',{p_session_token:token});}catch{}
  sessionStorage.removeItem(SESSION_KEY);setToken('');setIsAdmin(false);setEvents([]);setAuthChecked(true);
 }

 const counts=useMemo(()=>{
  const byStatus={},byQuality={};
  for(const e of events){byStatus[e.status]=(byStatus[e.status]||0)+1;byQuality[e.location_quality]=(byQuality[e.location_quality]||0)+1;}
  return {byStatus,byQuality};
 },[events]);

 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('lv');
  return events.filter(e=>
   (!status||e.status===status)&&
   (!quality||e.location_quality===quality)&&
   (!q||[e.title,e.venue_name,e.address_raw,e.municipality,e.settlement,e.location_review_reason,sourceText(e)].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q)))
  ).sort((a,b)=>{
   const qa=qualityMeta(a.location_quality).priority,qb=qualityMeta(b.location_quality).priority;
   if(qa!==qb)return qa-qb;
   return String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title).localeCompare(String(b.title),'lv');
  });
 },[events,search,status,quality]);

 if(!authChecked)return <div className="admin-login"><p>Pārbaudām admin piekļuvi…</p></div>;
 if(!token||!isAdmin){
  return <form className="admin-login" onSubmit={login}>
   <h2>Admin pieslēgšanās</h2>
   <p>Pagaidu paroles režīms. Admins: <strong>{ADMIN_EMAIL}</strong>.</p>
   <label>Parole<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" autoFocus/></label>
   <div className="actions"><button className="button primary" type="submit" disabled={loading}>{loading?'Pārbaudām…':'Ieiet'}</button></div>
   {message&&<p className="sync-text" role="status">{message}</p>}
  </form>;
 }

 return <>
  <div className="admin-summary location-summary">
   <article><strong>{counts.byStatus.published||0}</strong><span>Publicēti ar verificētu vietu</span></article>
   <article><strong>{counts.byStatus.pending_review||0}</strong><span>Gaida pārbaudi</span></article>
   <article><strong>{counts.byQuality.fallback_center||0}</strong><span>Tikai centra fallback</span></article>
   <article><strong>{counts.byQuality.missing_point||0}</strong><span>Nav koordinātu</span></article>
   <article><strong>{counts.byQuality.source_exact||0}</strong><span>Precīzi pēc avota, jāverificē</span></article>
  </div>

  <div className="admin-toolbar admin-toolbar-wide">
   <label>Meklēt<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pasākums, vieta, problēma, avots…"/></label>
   <label>Statuss<select value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">Visi</option><option value="pending_review">Pending review</option><option value="published">Published</option>
    <option value="cancelled">Cancelled</option><option value="archived">Archived</option><option value="draft">Draft</option>
   </select></label>
   <label>Lokācijas kvalitāte<select value={quality} onChange={e=>setQuality(e.target.value)}>
    <option value="">Visas</option>
    {Object.entries(QUALITY).map(([value,meta])=><option key={value} value={value}>{meta.label}</option>)}
   </select></label>
   <button className="button" onClick={()=>loadEvents()} disabled={loading}>{loading?'Ielādē…':'Pārlasīt'}</button>
   <button className="text-button" onClick={logout}>Iziet</button>
  </div>

  <p className="admin-rule"><strong>Publicēšanas noteikums:</strong> publiskajā kartē drīkst nonākt tikai <code>verified_exact</code>. Pārējos ierakstos redzams iemesls, kas jānovērš.</p>
  {message&&<p className="sync-text" role="status">{message}</p>}

  <div className="table-scroll" role="region" aria-label="Admin pasākumu tabula" tabIndex={0}>
   <table className="events-table admin-events-table location-review-table">
    <thead><tr>
     <th>Datums</th><th>Pasākums</th><th>Lokācijas kvalitāte</th><th>Kāpēc jāpārbauda</th><th>Norises vieta</th><th>Avots</th><th>Darbības</th>
    </tr></thead>
    <tbody>
     {filtered.map(event=>{
      const meta=qualityMeta(event.location_quality);
      return <tr key={event.id} className={event.location_quality==='verified_exact'?'location-ok':'location-needs-review'}>
       <td>{dateText(event.date_from)}</td>
       <td><strong>{event.title}</strong><small className="table-subline">{event.status}</small></td>
       <td><span className={'quality-badge '+meta.tone}>{meta.label}</span></td>
       <td className="reason-cell">{event.location_review_reason||'Lokācija verificēta.'}</td>
       <td>
        <strong>{event.venue_name||event.address_raw||'—'}</strong>
        <small className="table-subline">{event.address_raw&&event.address_raw!==event.venue_name?event.address_raw+' · ':''}{event.municipality||event.settlement||''}</small>
        <small className="table-subline">{event.latitude!=null&&event.longitude!=null?Number(event.latitude).toFixed(5)+', '+Number(event.longitude).toFixed(5):'Nav koordinātu'}</small>
       </td>
       <td>{sourceLinks(event).length?sourceLinks(event).map((s,i)=><span key={(s.url||'')+i} className="source-link-row"><a href={s.url} target="_blank" rel="noreferrer">{s.source||'Avots'} ↗</a></span>):sourceText(event)}</td>
       <td><div className="admin-actions">
        {event.location_quality==='verified_exact'&&event.status!=='published'&&<button className="text-button strong-action" onClick={()=>changeStatus(event,'published')}>Publicēt</button>}
        {event.status==='published'&&<button className="text-button" onClick={()=>changeStatus(event,'pending_review')}>Atgriezt pārbaudei</button>}
        <button className="button compact" onClick={()=>setEditing(event)}>{event.location_quality==='verified_exact'?'Pārbaudīt lokāciju':'Labot lokāciju'}</button>
       </div></td>
      </tr>;
     })}
    </tbody>
   </table>
  </div>
  <p className="sync-text"><strong>{filtered.length}</strong> no {events.length} ierakstiem.</p>

  {editing&&<LocationEditor event={editing} close={()=>setEditing(null)} save={(values,publish)=>saveLocation(editing,values,publish)}/>}
 </>;
}

function LocationEditor({event,close,save}){
 const dialog=useRef(null),mapEl=useRef(null),mapRef=useRef(null),markerRef=useRef(null);
 const [venueName,setVenueName]=useState(event.venue_name||event.address_raw||'');
 const [latitude,setLatitude]=useState(event.latitude??56.95);
 const [longitude,setLongitude]=useState(event.longitude??24.1);

 useEffect(()=>{
  dialog.current?.showModal();
  let cancelled=false;
  loadLeaflet().then(L=>{
   if(cancelled||!mapEl.current)return;
   const map=L.map(mapEl.current,{minZoom:5,maxBounds:[[53.5,16],[60.8,31.5]],maxBoundsViscosity:1}).setView([Number(latitude),Number(longitude)],event.latitude!=null?13:7);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
   const marker=L.marker([Number(latitude),Number(longitude)],{draggable:true}).addTo(map);
   function apply(latlng){setLatitude(latlng.lat.toFixed(6));setLongitude(latlng.lng.toFixed(6));marker.setLatLng(latlng);}
   map.on('click',e=>apply(e.latlng));marker.on('dragend',()=>apply(marker.getLatLng()));
   mapRef.current=map;markerRef.current=marker;
  });
  return()=>{cancelled=true;mapRef.current?.remove();};
 },[]);

 function syncMarker(){
  const lat=Number(latitude),lon=Number(longitude);
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&markerRef.current&&mapRef.current){markerRef.current.setLatLng([lat,lon]);mapRef.current.panTo([lat,lon]);}
 }
 const meta=qualityMeta(event.location_quality);

 return <dialog ref={dialog} className="event-dialog location-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><div><p className="eyebrow">Lokācijas pārbaude</p><h2>{event.title}</h2></div><button className="button" onClick={close}>Aizvērt ✕</button></div>
  <div className={'location-issue-panel '+meta.tone}>
   <strong>{meta.label}</strong>
   <p>{event.location_review_reason||'Lokācija pašlaik ir verificēta.'}</p>
   {event.address_raw&&<p><b>Nolasītā adrese:</b> {event.address_raw}</p>}
   {sourceLinks(event).map((s,i)=><a key={(s.url||'')+i} href={s.url} target="_blank" rel="noreferrer">Atvērt {s.source||'avotu'} ↗</a>)}
  </div>
  <div className="location-form">
   <label>Norises vietas nosaukums<input value={venueName} onChange={e=>setVenueName(e.target.value)}/></label>
   <label>Latitude<input type="number" step="0.000001" value={latitude} onChange={e=>setLatitude(e.target.value)} onBlur={syncMarker}/></label>
   <label>Longitude<input type="number" step="0.000001" value={longitude} onChange={e=>setLongitude(e.target.value)} onBlur={syncMarker}/></label>
  </div>
  <p className="sync-text">Pārbaudi avotu, tad klikšķini kartē vai pārvelc marķieri uz precīzu norises vietu. Saglabāšana šo punktu atzīmēs kā manuāli verificētu.</p>
  <div ref={mapEl} className="admin-location-map"/>
  <div className="actions">
   <button className="button" onClick={()=>save({venueName,latitude,longitude},false)}>Saglabāt verificētu lokāciju</button>
   <button className="button primary" onClick={()=>save({venueName,latitude,longitude},true)}>Saglabāt un publicēt</button>
   <button className="button" onClick={close}>Atcelt</button>
  </div>
 </dialog>;
}

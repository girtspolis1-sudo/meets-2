'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

const SESSION='meets_user_session_v1';
const EMPTY={id:'',organization_id:'',venue_id:'',title:'',description:'',category:'Cits',date_from:'',date_to:'',time_from:'',time_to:'',venue_name:'',address:'',price_status:'free',status:'draft'};
async function call(action,values={}){
 let session;try{session=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{}
 if(!session?.access_token)throw Error('Pieslēdzies sadaļā “Mani pasākumi”.');
 const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:session.access_token,...values})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Neizdevās saglabāt.');return result;
}
const CATEGORIES=['Mūzika un dejas','Sports','Ģimenēm','Kultūra','Izstādes','Tirdziņi','Cits'];
export default function OrganizerPage({initialKind='organizer'}){
 const [items,setItems]=useState({organizations:[],venues:[],submissions:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [panel,setPanel]=useState('events'),[orgName,setOrgName]=useState(''),[orgKind,setOrgKind]=useState(initialKind);
 const [orgId,setOrgId]=useState(''),[venue,setVenue]=useState({name:'',address:'',latitude:'',longitude:'',directions:'',description:''});
 const [draft,setDraft]=useState(EMPTY),[editing,setEditing]=useState(false);
 const [team,setTeam]=useState([]),[inviteRole,setInviteRole]=useState('editor'),[inviteLink,setInviteLink]=useState(''),[currentUserId,setCurrentUserId]=useState('');
 async function refresh(){const data=await call('list');setItems(data);setOrgId(current=>current&&data.organizations.some(org=>org.id===current)?current:(data.organizations[0]?.id||''));}
 useEffect(()=>{
  try{setCurrentUserId(JSON.parse(localStorage.getItem(SESSION)||'null')?.user?.id||'');}catch{}
  refresh().catch(e=>setError(e.message));
  const invite=new URLSearchParams(window.location.search).get('invite');
  if(invite){
   call('acceptInvite',{invite_token:invite}).then(()=>{window.history.replaceState(null,'',window.location.pathname);setNotice('Uzaicinājums pieņemts.');refresh();setPanel('team');}).catch(e=>setError(e.message));
  }
 },[]);
 useEffect(()=>{if(orgId&&panel==='team')call('team',{organization_id:orgId}).then(data=>setTeam(data.team||[])).catch(e=>setError(e.message));},[orgId,panel]);
 async function perform(action,values,onSuccess){setBusy(true);setError('');setNotice('');try{await call(action,values);await refresh();onSuccess?.();setNotice('Saglabāts.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function createInvitation(){
  setBusy(true);setError('');setInviteLink('');
  try{
   const result=await call('invite',{organization_id:orgId,role:inviteRole});
   const link=window.location.origin+'/organizators?invite='+result.invite.token;
   setInviteLink(link);
   try{await navigator.clipboard.writeText(link);setNotice('Uzaicinājuma saite nokopēta.');}catch{setNotice('Uzaicinājuma saite sagatavota.');}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const organizations=items.organizations,venues=items.venues.filter(v=>v.organization_id===orgId),submissions=items.submissions.filter(e=>e.organization_id===orgId);
 function edit(item){setDraft({...EMPTY,...item});setEditing(true);setPanel('events');}
 return <section className="meets-organizer-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS</p><h1>Organizatora kabinets</h1><p className="meets-muted">Pasākumi, vietas un komanda.</p></div><Link className="button" href="/mani-pasakumi">Mans konts ↗</Link></div>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {!organizations.length?<form className="meets-organizer-form" onSubmit={e=>{e.preventDefault();perform('createOrganization',{name:orgName,kind:orgKind},()=>{setOrgName('');setPanel('events');});}}>
   <h2>Izveido organizatora profilu</h2><p className="meets-muted">Sāc ar organizāciju vai pastāvīgu norises vietu.</p>
   <label>Profila nosaukums<input required minLength={2} maxLength={160} value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Organizācija, klubs vai norises vieta"/></label>
   <label>Profila tips<select value={orgKind} onChange={e=>setOrgKind(e.target.value)}><option value="organizer">Pasākumu organizators</option><option value="venue">Pastāvīgas vietas pārvaldnieks</option></select></label>
   <button className="button primary" disabled={busy} type="submit">Izveidot →</button>
  </form>:<>
   <div className="meets-organizer-bar"><select aria-label="Organizācija" value={orgId} onChange={e=>{setOrgId(e.target.value);setEditing(false);}}>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select>
    <button className="button" onClick={()=>setPanel('newOrg')}>+ Organizācija</button></div>
   <div className="meets-account-tabs" role="tablist"><button className={panel==='events'?'active':''} onClick={()=>setPanel('events')}>▣ Pasākumi ({submissions.length})</button><button className={panel==='venues'?'active':''} onClick={()=>setPanel('venues')}>⌖ Vietas ({venues.length})</button><button className={panel==='team'?'active':''} onClick={()=>setPanel('team')}>♙ Komanda</button></div>
   {panel==='newOrg'&&<form className="meets-organizer-form" onSubmit={e=>{e.preventDefault();perform('createOrganization',{name:orgName,kind:orgKind},()=>{setOrgName('');setPanel('events');});}}><h2>Jauna organizācija</h2><label>Nosaukums<input required minLength={2} value={orgName} onChange={e=>setOrgName(e.target.value)}/></label><label>Tips<select value={orgKind} onChange={e=>setOrgKind(e.target.value)}><option value="organizer">Organizators</option><option value="venue">Vietas pārvaldnieks</option></select></label><button disabled={busy} className="button primary">Izveidot</button></form>}
   {panel==='venues'&&<>
    <form className="meets-organizer-form" onSubmit={e=>{e.preventDefault();perform(venue.id?'updateVenue':'createVenue',{...venue,venue_id:venue.id,organization_id:orgId},()=>setVenue({name:'',address:'',latitude:'',longitude:'',directions:'',description:''}));}}>
     <h2>{venue.id?'Labot norises vietu':'+ Norises vieta'}</h2><div className="meets-organizer-grid"><label>Nosaukums *<input value={venue.name} onChange={e=>setVenue({...venue,name:e.target.value})} required/></label><label>Adrese *<input value={venue.address} onChange={e=>setVenue({...venue,address:e.target.value})} required placeholder="Iela, pilsēta, Latvija"/></label><label>Platums (neobligāti)<input inputMode="decimal" value={venue.latitude} onChange={e=>setVenue({...venue,latitude:e.target.value})}/></label><label>Garums (neobligāti)<input inputMode="decimal" value={venue.longitude} onChange={e=>setVenue({...venue,longitude:e.target.value})}/></label></div>
     <label>Kā nokļūt<textarea value={venue.directions} onChange={e=>setVenue({...venue,directions:e.target.value})} placeholder="Ieeja, stāvvieta, transports…"/></label><label>Vietas apraksts<textarea value={venue.description} onChange={e=>setVenue({...venue,description:e.target.value})}/></label><div className="meets-organizer-buttons"><button className="button primary" disabled={busy}>Saglabāt vietu</button>{venue.id&&<button className="button" type="button" onClick={()=>setVenue({name:'',address:'',latitude:'',longitude:'',directions:'',description:''})}>Atcelt</button>}</div></form>
    <div className="meets-account-list">{venues.map(v=><div key={v.id} className="meets-organizer-item"><div><strong>⌖ {v.name}</strong><span>{v.address}</span></div><button className="button" onClick={()=>{setVenue({...v,latitude:v.latitude??'',longitude:v.longitude??''});window.scrollTo({top:0,behavior:'smooth'});}}>Labot</button></div>)}</div>
   </>}
   {panel==='team'&&<div className="meets-organizer-form"><h2>Komanda</h2>
    <p className="meets-muted">Uzaicini kolēģi ar privātu saiti. Saites derīgums — 7 dienas. Kolēģim jābūt savam MEETS kontam.</p>
    <div className="meets-account-list">{team.map(member=><div className="meets-organizer-item" key={member.user_id}><strong>{member.email}</strong><span className="meets-organizer-status">{({owner:'Īpašnieks',admin:'Administrators',editor:'Redaktors',viewer:'Skatītājs'})[member.role]||member.role}</span></div>)}</div>
    {items.organizations.find(org=>org.id===orgId)?.owner_id===currentUserId&&<>
     <label>Uzaicināt kā<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="editor">Redaktors — pasākumi un vietas</option><option value="admin">Administrators — pasākumi un vietas</option><option value="viewer">Skatītājs — tikai pārskats</option></select></label>
     <button className="button primary" type="button" disabled={busy} onClick={createInvitation}>+ Uzaicināt kolēģi</button>
     {inviteLink&&<label>Uzaicinājuma saite<input readOnly value={inviteLink} onFocus={e=>e.target.select()}/></label>}
    </>}
   </div>}
   {panel==='events'&&<>
    {!editing?<><button className="button primary" onClick={()=>{setDraft({...EMPTY,organization_id:orgId});setEditing(true);}}>+ Jauns pasākums</button>
     <div className="meets-account-list">{submissions.map(item=><div key={item.id} className="meets-organizer-item"><div><strong>{item.title}</strong><span>{item.date_from} · {item.venue_name||'Vieta nav norādīta'}</span>{item.status==='rejected'&&item.admin_note&&<small className="meets-organizer-rejection">Jālabo: {item.admin_note}</small>}</div><span className="meets-organizer-status">{({draft:'Melnraksts',pending_review:'Pārbaudē',published:'Publicēts',rejected:'Jālabo'})[item.status]}</span>{['draft','rejected'].includes(item.status)&&<button className="button" onClick={()=>edit(item)}>Labot</button>}</div>)}</div>
     {!submissions.length&&<p className="meets-muted">Vēl nav iesniegtu pasākumu.</p>}</>:
    <form className="meets-organizer-form" onSubmit={e=>{e.preventDefault();perform('saveEvent',{...draft,organization_id:orgId,status:'pending_review'},()=>{setEditing(false);setDraft(EMPTY);});}}>
     <h2>{draft.id?'Labot pasākumu':'Jauns pasākums'}</h2>
     <label>Nosaukums *<input value={draft.title} required minLength={3} maxLength={200} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <div className="meets-organizer-grid"><label>Kategorija<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Cena<select value={draft.price_status} onChange={e=>setDraft({...draft,price_status:e.target.value})}><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option><option value="unknown">Nav zināms</option></select></label>
     <label>Datums no *<input type="date" required value={draft.date_from} onChange={e=>setDraft({...draft,date_from:e.target.value})}/></label><label>Datums līdz<input type="date" min={draft.date_from||undefined} value={draft.date_to||''} onChange={e=>setDraft({...draft,date_to:e.target.value})}/></label>
     <label>Sākuma laiks<input type="time" value={draft.time_from||''} onChange={e=>setDraft({...draft,time_from:e.target.value})}/></label><label>Beigu laiks<input type="time" value={draft.time_to||''} onChange={e=>setDraft({...draft,time_to:e.target.value})}/></label></div>
     <label>Norises vieta<select value={draft.venue_id||''} onChange={e=>setDraft({...draft,venue_id:e.target.value})}><option value="">Jauna / mainīga vieta</option>{venues.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</select></label>
     {!draft.venue_id&&<div className="meets-organizer-grid"><label>Vietas nosaukums<input value={draft.venue_name||''} onChange={e=>setDraft({...draft,venue_name:e.target.value})}/></label><label>Adrese<input value={draft.address||''} onChange={e=>setDraft({...draft,address:e.target.value})}/></label></div>}
     <label>Apraksts<textarea rows={4} value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
     <div className="meets-organizer-buttons"><button className="button" type="button" disabled={busy} onClick={()=>perform('saveEvent',{...draft,organization_id:orgId,status:'draft'},()=>{setEditing(false);setDraft(EMPTY);})}>Saglabāt melnrakstu</button><button className="button primary" disabled={busy}>Iesniegt pārbaudei →</button><button className="button" type="button" onClick={()=>setEditing(false)}>Atcelt</button></div>
     <p className="meets-muted">Pasākums kartē būs redzams pēc MEETS administratora apstiprināšanas.</p>
    </form>}
   </>}
  </>}
 </section>;
}
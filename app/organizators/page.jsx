'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {rigaDate} from '../../lib/meets-personal.js';

const SESSION='meets_user_session_v1';
const EMPTY={id:'',organization_id:'',venue_id:'',title:'',description:'',category:'Cits',date_from:'',date_to:'',time_from:'',time_to:'',venue_name:'',address:'',price_status:'free',schedule_kind:'once',recurrence_note:'',status:'draft'};
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
 const [draft,setDraft]=useState(EMPTY),[editing,setEditing]=useState(false),[draftStep,setDraftStep]=useState(0);
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
 function edit(item){setDraft({...EMPTY,...item});setDraftStep(0);setEditing(true);setPanel('events');}
 function advanceDraft(){
  if(draftStep===0&&draft.title.trim().length<3){setError('Ievadi pasākuma nosaukumu (vismaz 3 rakstzīmes).');return;}
  if(draftStep===1&&(!draft.date_from||(!draft.venue_id&&(!draft.venue_name.trim()||!draft.address.trim())))){setError('Norādi pasākuma datumu un norises vietas nosaukumu ar adresi.');return;}
  if(draftStep===1&&draft.date_to&&draft.date_to<draft.date_from){setError('Beigu datums nevar būt pirms pasākuma sākuma datuma.');return;}
  setError('');setDraftStep(step=>Math.min(2,step+1));
 }
 return <section className="meets-organizer-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS</p><h1>Organizatora kabinets</h1><p className="meets-muted">Pasākumi, vietas un komanda.</p></div><Link className="button" href="/registre-pasakumu">Reģistrēt pasākumu ↗</Link></div>
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
   <div className="meets-account-tabs" role="group" aria-label="Organizatora darba sadaļas"><button type="button" aria-pressed={panel==='events'} className={panel==='events'?'active':''} onClick={()=>setPanel('events')}>▣ Pasākumi ({submissions.length})</button><button type="button" aria-pressed={panel==='venues'} className={panel==='venues'?'active':''} onClick={()=>setPanel('venues')}>⌖ Vietas ({venues.length})</button><button type="button" aria-pressed={panel==='team'} className={panel==='team'?'active':''} onClick={()=>setPanel('team')}>♙ Komanda</button></div>
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
    {!editing?<><button className="button primary" onClick={()=>{setDraft({...EMPTY,organization_id:orgId});setDraftStep(0);setEditing(true);}}>+ Jauns pasākums</button>
     <div className="meets-account-list">{submissions.map(item=><div key={item.id} className="meets-organizer-item"><div><strong>{item.title}</strong><span>{item.date_from} · {item.venue_name||'Vieta nav norādīta'}</span>{item.status==='rejected'&&item.admin_note&&<small className="meets-organizer-rejection">Jālabo: {item.admin_note}</small>}</div><span className="meets-organizer-status">{({draft:'Melnraksts',pending_review:'Pārbaudē',published:'Publicēts',rejected:'Jālabo'})[item.status]}</span>{['draft','rejected'].includes(item.status)&&<button className="button" onClick={()=>edit(item)}>Labot</button>}</div>)}</div>
     {!submissions.length&&<p className="meets-muted">Vēl nav iesniegtu pasākumu.</p>}</>:
    <form className="meets-organizer-form meets-organizer-wizard" onSubmit={e=>{e.preventDefault();if(draftStep!==2)return;perform('saveEvent',{...draft,organization_id:orgId,status:'pending_review'},()=>{setEditing(false);setDraftStep(0);setDraft(EMPTY);});}}>
     <h2>{draft.id?'Labot pasākumu':'Jauns pasākums'}</h2>
     <p className="meets-muted">Aizpildi informāciju trīs soļos. Melnrakstu var saglabāt pēc pasākuma nosaukuma un datuma norādīšanas.</p>
     <ol className="meets-wizard-progress" aria-label="Pasākuma reģistrēšanas soļi">{['Informācija','Datums un vieta','Pārbaude'].map((label,i)=><li key={label} aria-current={draftStep===i?'step':undefined} className={draftStep===i?'active':i<draftStep?'done':''}><span>{i<draftStep?'✓':i+1}</span>{label}</li>)}</ol>
     {draftStep===0&&<div className="meets-wizard-step">
      <div className="meets-schedule-choice"><label>Pasākuma veids<select value={draft.schedule_kind||'once'} onChange={e=>setDraft({...draft,schedule_kind:e.target.value})}><option value="once">Vienreizējs</option><option value="recurring">Regulārs / atkārtojas</option><option value="ongoing">Pastāvīgs / ilgstošs</option></select></label>
       {draft.schedule_kind==='recurring'&&<label>Regularitāte<input maxLength={300} value={draft.recurrence_note||''} onChange={e=>setDraft({...draft,recurrence_note:e.target.value})} placeholder="Piem., katru sestdienu plkst. 12.00"/></label>}</div>
      <label>Nosaukums *<input value={draft.title} minLength={3} maxLength={200} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Kā sauc pasākumu?"/></label>
      <label>Kategorija<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label>
      <label>Apraksts<textarea rows={5} value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Kas notiks? Kam pasākums paredzēts?"/></label>
     </div>}
     {draftStep===1&&<div className="meets-wizard-step">
      <div className="meets-organizer-grid">
       <label>Datums no *<input type="date" value={draft.date_from} min={rigaDate()} onChange={e=>setDraft({...draft,date_from:e.target.value})}/></label>
       <label>Datums līdz<input type="date" min={draft.date_from||undefined} value={draft.date_to||''} onChange={e=>setDraft({...draft,date_to:e.target.value})}/></label>
       <label>Sākuma laiks<input type="time" value={draft.time_from||''} onChange={e=>setDraft({...draft,time_from:e.target.value})}/></label>
       <label>Beigu laiks<input type="time" value={draft.time_to||''} onChange={e=>setDraft({...draft,time_to:e.target.value})}/></label>
      </div>
      <label>Norises vieta<select value={draft.venue_id||''} onChange={e=>setDraft({...draft,venue_id:e.target.value})}><option value="">Jauna / mainīga vieta</option>{venues.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</select></label>
      {!draft.venue_id&&<div className="meets-organizer-grid">
       <label>Vietas nosaukums *<input value={draft.venue_name||''} onChange={e=>setDraft({...draft,venue_name:e.target.value})} placeholder="Norises vieta"/></label>
       <label>Adrese *<input value={draft.address||''} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Iela, pilsēta, Latvija"/></label>
      </div>}
      <label>Dalības maksa<select value={draft.price_status} onChange={e=>setDraft({...draft,price_status:e.target.value})}><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option><option value="unknown">Nav zināms</option></select></label>
     </div>}
     {draftStep===2&&<section className="meets-wizard-step meets-wizard-preview" aria-label="Pasākuma priekšskatījums">
      <p className="eyebrow">Pirms iesniegšanas</p><h3>{draft.title}</h3>
      <dl>
       <div><dt>Kategorija</dt><dd>{draft.category}</dd></div>
       <div><dt>Datums</dt><dd>{draft.date_from}{draft.date_to&&draft.date_to!==draft.date_from?' – '+draft.date_to:''}</dd></div>
       <div><dt>Laiks</dt><dd>{draft.time_from||'Nav norādīts'}{draft.time_to?' – '+draft.time_to:''}</dd></div>
       <div><dt>Norises vieta</dt><dd>{draft.venue_id?venues.find(v=>v.id===draft.venue_id)?.name||'Izvēlēta vieta':[draft.venue_name,draft.address].filter(Boolean).join(' · ')}</dd></div>
       <div><dt>Maksa</dt><dd>{({free:'Bezmaksas',paid:'Maksas',mixed:'Daļēji maksas',unknown:'Nav zināms'})[draft.price_status]}</dd></div>
      </dl>
      {draft.description&&<p>{draft.description}</p>}
      <p className="meets-muted">Pēc iesniegšanas pasākums nonāks administratora pārbaudē; kartē tas būs redzams tikai pēc apstiprināšanas.</p>
     </section>}
     <div className="meets-organizer-buttons meets-wizard-actions">
      {draftStep>0&&<button className="button" type="button" disabled={busy} onClick={()=>{setDraftStep(s=>s-1);setError('');}}>← Atpakaļ</button>}
      <button className="button" type="button" disabled={busy||draft.title.trim().length<3||!draft.date_from} onClick={()=>perform('saveEvent',{...draft,organization_id:orgId,status:'draft'},()=>{setEditing(false);setDraftStep(0);setDraft(EMPTY);})}>Saglabāt melnrakstu</button>
      {draftStep<2?<button className="button primary" type="button" disabled={busy} onClick={advanceDraft}>Turpināt →</button>:<button className="button primary" disabled={busy} type="submit">Iesniegt pārbaudei →</button>}
      <button className="button" type="button" disabled={busy} onClick={()=>{setEditing(false);setDraftStep(0);}}>Atcelt</button>
     </div>
    </form>}
   </>}
  </>}
 </section>;
}
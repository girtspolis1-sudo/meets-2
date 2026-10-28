'use client';
import Link from 'next/link';
import {Suspense,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import OrganizerProfileEditor from '../components/organizer-profile-editor.jsx';
import {rigaDate} from '../../lib/meets-personal.js';
import {resolveOrganizationId,canWriteOrganization} from '../../lib/organizer-workspace.js';

const SESSION='meets_user_session_v1';
const PANELS=new Set(['overview','events','venues','profile']);
function organizationsFrom(items,id){return id&&Array.isArray(items)&&items.some(o=>o.id===id)?id:'';}
const STATUS_LABELS={draft:'Melnraksts',pending_review:'Pārbaudē',rejected:'Jālabo',published:'Publicēts',closed:'Slēgts',archived:'Arhivēts',cancelled:'Atcelts'};
const ROLE_LABELS={owner:'Īpašnieks',admin:'Administrators',editor:'Redaktors',viewer:'Skatītājs'};

function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
async function rpc(action,values={},session=sessionRead()){
 if(!session?.access_token)throw Error('Pieslēdzies MEETS kontā.');
 const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
  body:JSON.stringify({action,token:session.access_token,...values})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||'Darbība neizdevās.');error.status=response.status;throw error;}
 return body;
}
async function refreshSession(session){
 if(!session?.refresh_token)throw Error('Sesija beigusies.');
 const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'Sesija beigusies.');
 const value={...body,expires_at:Date.now()+(body.expires_in||3600)*1000};
 localStorage.setItem(SESSION,JSON.stringify(value));
 window.dispatchEvent(new Event('meets-user-changed'));
 return value;
}
function statusClass(status){return 'org-status org-status-'+String(status||'draft').replaceAll('_','-');}
function eventDate(item){return item.date_from||'Datums nav norādīts';}
function future(item){const end=item.date_to||item.date_from;return end?end>=rigaDate():true;}

function normalizeWebsite(value){
 const raw=String(value||'').trim();
 if(!raw)return '';
 let parsed;
 try{parsed=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}
 catch{throw Error('Norādi korektu mājaslapas adresi.');}
 if(!['http:','https:'].includes(parsed.protocol))throw Error('Mājaslapai jāizmanto http vai https.');
 return parsed.href;
}
async function uploadOrgLogo(file,id,token){
 if(!file)return '';
 const body=new FormData();body.append('file',file);body.append('organization_id',id);body.append('token',token);
 const r=await fetch('/api/organization-logo',{method:'POST',body});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Logo neizdevās saglabāt.');
 return b.url;
}
function OrganizerPageInner(){
 const searchParams=useSearchParams();
 const [session,setSession]=useState(null);
 const [items,setItems]=useState({organizations:[],venues:[],publicVenues:[],venueLinks:[],submissions:[]});
 const [orgId,setOrgId]=useState('');
 const [panel,setPanel]=useState('overview');
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [creating,setCreating]=useState(false);
 const [newOrg,setNewOrg]=useState({name:'',description:'',address:'',address_public:false,website_public:false,contacts:[],is_public:false,image_url:'',public_url:''});
 const [newLogo,setNewLogo]=useState(null),[profileLogo,setProfileLogo]=useState(null);
 const [profile,setProfile]=useState(null);
 const [profileDirty,setProfileDirty]=useState(false);
 const [team,setTeam]=useState([]);
 const [inviteRole,setInviteRole]=useState('editor');
 const [inviteLink,setInviteLink]=useState('');
 const [lists,setLists]=useState([]);
 const [filters,setFilters]=useState({status:'all',time:'upcoming',query:'',venue:''});

 async function load(startSession=sessionRead()){
  if(!startSession?.access_token){setLoaded(true);return;}
  let current=startSession;
  try{
   let data;
   try{data=await rpc('list',{},current);}
   catch(e){
    if(e.status!==401)throw e;
    current=await refreshSession(current);
    data=await rpc('list',{},current);
   }
   setSession(current);
   setItems(data);
   const params=new URLSearchParams(window.location.search);
   const requested=params.get('org');
   const requestedPanel=params.get('panel');
   const chosen=requested&&data.organizations?.some(o=>o.id===requested)?requested:'';
   setOrgId(chosen);
   setPanel(PANELS.has(requestedPanel)?requestedPanel:'overview');
   setCreating(params.get('new')==='1');
   setFilters({
    status:params.get('status')||'all',
    time:params.get('time')||'upcoming',
    query:params.get('q')||'',
    venue:params.get('venue')||''
   });

   const invite=params.get('invite');
   if(invite){
    await rpc('acceptInvite',{invite_token:invite},current);
    const refreshed=await rpc('list',{},current);setItems(refreshed);
    const joined=refreshed.organizations?.find(o=>o.id===requested)||refreshed.organizations?.[0];
    if(joined){setOrgId(joined.id);setPanel('team');replaceUrl(joined.id,'team');}
    setNotice('Uzaicinājums pieņemts.');
   }
  }catch(e){setError(e.message);}
  finally{setLoaded(true);}
 }

 useEffect(()=>{load();},[]);
 // Keep the rendered panel in sync with Next.js client-side Link navigation.
 useEffect(()=>{
  if(!loaded)return;
  const requested=searchParams.get('org')||'';
  const nextOrg=organizationsFrom(items.organizations,requested);
  const nextPanel=searchParams.get('panel');
  setOrgId(current=>current===nextOrg?current:nextOrg);
  setPanel(PANELS.has(nextPanel)?nextPanel:'overview');
  if(searchParams.get('new')==='1')setCreating(true);
 },[searchParams,loaded,items.organizations]);

 useEffect(()=>{
  const beforeUnload=e=>{if(profileDirty){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  return()=>window.removeEventListener('beforeunload',beforeUnload);
 },[profileDirty]);

 const organizations=items.organizations||[];
 const activeOrg=organizations.find(o=>o.id===orgId)||null;
 const canEdit=activeOrg&&canWriteOrganization(activeOrg.role);
 const orgSubmissions=useMemo(()=>items.submissions.filter(x=>x.organization_id===orgId),[items.submissions,orgId]);
 const managedVenues=useMemo(()=>items.venues.filter(v=>v.organization_id===orgId),[items.venues,orgId]);
 const usedVenueIds=useMemo(()=>new Set((items.venueLinks||[]).filter(x=>x.organization_id===orgId&&x.relation_type==='used').map(x=>x.venue_id)),[items.venueLinks,orgId]);
 const usedVenues=useMemo(()=>[...(items.publicVenues||[]),...(items.venues||[])].filter(v=>usedVenueIds.has(v.id)),[items.publicVenues,items.venues,usedVenueIds]);

 useEffect(()=>{
  if(activeOrg){setProfile({...activeOrg});setProfileDirty(false);}
  else setProfile(null);
 },[activeOrg?.id,activeOrg?.updated_at]);

 useEffect(()=>{
  if(!session||!orgId)return;
  if(panel==='team')rpc('team',{organization_id:orgId},session).then(x=>setTeam(x.team||[])).catch(e=>setError(e.message));
  if(panel==='lists'){
   fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list',token:session.access_token})})
    .then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||'Sarakstus neizdevās ielādēt.');return b;})
    .then(b=>setLists((b.registries||[]).filter(x=>x.organization_id===orgId)))
    .catch(e=>setError(e.message));
  }
 },[panel,orgId,session?.access_token]);

 function replaceUrl(nextOrg=orgId,nextPanel=panel,extra={}){
  const params=new URLSearchParams();
  if(nextOrg)params.set('org',nextOrg);
  if(nextPanel)params.set('panel',nextPanel);
  const merged={...filters,...extra};
  if(nextPanel==='events'){
   if(merged.status&&merged.status!=='all')params.set('status',merged.status);
   if(merged.time&&merged.time!=='upcoming')params.set('time',merged.time);
   if(merged.query)params.set('q',merged.query);
   if(merged.venue)params.set('venue',merged.venue);
  }
  window.history.replaceState(null,'','/organizators'+(params.toString()?'?'+params.toString():''));
 }
 function chooseOrganization(id){
  if(profileDirty&&!window.confirm('Organizatora profilā ir nesaglabātas izmaiņas. Pārslēgt organizatoru un tās atmest?'))return;
  setOrgId(id);setPanel('overview');setError('');setNotice('');setProfileDirty(false);
  replaceUrl(id,'overview');
 }
 function choosePanel(next){
  if(profileDirty&&panel==='profile'&&!window.confirm('Ir nesaglabātas profila izmaiņas. Turpināt bez saglabāšanas?'))return;
  setPanel(next);setProfileDirty(false);replaceUrl(orgId,next);
 }
 async function perform(action,values,onDone){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await rpc(action,values,session);
   const data=await rpc('list',{},session);setItems(data);
   onDone?.(result,data);
   setNotice('Saglabāts.');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function createOrganization(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const public_url=normalizeWebsite(newOrg.public_url);
   const created=await rpc('createOrganization',{name:newOrg.name,description:newOrg.description,kind:'organizer',address:newOrg.address,contacts:newOrg.contacts},session);
   const id=created.item?.id;if(!id)throw Error('Organizatoru neizdevās izveidot.');
   await rpc('updateOrganization',{organization_id:id,name:newOrg.name,description:newOrg.description,is_public:newOrg.is_public,public_url,image_url:''},session);
   await rpc('saveOrgContacts',{organization_id:id,address:newOrg.address,contacts:newOrg.contacts,contacts_public:newOrg.is_public,address_public:newOrg.address_public===true,website_public:newOrg.website_public===true},session);
   let logoError='';
   if(newLogo)try{
    const image_url=await uploadOrgLogo(newLogo,id,session.access_token);
    await rpc('updateOrganization',{organization_id:id,...newOrg,public_url,image_url},session);
   }catch(e){logoError=e.message;}
   const data=await rpc('list',{},session);setItems(data);
   setNewOrg({name:'',description:'',address:'',address_public:false,website_public:false,contacts:[],is_public:false,image_url:'',public_url:''});
   setNewLogo(null);setCreating(false);setOrgId(id);setPanel('profile');
   const returnTo=new URLSearchParams(window.location.search).get('return');
   if(returnTo&&returnTo.startsWith('/')&&!returnTo.startsWith('//')){const join=returnTo.includes('?')?'&':'?';window.location.assign(returnTo+join+'org='+encodeURIComponent(id));return;}
   replaceUrl(id,'profile');
   if(logoError)setError('Organizators izveidots, bet logo neizdevās augšupielādēt: '+logoError);
   else setNotice('Organizators izveidots. Tagad vari pievienot adresi vai pasākumu.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function saveProfile(e){
  e.preventDefault();if(!profile||!orgId)return;
  setBusy(true);setError('');setNotice('');
  try{
   const public_url=normalizeWebsite(profile.public_url);
   const record={...profile,public_url};
   await rpc('updateOrganization',{organization_id:orgId,...record},session);
   await rpc('saveOrgContacts',{organization_id:orgId,address:profile.address||'',contacts:profile.contacts||[],contacts_public:profile.is_public===true,address_public:profile.address_public===true,website_public:profile.website_public===true},session);
   let logoError='';
   if(profileLogo)try{
    const image_url=await uploadOrgLogo(profileLogo,orgId,session.access_token);
    await rpc('updateOrganization',{organization_id:orgId,...record,image_url},session);
   }catch(e){logoError=e.message;}
   const data=await rpc('list',{},session);setItems(data);
   setProfileLogo(logoError?profileLogo:null);
   setProfileDirty(Boolean(logoError));
   if(logoError)setError('Pārējā profila informācija saglabāta, bet logo augšupielāde neizdevās: '+logoError);
   else setNotice('Organizatora profils saglabāts.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function createInvitation(){
  setBusy(true);setError('');setInviteLink('');
  try{
   const result=await rpc('invite',{organization_id:orgId,role:inviteRole},session);
   const link=window.location.origin+'/organizators?invite='+result.invite.token+'&org='+orgId;
   setInviteLink(link);
   try{await navigator.clipboard.writeText(link);setNotice('Uzaicinājuma saite nokopēta.');}catch{setNotice('Uzaicinājuma saite sagatavota.');}
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 function changeFilter(key,value){
  const next={...filters,[key]:value};setFilters(next);replaceUrl(orgId,'events',next);
 }

 const filteredEvents=useMemo(()=>{
  const q=filters.query.trim().toLocaleLowerCase('lv');
  return orgSubmissions.filter(item=>{
   if(filters.status!=='all'&&item.status!==filters.status)return false;
   if(filters.time==='upcoming'&&!future(item))return false;
   if(filters.time==='past'&&future(item))return false;
   if(filters.venue&&item.venue_id!==filters.venue)return false;
   if(q&&!String(item.title+' '+item.venue_name+' '+item.address).toLocaleLowerCase('lv').includes(q))return false;
   return true;
  }).sort((a,b)=>{
   const ad=a.date_from||'9999-12-31',bd=b.date_from||'9999-12-31';
   return filters.time==='past'?bd.localeCompare(ad):ad.localeCompare(bd);
  });
 },[orgSubmissions,filters]);

 const metrics=useMemo(()=>({
  drafts:orgSubmissions.filter(x=>x.status==='draft').length,
  review:orgSubmissions.filter(x=>x.status==='pending_review').length,
  fixes:orgSubmissions.filter(x=>x.status==='rejected').length,
  published:orgSubmissions.filter(x=>x.status==='published'&&future(x)).length
 }),[orgSubmissions]);

 function eventFilterLink(status){
  return '/organizators?org='+orgId+'&panel=events&status='+status+'&time=upcoming';
 }
 function orgCard(org){
  const events=items.submissions.filter(x=>x.organization_id===org.id);
  const published=events.filter(x=>x.status==='published');
  const venues=items.venues.filter(x=>x.organization_id===org.id);
  return <article className="org-card" key={org.id}>
   <div className="org-card-image">{org.image_url?<img src={org.image_url} alt=""/>:<span>{org.name.slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div className="org-card-body"><div className="org-card-title"><h2>{org.name}</h2><span>{ROLE_LABELS[org.role]||org.role}</span></div>
    <p>{org.description||'Apraksts vēl nav pievienots.'}</p>
    <div className="org-card-counts"><span><strong>{venues.length}</strong> adreses</span><span><strong>{events.length}</strong> pasākumi</span><span><strong>{published.length}</strong> publicēti</span></div>
   </div>
   <button className="button primary" type="button" onClick={()=>chooseOrganization(org.id)}>Izvēlēties organizatoru →</button>
  </article>;
 }

 if(!loaded)return <div className="meets-profile-skeleton" role="status">Ielādē organizēšanas vidi…</div>;
 if(!session)return <ProfileShell><section className="org-workspace"><div className="org-empty-state">
  <h1>Organizēšana</h1><p>Lai reģistrētu un pārvaldītu pasākumus, vispirms pieslēdzies savam MEETS kontam.</p>
  <Link className="button primary" href="/profils">Pieslēgties →</Link>
 </div></section></ProfileShell>;

 if(!orgId||creating){
  return <ProfileShell session={session}><section className={creating?'org-workspace org-workspace-profile':'org-workspace'}>
   <header className="org-page-head"><div><p className="eyebrow">Organizēšana</p><h1>{creating?'Jauns organizators':'Tavi organizatori'}</h1>
    <p>Izveido organizatora profilu un pievieno tam norises vietas un pasākumus.</p></div>
    {!creating&&<button className="button primary" type="button" onClick={()=>setCreating(true)}>+ Jauns organizators</button>}</header>
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
   {creating?<OrganizerProfileEditor isNew value={newOrg} onChange={patch=>setNewOrg(v=>({...v,...patch}))} onSubmit={createOrganization} onCancel={()=>setCreating(false)}
    logoFile={newLogo} onLogoChange={setNewLogo} busy={busy}/>
   :organizations.length?<div className="org-card-grid">{organizations.map(orgCard)}</div>:<div className="org-empty-state">
    <h2>Sāc organizēt</h2><p>Izveido organizatora profilu tikai tad, kad vēlies publicēt savus pasākumus. Otrs lietotāja konts nav vajadzīgs.</p>
    <button className="button primary" type="button" onClick={()=>setCreating(true)}>Sākt organizēt →</button>
   </div>}
  </section></ProfileShell>;
 }

 return <ProfileShell session={session} activeOrganization={activeOrg}><section className={'org-workspace'+(panel==='profile'?' org-workspace-profile':'')}>
  <header className="org-page-head"><div><p className="eyebrow">Organizēšana · {ROLE_LABELS[activeOrg?.role]||activeOrg?.role}</p><h1>{activeOrg?.name} {panel==='profile'&&<span className="org-v3-status">{activeOrg?.is_public?'Publisks':'Privāts'}</span>}</h1>
</div>
   <div className="org-head-actions">{panel==='profile'&&activeOrg?.is_public&&<Link className="button org-v3-preview-link" href={'/organizatori/'+orgId}>Publiskais priekšskatījums ↗</Link>}<select aria-label="Aktīvais organizators" value={orgId} onChange={e=>chooseOrganization(e.target.value)}>{organizations.map(org=><option value={org.id} key={org.id}>{org.name}</option>)}</select>
    <button className="button" type="button" onClick={()=>{setOrgId('');setCreating(false);window.history.replaceState(null,'','/organizators');}}>Visi organizatori</button>
    </div></header>

  {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}

  {panel==='overview'&&<div className="org-stack">
   <section className="org-simple-summary" aria-label="Organizatora kopsavilkums"><span><strong>{managedVenues.length}</strong> adreses</span><span><strong>{orgSubmissions.length}</strong> pasākumi</span><span><strong>{metrics.published}</strong> publicēti</span></section>
   <section className="org-panel"><div className="org-panel-head"><h2>Manas adreses</h2>{canEdit&&<Link className="button primary" href={'/registre-vietu?org='+orgId}>+ Pievienot adresi</Link>}</div><div className="org-list">{managedVenues.slice(0,5).map(v=><div className="org-row" key={v.id}><div><strong>{v.name}</strong><small>{v.address} · {orgSubmissions.filter(x=>x.venue_id===v.id).length} pasākumi</small></div><div className="org-row-actions"><button type="button" className="button" onClick={()=>choosePanel('venues')}>Atvērt</button>{canEdit&&<Link className="button primary org-add-event" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&venue='+v.id}>+ Pievienot pasākumu</Link>}</div></div>)}{!managedVenues.length&&<p className="org-empty">Vēl nav objektu. Pievieno pirmo adresi, lai sāktu reģistrēt pasākumus.</p>}</div></section>
   <section className="org-panel"><div className="org-panel-head"><div><h2>Tuvākie pasākumi</h2></div><button className="button" onClick={()=>choosePanel('events')}>Visi pasākumi →</button></div>
    <div className="org-list">{orgSubmissions.filter(future).sort((a,b)=>(a.date_from||'9999').localeCompare(b.date_from||'9999')).slice(0,6).map(item=><div className="org-row" key={item.id}>
     <div><strong>{item.title||'Bez nosaukuma'}</strong><small>{eventDate(item)} · {item.venue_name||'Vieta nav norādīta'}</small>{item.status==='rejected'&&item.admin_note&&<em>Jālabo: {item.admin_note}</em>}</div>
     <span className={statusClass(item.status)}>{STATUS_LABELS[item.status]||item.status}</span>
     {canEdit&&['draft','rejected'].includes(item.status)&&<Link className="button" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&edit='+item.id}>Labot</Link>}
    </div>)}
    {!orgSubmissions.filter(future).length&&<p className="org-empty">Nav gaidāmu pasākumu.</p>}</div>
   </section>
  </div>}

  {panel==='events'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Pasākumi</h2><p>Filtri saglabājas adresē, tāpēc pēc labošanas vari atgriezties tajā pašā skatā.</p></div>{canEdit&&<Link className="button primary" href={'/registre-pasakumu/vienkarsi?org='+orgId}>+ Jauns pasākums</Link>}</div>
   <div className="org-filters">
    <label>Statuss<select value={filters.status} onChange={e=>changeFilter('status',e.target.value)}><option value="all">Visi</option><option value="draft">Melnraksti</option><option value="pending_review">Pārbaudē</option><option value="rejected">Jālabo</option><option value="published">Publicētie</option></select></label>
    <label>Laiks<select value={filters.time} onChange={e=>changeFilter('time',e.target.value)}><option value="upcoming">Gaidāmie</option><option value="past">Pagājušie</option><option value="all">Visi</option></select></label>
    <label>Vieta<select value={filters.venue} onChange={e=>changeFilter('venue',e.target.value)}><option value="">Visas vietas</option>{managedVenues.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}{usedVenues.map(v=><option value={v.id} key={v.id}>{v.name} · izmantota</option>)}</select></label>
    <label className="org-filter-search">Meklēt<input type="search" value={filters.query} onChange={e=>changeFilter('query',e.target.value)} placeholder="Nosaukums vai vieta"/></label>
   </div>
   <div className="org-table" role="table" aria-label="Organizatora pasākumi">
    <div className="org-table-head" role="row"><span>Nosaukums</span><span>Datums</span><span>Vieta</span><span>Statuss</span><span>Darbības</span></div>
    {filteredEvents.map(item=><div className="org-table-row" role="row" key={item.id}>
     <div data-label="Nosaukums"><strong>{item.title||'Bez nosaukuma'}</strong>{item.status==='rejected'&&item.admin_note&&<small className="org-rejection">Jālabo: {item.admin_note}</small>}</div>
     <span data-label="Datums">{eventDate(item)}</span><span data-label="Vieta">{item.venue_name||'Nav norādīta'}</span>
     <span data-label="Statuss"><em className={statusClass(item.status)}>{STATUS_LABELS[item.status]||item.status}</em></span>
     <div data-label="Darbības" className="org-row-actions">
      {canEdit&&['draft','rejected'].includes(item.status)&&<Link className="button" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&edit='+item.id}>Labot</Link>}
      {canEdit&&<Link className="button" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&copy='+item.id}>Dublēt</Link>}
      {item.event_id&&<Link className="button" href={'/karte?event='+item.event_id}>Priekšskatīt</Link>}
     </div>
    </div>)}
   </div>
   {!filteredEvents.length&&<p className="org-empty">Šiem filtriem pasākumi nav atrasti.</p>}
  </section>}

  {panel==='venues'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Manas adreses</h2></div>{canEdit&&<Link className="button primary" href={'/registre-vietu?org='+orgId}>+ Pievienot adresi</Link>}</div>
   <div className="org-list">{managedVenues.map(v=><div className="org-row" key={v.id}>
    <div><strong>{v.name}</strong><small>{v.address||'Adrese nav norādīta'} · {v.is_public?'Publiska':'Privāta'} · {orgSubmissions.filter(x=>x.venue_id===v.id&&future(x)).length} gaidāmi pasākumi</small></div>
    <span className="org-status">Pārvaldīta</span><div className="org-row-actions">{v.is_public&&<Link className="button" href={'/vietas/'+v.id}>Atvērt</Link>}{canEdit&&<><Link className="button primary org-add-event" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&venue='+v.id}>+ Pievienot pasākumu</Link><Link className="button" href={'/registre-vietu?org='+orgId+'&edit='+v.id}>Labot</Link></>}</div>
   </div>)}{!managedVenues.length&&<p className="org-empty">Vēl nav reģistrētu adrešu.</p>}</div>
   {usedVenues.length>0&&<><h3>Izmantotās vietas</h3><div className="org-list">{usedVenues.map(v=><div className="org-row" key={v.id}>
    <div><strong>{v.name}</strong><small>{v.address||'Adrese nav norādīta'} · {orgSubmissions.filter(x=>x.venue_id===v.id&&future(x)).length} gaidāmi pasākumi</small></div><span className="org-status">Izmantota</span>
    <div className="org-row-actions"><Link className="button" href={'/vietas/'+v.id}>Atvērt</Link>{canEdit&&<Link className="button" href={'/registre-pasakumu/vienkarsi?org='+orgId+'&venue='+v.id}>Jauns pasākums</Link>}</div>
   </div>)}</div></>}
  </section>}

  {panel==='lists'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Publiskie saraksti</h2><p>Saraksts ir pasākumu izlase; tas nemaina pašu pasākumu īpašnieku.</p></div>{canEdit&&<Link className="button primary" href={'/mani-registri?org='+orgId+'&new=1'}>+ Jauns publiskais saraksts</Link>}</div>
   <div className="org-list">{lists.map(item=><div className="org-row" key={item.id}><div><strong>{item.title}</strong><small>{item.is_published?'Publisks':'Privāts'} · {(item.included_event_ids||[]).length} manuāli pievienoti</small></div><Link className="button" href={'/mani-registri?org='+orgId+'&edit='+item.id}>Atvērt</Link></div>)}
   {!lists.length&&<p className="org-empty">Šim organizatoram vēl nav sarakstu.</p>}</div>
  </section>}

  {panel==='team'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Komanda</h2><p>Skatītājs var lasīt, bet nevar mainīt organizācijas datus. Redaktors un administrators var pārvaldīt saturu.</p></div></div>
   <div className="org-list">{team.map(member=><div className="org-row" key={member.user_id}><div><strong>{member.email}</strong></div><span className="org-status">{ROLE_LABELS[member.role]||member.role}</span></div>)}</div>
   {activeOrg?.role==='owner'&&<div className="org-invite"><label>Uzaicināt kā<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="editor">Redaktors</option><option value="admin">Administrators</option><option value="viewer">Skatītājs</option></select></label>
    <button className="button primary" type="button" disabled={busy} onClick={createInvitation}>Izveidot uzaicinājumu</button>{inviteLink&&<label>Uzaicinājuma saite<input readOnly value={inviteLink} onFocus={e=>e.target.select()}/></label>}</div>}
  </section>}

  {panel==='profile'&&profile&&<div className="org-v3-profile-wrap">
   <OrganizerProfileEditor value={profile} onChange={patch=>{setProfile(v=>({...v,...patch}));setProfileDirty(true);}}
    logoFile={profileLogo} onLogoChange={file=>{setProfileLogo(file);setProfileDirty(true);}}
    busy={busy} dirty={profileDirty} canEdit={Boolean(canEdit)} onSubmit={saveProfile}
    onCancel={()=>{setProfile({...activeOrg});setProfileLogo(null);setProfileDirty(false);setError('');setNotice('');}}
    stats={{addresses:managedVenues.length,publicAddresses:managedVenues.filter(v=>v.is_public).length,events:orgSubmissions.length,published:orgSubmissions.filter(e=>e.status==='published').length}}
    lastModified={activeOrg?.updated_at}/>
   </div>}

 </section></ProfileShell>;
}

export default function OrganizerPage(){return <Suspense fallback={<div className="meets-profile-skeleton" role="status">Ielādē organizatorus…</div>}><OrganizerPageInner/></Suspense>}

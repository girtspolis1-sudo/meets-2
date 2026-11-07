'use client';
import Link from 'next/link';
import {Suspense,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import VenueLocationPicker from './venue-location-picker.jsx';
import ShareButton from '../components/share-button.jsx';
import {rigaDate} from '../../lib/meets-personal.js';
import {resolveOrganizationId,canWriteOrganization,submissionDateLabel,organizerTodo,eventStatusMark} from '../../lib/organizer-workspace.js';
import {refreshSession as renewToken} from '../../lib/auth-client.js';
import {reasonLabel} from '../../lib/submission-review.js';
import {whenLabel} from '../../lib/map-nearby.js';
import {eventTerm} from '../../lib/event-term.js';
import {SOCIAL_NETWORKS,cleanSocialLinks,socialLabel} from '../../lib/social-links.js';
import {organizerPath} from '../../lib/organizer-path.js';
import {flyerPath,sharePath} from '../../lib/shared-event.js';
import QuickEvent from './quick-event.jsx';

const SESSION='meets_user_session_v1';
const PANELS=new Set(['overview','events','venues','team','profile']);
function organizationsFrom(items,id){return id&&Array.isArray(items)&&items.some(o=>o.id===id)?id:'';}
const EDITOR='/registre-pasakumu/vienkarsi';
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
 const value=await renewToken(session.refresh_token);
 localStorage.setItem(SESSION,JSON.stringify(value));
 window.dispatchEvent(new Event('meets-user-changed'));
 return value;
}
// MEETS feedback: the reason picked by the reviewer and the comment.
function reviewFeedback(item){return [reasonLabel(item.review_reason),item.admin_note].filter(Boolean).join(' — ');}
// Colour, icon and words for where an event stands (lib/organizer-workspace.js).
const MARK_ICONS={
 green:<path d="M20 6 9 17l-5-5"/>,
 yellow:<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
 red:<><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5h.01"/></>,
 gray:<path d="M6 6l12 12M18 6 6 18"/>
};
function StatusMark({item,archived=false}){
 const mark=eventStatusMark(item,{archived});
 return <span className={'org-mark org-mark-'+mark.tone} title={mark.hint||undefined}>
  <span className="org-mark-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{MARK_ICONS[mark.tone]}</svg></span>
  <span className="org-mark-label">{mark.label}</span>
  <span className="org-mark-vis">{mark.visibility}</span>
  {mark.tone==='red'&&mark.hint&&<span className="sr-only">: {mark.hint}</span>}
 </span>;
}
function eventDate(item){return submissionDateLabel(item);}
// The same wording and term colour as the public site: "Pēc 3 dienām", green today, yellow tomorrow.
function When({item}){
 const today=rigaDate();
 if(!item.date_from)return <span className="org-when">Datums nav norādīts</span>;
 const end=item.date_to||item.date_from;
 if(end<today)return <span className="org-when term-ended">Beidzies · {eventDate(item)}</span>;
 const event={date_from:item.date_from,date_to:item.date_to,time_from:item.time_from};
 const short=item.date_from.slice(8,10)+'.'+item.date_from.slice(5,7)+'.';
 return <span className="org-when-wrap"><span className={'org-when term-'+eventTerm(event,today).tone}>{whenLabel(event,today)}</span> <span className="org-when-date">{short}</span></span>;
}
// Edit is possible for drafts, returned events and anything already public.
// After the last day an event stays editable for 3 days (new dates bring it back),
// then it is archived for 30 days (grey, copy only), then it is no longer listed.
const EDIT_DAYS=3,ARCHIVE_DAYS=30;
function daysSinceEnd(item){
 const end=item.date_to||item.date_from;
 if(!end)return -1;
 return Math.round((Date.parse(rigaDate()+'T12:00:00Z')-Date.parse(end+'T12:00:00Z'))/864e5);
}
function lifecycle(item){
 const d=daysSinceEnd(item);
 if(d<=0)return 'current';
 if(d<=EDIT_DAYS)return 'ended';
 if(d<=ARCHIVE_DAYS)return 'archived';
 return 'gone';
}
function canChange(item){
 if(['archived','gone'].includes(lifecycle(item)))return false;
 return ['draft','rejected','private'].includes(item.status)||Boolean(item.event_id)&&['published','pending_review'].includes(item.status);
}
// Events with a working share link: private, waiting for review or published.
function shareable(item){return Boolean(item.share_token)&&['private','pending_review','published'].includes(item.status);}
function canCancel(item){return !['cancelled','declined'].includes(item.status)&&!['archived','gone'].includes(lifecycle(item));}
function future(item){const end=item.date_to||item.date_from;return end?end>=rigaDate():true;}
// "Gaidāmie" keeps events that ended in the last 3 days, so they can still be renewed.
function inUpcoming(item){return ['current','ended'].includes(lifecycle(item));}

const EMPTY_CONTACT={type:'email',label:'',value:'',public:false};
function ContactFields({value=[],onChange,disabled=false}){
 const fields=Array.isArray(value)?value:[];
 const update=(i,key,v)=>onChange(fields.map((x,j)=>i===j?{...x,[key]:v}:x));
 return <fieldset className="org-contact-fields" disabled={disabled}><legend>Kontaktinformācija</legend>
  {fields.map((item,i)=><div className="org-contact-row" key={i}>
   <label>Veids<select value={item.type} onChange={e=>update(i,'type',e.target.value)}><option value="email">E-pasts</option><option value="phone">Telefons</option><option value="person">Kontaktpersona</option><option value="other">Cits kontakts</option></select></label>
   <label>Apzīmējums<input maxLength={80} placeholder="Piem., administrācija" value={item.label||''} onChange={e=>update(i,'label',e.target.value)}/></label>
   <label>Kontaktinformācija<input type={item.type==='email'?'email':item.type==='phone'?'tel':'text'} maxLength={254} required placeholder={item.type==='email'?'epasts@piemers.lv':item.type==='phone'?'+371 ...':'Vārds vai cita informācija'} value={item.value||''} onChange={e=>update(i,'value',e.target.value)}/></label>
   <label className="org-contact-visibility"><input type="checkbox" checked={item.public===true} onChange={e=>update(i,'public',e.target.checked)}/> Publisks</label>
   <button className="button" type="button" aria-label={'Noņemt kontaktu '+(i+1)} onClick={()=>onChange(fields.filter((_,j)=>i!==j))}>Noņemt</button>
  </div>)}
  {fields.length<25&&<button className="button org-add-contact" type="button" onClick={()=>onChange([...fields,{...EMPTY_CONTACT}])}>+ Pievienot kontaktu</button>}
 </fieldset>;
}
// One field per network; a link or just "@name" is enough.
function SocialFields({value=[],onChange,disabled=false}){
 const map=Object.fromEntries((Array.isArray(value)?value:[]).map(x=>[x.network,x.url]));
 const set=(network,url)=>onChange(SOCIAL_NETWORKS.map(n=>({network:n.key,url:n.key===network?url:(map[n.key]||'')})).filter(x=>x.url));
 return <fieldset className="org-social-fields" disabled={disabled}><legend>Sociālie tīkli</legend>
  <p className="meets-muted">Ieraksti saiti vai tikai lietotājvārdu (piem., @marupes_kn). Tukšos laukus nerādīsim.</p>
  {SOCIAL_NETWORKS.map(n=><label key={n.key}>{n.label}<input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={300}
   placeholder={n.placeholder} value={map[n.key]||''} onChange={e=>set(n.key,e.target.value)}/></label>)}
 </fieldset>;
}
// Main address: typed, or found with the search / picked on the map (with coordinates).
function OrgAddressField({value,onChange,disabled=false}){
 const [open,setOpen]=useState(false);
 const point=value.address_latitude!=null&&value.address_latitude!==''&&value.address_longitude!=null;
 return <div className="org-address-field">
  <label>Galvenā adrese<input disabled={disabled} maxLength={300} value={value.address||''} placeholder="Pilsēta, iela, mājas numurs"
   onChange={e=>onChange({address:e.target.value,address_latitude:null,address_longitude:null})}/></label>
  <div className="org-address-tools">
   {point?<span className="org-address-point">⌖ Atzīmēts kartē ({Number(value.address_latitude).toFixed(5)}, {Number(value.address_longitude).toFixed(5)})</span>:<span className="org-address-point muted">Kartes punkts nav atzīmēts</span>}
   {!disabled&&<button type="button" className="button compact" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Aizvērt karti':'⌖ Atrast kartē'}</button>}
  </div>
  {open&&!disabled&&<VenueLocationPicker value={{name:'',address:value.address||'',latitude:value.address_latitude??'',longitude:value.address_longitude??''}}
   existingVenues={[]} publicVenues={[]} onSelect={place=>{onChange({address:place.address||place.name||value.address||'',address_latitude:place.latitude??null,address_longitude:place.longitude??null});setOpen(false);}}/>}
 </div>;
}
// Shown while saving, step by step, so it is clear that something is happening.
function SavingOverlay({steps,current}){
 if(!steps?.length)return null;
 return <div className="org-saving-overlay" role="alertdialog" aria-modal="true" aria-labelledby="org-saving-title">
  <div className="org-saving-card">
   <span className="org-saving-spinner" aria-hidden="true"/>
   <strong id="org-saving-title">Saglabā…</strong>
   <ol>{steps.map((step,i)=><li key={step} className={i<current?'done':i===current?'current':''}>{i<current?'✓ ':''}{step}</li>)}</ol>
  </div>
 </div>;
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
 const [saving,setSaving]=useState({steps:[],current:0});
 const step=(steps,current)=>setSaving({steps,current});
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [creating,setCreating]=useState(false);
 const [newOrg,setNewOrg]=useState({name:'',description:'',address:'',address_public:false,contacts:[],is_public:false,image_url:''});
 const [newLogo,setNewLogo]=useState(null),[profileLogo,setProfileLogo]=useState(null);
 const profileLogoPreview=useMemo(()=>profileLogo?URL.createObjectURL(profileLogo):'',[profileLogo]);
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
  if(profileDirty&&!window.confirm('Rīkotāja profilā ir nesaglabātas izmaiņas. Pārslēgt rīkotāju un tās atmest?'))return;
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
  const steps=['Izveido rīkotāju',newLogo?'Augšupielādē logo':null,'Saglabā adresi un kontaktus','Ielādē rīkotāja vidi'].filter(Boolean);
  let n=0;step(steps,0);
  try{
   const created=await rpc('createOrganization',{name:newOrg.name,description:newOrg.description,kind:'organizer',address:newOrg.address,contacts:newOrg.contacts},session);
   const id=created.item?.id;if(!id)throw Error('Rīkotāju neizdevās izveidot.');
   step(steps,++n);
   const image_url=newLogo?await uploadOrgLogo(newLogo,id,session.access_token):'';
   if(newLogo)step(steps,++n);
   if(newOrg.is_public||image_url)await rpc('updateOrganization',{organization_id:id,name:newOrg.name,description:newOrg.description,image_url,is_public:newOrg.is_public},session);
   await rpc('saveOrgContacts',{organization_id:id,address:newOrg.address,address_latitude:newOrg.address_latitude??null,address_longitude:newOrg.address_longitude??null,contacts:newOrg.contacts,contacts_public:newOrg.is_public,address_public:newOrg.address_public===true},session);
   if((newOrg.social_links||[]).length)await rpc('saveOrgSocials',{organization_id:id,social_links:cleanSocialLinks(newOrg.social_links)},session);
   step(steps,++n);
   const data=await rpc('list',{},session);setItems(data);
   setNewOrg({name:'',description:'',address:'',contacts:[],is_public:false,image_url:''});setNewLogo(null);setCreating(false);setOrgId(id);setPanel('overview');
   const returnTo=new URLSearchParams(window.location.search).get('return');
   if(returnTo&&returnTo.startsWith('/')&&!returnTo.startsWith('//')){const join=returnTo.includes('?')?'&':'?';window.location.assign(returnTo+join+'org='+encodeURIComponent(id));return;}
   replaceUrl(id,'overview');setNotice('Rīkotājs izveidots.');
  }catch(e){setError(e.message);}finally{setBusy(false);step([],0);}
 }
 async function saveProfile(e){
  e.preventDefault();if(!profile||!orgId)return;
  setBusy(true);setError('');setNotice('');
  const steps=[profileLogo?'Augšupielādē logo':null,'Saglabā profilu','Saglabā adresi, kontaktus un sociālos tīklus','Atjauno datus'].filter(Boolean);
  let n=0;step(steps,0);
  try{
   const image_url=profileLogo?await uploadOrgLogo(profileLogo,orgId,session.access_token):profile.image_url;
   if(profileLogo)step(steps,++n);
   await rpc('updateOrganization',{organization_id:orgId,...profile,image_url},session);
   step(steps,++n);
   await rpc('saveOrgContacts',{organization_id:orgId,address:profile.address||'',address_latitude:profile.address_latitude??null,address_longitude:profile.address_longitude??null,contacts:profile.contacts||[],contacts_public:profile.is_public===true,address_public:profile.address_public===true,
    legal_name:profile.legal_name||'',reg_number:profile.reg_number||'',vat_number:profile.vat_number||'',bank_name:profile.bank_name||'',bank_account:profile.bank_account||'',requisites_public:profile.requisites_public===true},session);
   await rpc('saveOrgSocials',{organization_id:orgId,social_links:cleanSocialLinks(profile.social_links||[])},session);
   step(steps,++n);
   const data=await rpc('list',{},session);setItems(data);setProfileLogo(null);setProfileDirty(false);setNotice('Rīkotāja profils saglabāts.');
  }catch(e){setError(e.message);}finally{setBusy(false);step([],0);}
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
 async function cancelEvent(item){
  const live=item.status==='published';
  const reason=window.prompt(live?`Atcelt “${item.title||'pasākumu'}”? Tas uzreiz pazudīs no kartes un saraksta.\nIemesls (neobligāti):`:`Atcelt “${item.title||'pasākumu'}”? Tas netiks publicēts.\nIemesls (neobligāti):`,'');
  if(reason===null)return;
  await perform('cancelEvent',{id:item.id,reason},()=>setNotice(live?'Pasākums atcelts un noņemts no kartes.':'Pasākums atcelts.'));
 }
 async function deleteAllEvents(){
  const n=orgSubmissions.length;
  const typed=window.prompt(`Tiks izdzēsti visi ${n} “${activeOrg?.name}” pasākumi, publicētie pazudīs no kartes. To nevar atsaukt.\nLai turpinātu, ieraksti DZĒST:`,'');
  if(String(typed||'').trim().toUpperCase()!=='DZĒST')return;
  setBusy(true);setError('');setNotice('');step(['Dzēš pasākumus','Atjauno datus'],0);
  try{
   const r=await rpc('deleteOrgEvents',{organization_id:orgId},session);
   step(['Dzēš pasākumus','Atjauno datus'],1);
   const data=await rpc('list',{},session);setItems(data);
   setNotice(`Izdzēsti ${r?.result?.submissions_deleted??n} pasākumi. Tagad vari izdzēst rīkotāju.`);
  }catch(e){setError(e.message);}finally{setBusy(false);step([],0);}
 }
 async function deleteOrganization(){
  const typed=window.prompt(`Dzēst rīkotāju “${activeOrg?.name}” kopā ar tā vietām, komandu un kontaktiem? To nevar atsaukt.\nLai turpinātu, ieraksti rīkotāja nosaukumu:`,'');
  if(String(typed||'').trim().toLocaleLowerCase('lv')!==String(activeOrg?.name||'').trim().toLocaleLowerCase('lv'))return;
  setBusy(true);setError('');setNotice('');step(['Dzēš rīkotāju','Atjauno datus'],0);
  try{
   await rpc('deleteOrganization',{organization_id:orgId},session);
   step(['Dzēš rīkotāju','Atjauno datus'],1);
   const data=await rpc('list',{},session);setItems(data);
   setOrgId('');setPanel('overview');window.history.replaceState(null,'','/organizators');
   setNotice('Rīkotājs izdzēsts.');
  }catch(e){setError(e.message);}finally{setBusy(false);step([],0);}
 }
 function copyWithDate(item){
  const date=window.prompt('Jaunās kopijas sākuma datums (GGGG-MM-DD):',item.date_from||rigaDate());
  if(!date)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){setError('Datumu ieraksti formā GGGG-MM-DD, piem., '+rigaDate()+'.');return;}
  window.location.assign(EDITOR+'?org='+orgId+'&copy='+item.id+'&date='+date);
 }
 async function copyShareLink(item){
  const url=window.location.origin+sharePath(item.share_token);
  try{await navigator.clipboard.writeText(url);setNotice('Saite nokopēta: '+url);}
  catch{window.prompt('Nokopē saiti:',url);}
 }
 function renderActions(item,primary=false){
  if(!canEdit)return item.status==='published'&&item.event_id?<Link className="button compact" href={'/pasakumi/'+item.event_id}>Skatīt publiski</Link>
   :shareable(item)?<a className="button compact" href={sharePath(item.share_token)} target="_blank" rel="noopener noreferrer">Atvērt saiti ↗</a>:null;
  const stage=lifecycle(item);
  const editLabel=stage==='ended'?'Atjaunot ar jauniem datumiem':item.status==='rejected'?'Labot un iesniegt':item.status==='draft'?'Turpināt':'Labot';
  if(stage==='archived')return <div className="org-row-actions">
   <Link className="button compact" href={EDITOR+'?org='+orgId+'&copy='+item.id}>Kopēt kā jaunu</Link>
   <button type="button" className="button compact ghost" onClick={()=>copyWithDate(item)}>Kopēt ar citu datumu…</button>
  </div>;
  return <div className="org-row-actions">
   {canChange(item)&&<Link className={'button compact'+(primary||item.status==='rejected'?' primary':'')} href={EDITOR+'?org='+orgId+'&edit='+item.id}>{editLabel}</Link>}
   <details className="org-more-menu"><summary aria-label={'Vairāk darbību: '+(item.title||'pasākums')}>⋯</summary>
    <div role="menu">
     {item.status==='published'&&item.event_id&&<Link role="menuitem" href={'/pasakumi/'+item.event_id}>Skatīt publiski ↗</Link>}
     {shareable(item)&&<a role="menuitem" href={sharePath(item.share_token)} target="_blank" rel="noopener noreferrer">Atvērt saiti ↗</a>}
     {shareable(item)&&<button role="menuitem" type="button" onClick={()=>copyShareLink(item)}>Kopēt saiti</button>}
     {shareable(item)&&<a role="menuitem" href={flyerPath(item.share_token)} target="_blank" rel="noopener noreferrer">Sludinājums drukai ↗</a>}
     <Link role="menuitem" href={EDITOR+'?org='+orgId+'&copy='+item.id}>Dublēt</Link>
     <button role="menuitem" type="button" onClick={()=>copyWithDate(item)}>Dublēt ar citu datumu…</button>
     {canCancel(item)&&<button role="menuitem" type="button" className="danger" onClick={()=>cancelEvent(item)}>Atcelt pasākumu…</button>}
    </div>
   </details>
  </div>;
 }
 function changeFilter(key,value){
  const next={...filters,[key]:value};setFilters(next);replaceUrl(orgId,'events',next);
 }

 const filteredEvents=useMemo(()=>{
  const q=filters.query.trim().toLocaleLowerCase('lv');
  return orgSubmissions.filter(item=>{
   if(filters.status!=='all'&&item.status!==filters.status)return false;
   if(lifecycle(item)==='gone')return false;
   if(filters.time==='upcoming'&&!inUpcoming(item))return false;
   if(filters.time==='past'&&lifecycle(item)!=='archived')return false;
   if(filters.venue&&item.venue_id!==filters.venue)return false;
   if(q&&!String(item.title+' '+item.venue_name+' '+item.address).toLocaleLowerCase('lv').includes(q))return false;
   return true;
  }).sort((a,b)=>{
   const ad=a.date_from||'9999-12-31',bd=b.date_from||'9999-12-31';
   return filters.time==='past'?bd.localeCompare(ad):ad.localeCompare(bd);
  });
 },[orgSubmissions,filters]);

 const todo=useMemo(()=>organizerTodo(orgSubmissions),[orgSubmissions]);
 // Until the first address and event exist, the step list replaces the empty panels.
 const onboarding=Boolean(canEdit&&!orgSubmissions.length);
 const metrics=useMemo(()=>({
  drafts:orgSubmissions.filter(x=>x.status==='draft').length,
  review:orgSubmissions.filter(x=>x.status==='pending_review').length,
  fixes:orgSubmissions.filter(x=>x.status==='rejected').length,
  published:orgSubmissions.filter(x=>x.status==='published'&&future(x)).length,
  private:orgSubmissions.filter(x=>x.status==='private'&&future(x)).length
 }),[orgSubmissions]);
 const STATUS_CARDS=[
  ['draft','Melnraksti',metrics.drafts,'Vēl nav iesniegti'],
  ['pending_review','Pārbaudē',metrics.review,'Gaida MEETS'],
  ['rejected','Jālabo',metrics.fixes,'MEETS lūdz precizēt'],
  ['published','Publicēti',metrics.published,'Gaidāmi, redzami kartē'],
  // Shown only to organizers who use private events.
  ...(metrics.private?[['private','Privāti',metrics.private,'Redzami tikai ar saiti']]:[])
 ];

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
    <div className="org-card-counts"><span><strong>{venues.length}</strong> vietas</span><span><strong>{events.length}</strong> pasākumi</span><span><strong>{published.length}</strong> publicēti</span></div>
   </div>
   <div className="org-card-actions">
    <button className="button primary" type="button" onClick={()=>chooseOrganization(org.id)}>Atvērt pārskatu →</button>
    {org.role!=='viewer'&&<Link className="button" href={EDITOR+'?org='+org.id}>+ Pasākums</Link>}
   </div>
  </article>;
 }

 if(!loaded)return <div className="org-skeleton" role="status" aria-label="Ielādē rīkošanas vidi">
  <span className="org-skeleton-line wide"/><span className="org-skeleton-line"/>
  <div className="org-skeleton-cards">{[0,1,2,3].map(i=><span key={i}/>)}</div>
  <span className="org-skeleton-block"/><span className="org-skeleton-block"/>
 </div>;
 if(!session)return <ProfileShell><section className="org-workspace"><div className="org-empty-state">
  <h1>Pasākumu rīkošana</h1><p>Lai reģistrētu un pārvaldītu pasākumus, vispirms pieslēdzies savam MEETS kontam.</p>
  <Link className="button primary" href="/profils">Pieslēgties →</Link>
 </div></section></ProfileShell>;

 if(!orgId||creating){
  return <ProfileShell session={session}><SavingOverlay steps={saving.steps} current={saving.current}/><section className="org-workspace">
   <header className="org-page-head"><div><p className="eyebrow">Pasākumu rīkošana</p><h1>{creating?'Jauns rīkotājs':'Tavi rīkotāji'}</h1>
    {creating&&<p>Izveido rīkotāja profilu un pievieno tam norises vietas un pasākumus.</p>}</div>
    {!creating&&<button className="button" type="button" onClick={()=>setCreating(true)}>+ Jauns rīkotājs</button>}</header>
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
   {creating?<form className="org-form-card" onSubmit={createOrganization}>
    <h2>Rīkotāja profils</h2><p className="meets-muted">Pietiek ar nosaukumu. Pārējo vari papildināt jebkurā laikā rīkotāja profilā.</p>
    <label>Rīkotāja nosaukums *<input required minLength={2} maxLength={160} value={newOrg.name} onChange={e=>setNewOrg(v=>({...v,name:e.target.value}))} placeholder="Piem., Mārupes kultūras nams" autoFocus/></label>
    <label>Īss apraksts<textarea rows={3} maxLength={2000} value={newOrg.description} onChange={e=>setNewOrg(v=>({...v,description:e.target.value}))} placeholder="Ko organizējat un kam paredzēti jūsu pasākumi?"/></label>
    <label className="org-public-choice"><input type="checkbox" checked={newOrg.is_public===true} onChange={e=>setNewOrg(v=>({...v,is_public:e.target.checked}))}/><span><strong>Publisks rīkotāja profils</strong><small>{newOrg.is_public?'Nosaukums, apraksts un logo būs redzami apmeklētājiem. Adrese un kontakti tikai ar atsevišķu atzīmi.':'Profils redzams tikai tev un tavai komandai.'}</small></span></label>
    <details className="org-more-details">
     <summary>Papildu informācija <small>(logo, adrese, kontakti, sociālie tīkli — neobligāti)</small></summary>
     <label>Rīkotāja logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setNewLogo(e.target.files?.[0]||null)}/>{newLogo&&<small>{newLogo.name}</small>}</label>
     <OrgAddressField value={newOrg} onChange={v=>setNewOrg(o=>({...o,...v}))}/>
     <label className="org-contact-visibility"><input type="checkbox" checked={newOrg.address_public===true} onChange={e=>setNewOrg(v=>({...v,address_public:e.target.checked}))}/> Rādīt adresi publiski</label>
     <ContactFields value={newOrg.contacts} onChange={contacts=>setNewOrg(v=>({...v,contacts}))}/>
     <SocialFields value={newOrg.social_links||[]} onChange={social_links=>setNewOrg(v=>({...v,social_links}))}/>
    </details>
    <div className="org-actions"><button className="button" type="button" onClick={()=>setCreating(false)}>Atcelt</button><button className="button primary" disabled={busy}>Izveidot rīkotāju →</button></div>
   </form>:<>
    <QuickEvent organizations={organizations} heading={organizations.length?'Jauns pasākums':'Izveido pirmo pasākumu'}/>
    {organizations.length?<div className="org-card-grid">{organizations.map(orgCard)}</div>:<p className="org-empty org-first-note">Rīkotāja profils izveidosies kopā ar pirmo pasākumu — pietiek ierakstīt tā nosaukumu redaktorā. Vai arī <button type="button" className="text-button" onClick={()=>setCreating(true)}>izveido rīkotāju atsevišķi</button>.</p>}
   </>}
  </section></ProfileShell>;
 }

 return <ProfileShell session={session} activeOrganization={activeOrg}><SavingOverlay steps={saving.steps} current={saving.current}/><section className="org-workspace">
  <header className="org-page-head"><div><p className="eyebrow">Pasākumu rīkošana · {ROLE_LABELS[activeOrg?.role]||activeOrg?.role}{activeOrg?.trusted&&<span className="org-trusted-badge" title="MEETS uzticams rīkotājs: pasākumi tiek publicēti bez papildu pārbaudes">Publicē bez pārbaudes</span>}</p>
   {organizations.length>1?<details className="org-switcher">
    <summary><h1>{activeOrg?.name}<span aria-hidden="true">▾</span></h1><span className="sr-only">Mainīt rīkotāju</span></summary>
    <ul role="menu">
     {organizations.map(org=><li key={org.id}><button role="menuitem" type="button" aria-current={org.id===orgId?'true':undefined}
      onClick={e=>{e.currentTarget.closest('details').open=false;chooseOrganization(org.id);}}>{org.name}<small>{ROLE_LABELS[org.role]||org.role}</small></button></li>)}
     <li><button role="menuitem" type="button" onClick={()=>{setOrgId('');setCreating(false);window.history.replaceState(null,'','/organizators');}}>Visi rīkotāji</button></li>
     <li><button role="menuitem" type="button" onClick={()=>{setOrgId('');setCreating(true);}}>+ Jauns rīkotājs</button></li>
    </ul>
   </details>:<h1>{activeOrg?.name}</h1>}
  </div>
  {activeOrg?.is_public&&<div className="org-head-share"><Link className="button compact ghost" href={organizerPath(activeOrg)}>Publiskais profils ↗</Link><ShareButton path={organizerPath(activeOrg)} title={activeOrg.name+' — pasākumi MEETS'} label="Dalīties" className="button compact"/></div>}
  </header>

  {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}

  {panel==='overview'&&<div className="org-stack">
   {canEdit&&<QuickEvent organizations={organizations} orgId={orgId}/>}
   {onboarding&&<section className="org-panel org-onboarding" aria-labelledby="org-onboarding-title">
    <h2 id="org-onboarding-title">Pirmie soļi</h2>
    <ol className="org-steps">
     <li className="done"><span aria-hidden="true">✓</span><div><strong>Rīkotājs izveidots</strong><small>{activeOrg?.name}</small></div></li>
     <li className={orgSubmissions.length?'done':'current'}><span aria-hidden="true">{orgSubmissions.length?'✓':'2'}</span><div><strong>Iesniedz pirmo pasākumu</strong><small>Norises vietu vari pievienot turpat redaktorā. Pēc MEETS pārbaudes pasākums parādīsies kartē.</small></div>{!orgSubmissions.length&&<Link className="button primary" href={EDITOR+'?org='+orgId}>Jauns pasākums →</Link>}</li>
     <li className={managedVenues.length?'done':''}><span aria-hidden="true">{managedVenues.length?'✓':'3'}</span><div><strong>Saglabā savas norises vietas <em>(neobligāti)</em></strong><small>Vietas izmantosi atkārtoti, un tām var būt publisks kalendārs.</small></div>{!managedVenues.length&&<Link className="button" href={'/registre-vietu?org='+orgId}>Pievienot vietu</Link>}</li>
    </ol>
   </section>}
   {(todo.rejected.length>0||todo.drafts.length>0)&&<section className="org-panel org-todo" aria-labelledby="org-todo-title">
    <div className="org-panel-head"><h2 id="org-todo-title">Jāpabeidz</h2></div>
    <div className="org-list">
     {todo.rejected.map(item=><div className="org-row org-row-attention" key={item.id}><div><strong>{item.title||'Bez nosaukuma'}</strong><small><When item={item}/> · MEETS lūdz precizēt</small>{reviewFeedback(item)&&<em>{reviewFeedback(item)}</em>}</div><StatusMark item={item}/>{canEdit&&<Link className="button primary" href={EDITOR+'?org='+orgId+'&edit='+item.id}>Labot un iesniegt</Link>}</div>)}
     {todo.drafts.map(item=><div className="org-row" key={item.id}><div><strong>{item.title||'Melnraksts bez nosaukuma'}</strong><small><When item={item}/> · {eventStatusMark(item).tone==='red'?eventStatusMark(item).hint:'Melnraksts, vēl nav iesniegts'}</small></div><StatusMark item={item}/>{canEdit&&<Link className="button compact" href={EDITOR+'?org='+orgId+'&edit='+item.id}>Turpināt</Link>}</div>)}
    </div>
   </section>}
   {todo.review.length>0&&<p className="org-review-note" role="status">{todo.review.length===1?'1 pasākums':todo.review.length+' pasākumi'} gaida MEETS pārbaudi. Statusa maiņu redzēsi šeit.</p>}
   <section className="org-status-cards" aria-label="Pasākumi pēc statusa">
    {STATUS_CARDS.map(([status,label,count,hint])=><Link key={status} href={eventFilterLink(status)} className={'org-status-card org-status-card-'+status.replace('_','-')+(count?'':' empty')}>
     <strong>{count}</strong><span>{label}</span><small>{hint}</small></Link>)}
   </section>
   {!onboarding&&<>
   <section className="org-panel"><div className="org-panel-head"><h2>Tuvākie pasākumi</h2><button className="text-button org-head-link" type="button" onClick={()=>choosePanel('events')}>Visi pasākumi →</button></div>
    <div className="org-list">{orgSubmissions.filter(x=>future(x)&&!['rejected','draft','declined','cancelled'].includes(x.status)).sort((a,b)=>(a.date_from||'9999').localeCompare(b.date_from||'9999')).slice(0,6).map(item=><div className="org-row" key={item.id}>
     <div><strong>{item.title||'Bez nosaukuma'}</strong><small><When item={item}/> · {item.venue_name||'Vieta nav norādīta'}</small></div>
     <StatusMark item={item}/>
     {renderActions(item)}
    </div>)}
    {!orgSubmissions.filter(x=>future(x)&&!['rejected','draft','declined','cancelled'].includes(x.status)).length&&<p className="org-empty">Nav gaidāmu iesniegtu pasākumu. {canEdit&&<Link href={EDITOR+'?org='+orgId}>Iesniedz jaunu →</Link>}</p>}</div>
   </section>
   <section className="org-panel"><div className="org-panel-head"><h2>Manas norises vietas</h2>{canEdit&&<Link className="button compact" href={'/registre-vietu?org='+orgId}>+ Pievienot vietu</Link>}</div><div className="org-list">{managedVenues.slice(0,5).map(v=><div className="org-row" key={v.id}><div><strong>{v.name}</strong><small>{v.address} · {orgSubmissions.filter(x=>x.venue_id===v.id).length} pasākumi</small></div><div className="org-row-actions"><button type="button" className="button compact ghost" onClick={()=>choosePanel('venues')}>Atvērt</button>{canEdit&&<Link className="button compact" href={EDITOR+'?org='+orgId+'&venue='+v.id}>+ Pasākums šeit</Link>}</div></div>)}{!managedVenues.length&&<p className="org-empty">Vēl nav saglabātu vietu. Tās var pievienot arī pasākuma redaktorā.</p>}</div></section>
   </>}
  </div>}

  {panel==='events'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Pasākumi</h2></div>{canEdit&&<Link className="button compact" href={EDITOR+'?org='+orgId}>+ Jauns pasākums</Link>}</div>
   <div className="org-filters">
    <label>Statuss<select value={filters.status} onChange={e=>changeFilter('status',e.target.value)}><option value="all">Visi</option><option value="draft">Melnraksti</option><option value="private">Privātie</option><option value="pending_review">Pārbaudē</option><option value="rejected">Jālabo</option><option value="declined">Netika publicēti</option><option value="published">Publicētie</option><option value="cancelled">Atceltie</option></select></label>
    <label>Laiks<select value={filters.time} onChange={e=>changeFilter('time',e.target.value)}><option value="upcoming">Gaidāmie</option><option value="past">Arhīvs (līdz 30 d.)</option><option value="all">Visi</option></select></label>
    <label>Vieta<select value={filters.venue} onChange={e=>changeFilter('venue',e.target.value)}><option value="">Visas vietas</option>{managedVenues.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}{usedVenues.map(v=><option value={v.id} key={v.id}>{v.name} · izmantota</option>)}</select></label>
    <label className="org-filter-search">Meklēt<input type="search" value={filters.query} onChange={e=>changeFilter('query',e.target.value)} placeholder="Nosaukums vai vieta"/></label>
   </div>
   <div className="org-table" role="table" aria-label="Rīkotāja pasākumi">
    <div className="org-table-head" role="row"><span>Nosaukums</span><span>Datums</span><span>Vieta</span><span>Statuss</span><span>Darbības</span></div>
    {filteredEvents.map(item=><div className={'org-table-row lifecycle-'+lifecycle(item)} role="row" key={item.id}>
     <div data-label="Nosaukums"><strong>{item.title||'Bez nosaukuma'}</strong>{['rejected','declined'].includes(item.status)&&reviewFeedback(item)&&<small className="org-rejection">{item.status==='declined'?'Iemesls':'Jālabo'}: {reviewFeedback(item)}</small>}</div>
     <span data-label="Datums"><When item={item}/></span><span data-label="Vieta">{item.venue_name||'Nav norādīta'}</span>
     <span data-label="Statuss"><StatusMark item={item} archived={lifecycle(item)==='archived'}/>{item.status==='draft'&&eventStatusMark(item).tone==='red'&&<small className="org-status-note org-status-note-red">{eventStatusMark(item).hint}</small>}{lifecycle(item)==='ended'&&<small className="org-status-note">Beidzies — vari atjaunot vēl {EDIT_DAYS-daysSinceEnd(item)+1} d.</small>}</span>
     <div data-label="Darbības">{renderActions(item)}</div>
    </div>)}
   </div>
   {!filteredEvents.length&&<p className="org-empty">Šiem filtriem pasākumi nav atrasti. {(filters.status!=='all'||filters.query||filters.venue)&&<button type="button" className="text-button" onClick={()=>{const next={status:'all',time:filters.time,query:'',venue:''};setFilters(next);replaceUrl(orgId,'events',next);}}>Rādīt visus</button>}</p>}
  </section>}

  {panel==='venues'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Manas norises vietas</h2></div>{canEdit&&<Link className="button compact" href={'/registre-vietu?org='+orgId}>+ Pievienot vietu</Link>}</div>
   <div className="org-list">{managedVenues.map(v=><div className="org-row" key={v.id}>
    <div><strong>{v.name}</strong><small>{v.address||'Adrese nav norādīta'} · {v.is_public?'Publiska':'Privāta'} · {orgSubmissions.filter(x=>x.venue_id===v.id&&future(x)).length} gaidāmi pasākumi</small></div>
    <span className="org-status">Pārvaldīta</span><div className="org-row-actions">{v.is_public&&<Link className="button compact ghost" href={'/vietas/'+v.id}>Atvērt ↗</Link>}{canEdit&&<><Link className="button compact ghost" href={'/registre-vietu?org='+orgId+'&edit='+v.id}>Labot</Link><Link className="button compact" href={EDITOR+'?org='+orgId+'&venue='+v.id}>+ Pasākums šeit</Link></>}</div>
   </div>)}{!managedVenues.length&&<p className="org-empty">Vēl nav saglabātu norises vietu.</p>}</div>
   {usedVenues.length>0&&<><h3>Izmantotās vietas</h3><div className="org-list">{usedVenues.map(v=><div className="org-row" key={v.id}>
    <div><strong>{v.name}</strong><small>{v.address||'Adrese nav norādīta'} · {orgSubmissions.filter(x=>x.venue_id===v.id&&future(x)).length} gaidāmi pasākumi</small></div><span className="org-status">Izmantota</span>
    <div className="org-row-actions"><Link className="button compact ghost" href={'/vietas/'+v.id}>Atvērt ↗</Link>{canEdit&&<Link className="button compact" href={EDITOR+'?org='+orgId+'&venue='+v.id}>+ Pasākums šeit</Link>}</div>
   </div>)}</div></>}
  </section>}

  {panel==='lists'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Publiskie saraksti</h2><p>Saraksts ir pasākumu izlase; tas nemaina pašu pasākumu īpašnieku.</p></div>{canEdit&&<Link className="button primary" href={'/mani-registri?org='+orgId+'&new=1'}>+ Jauns publiskais saraksts</Link>}</div>
   <div className="org-list">{lists.map(item=><div className="org-row" key={item.id}><div><strong>{item.title}</strong><small>{item.is_published?'Publisks':'Privāts'} · {(item.included_event_ids||[]).length} manuāli pievienoti</small></div><Link className="button" href={'/mani-registri?org='+orgId+'&edit='+item.id}>Atvērt</Link></div>)}
   {!lists.length&&<p className="org-empty">Šim rīkotājam vēl nav sarakstu.</p>}</div>
  </section>}

  {panel==='team'&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Komanda</h2><p>Skatītājs var lasīt, bet nevar mainīt organizācijas datus. Redaktors un administrators var pārvaldīt saturu.</p></div></div>
   <div className="org-list">{team.map(member=><div className="org-row" key={member.user_id}><div><strong>{member.email}</strong></div><span className="org-status">{ROLE_LABELS[member.role]||member.role}</span></div>)}</div>
   {activeOrg?.role==='owner'&&<div className="org-invite"><label>Uzaicināt kā<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="editor">Redaktors</option><option value="admin">Administrators</option><option value="viewer">Skatītājs</option></select></label>
    <button className="button primary" type="button" disabled={busy} onClick={createInvitation}>Izveidot uzaicinājumu</button>{inviteLink&&<label>Uzaicinājuma saite<input readOnly value={inviteLink} onFocus={e=>e.target.select()}/><small>Nosūti šo saiti komandas dalībniekam. Atverot to un pieslēdzoties MEETS kontā, notiek pievienošanās komandai ar izvēlēto lomu.</small></label>}</div>}
  </section>}

  {panel==='profile'&&profile&&<section className="org-panel">
   <div className="org-panel-head"><div><h2>Rīkotāja profils</h2><p>Personas profila vārds un rīkotāja nosaukums tiek pārvaldīti atsevišķi.</p></div>{(profile.is_public||metrics.published>0)&&<Link className="button" href={organizerPath(activeOrg)}>Publiskais priekšskatījums ↗</Link>}</div>
   <form className="org-profile-form org-split-editor" onSubmit={saveProfile}>
    <div className="org-editor-columns">
      <section className="org-editor-column org-editor-private"><h3>🔒 Pārvaldības informācija</h3><p>Informāciju vari saglabāt privāti. Publiskos laukus atzīmē atsevišķi.</p>
    <label>Rīkotāja nosaukums<input disabled={!canEdit} required minLength={2} maxLength={160} value={profile.name||''} onChange={e=>{setProfile(v=>({...v,name:e.target.value}));setProfileDirty(true);}}/></label>
    <OrgAddressField disabled={!canEdit} value={profile} onChange={v=>{setProfile(o=>({...o,...v}));setProfileDirty(true);}}/><label className="org-contact-visibility"><input type="checkbox" disabled={!canEdit} checked={profile.address_public===true} onChange={e=>{setProfile(v=>({...v,address_public:e.target.checked}));setProfileDirty(true);}}/> Rādīt adresi publiski</label>
    <ContactFields disabled={!canEdit} value={profile.contacts||[]} onChange={contacts=>{setProfile(v=>({...v,contacts}));setProfileDirty(true);}}/>
    <fieldset className="org-requisites"><legend>Rekvizīti</legend>
     {[['legal_name','Juridiskais nosaukums',200],['reg_number','Reģistrācijas numurs',60],['vat_number','PVN numurs',60],['bank_name','Banka',60],['bank_account','Konta numurs (IBAN)',60]].map(([key,label,max])=>
      <label key={key}>{label}<input disabled={!canEdit} maxLength={max} value={profile[key]||''} onChange={e=>{const value=e.target.value;setProfile(v=>({...v,[key]:value}));setProfileDirty(true);}}/></label>)}
     <label className="org-contact-visibility"><input type="checkbox" disabled={!canEdit} checked={profile.requisites_public===true} onChange={e=>{setProfile(v=>({...v,requisites_public:e.target.checked}));setProfileDirty(true);}}/> Rādīt rekvizītus publiskajā profilā</label>
    </fieldset>

      </section>
      <section className="org-editor-column org-editor-public"><h3>◉ Publiskais profils</h3><p>Apstiprini, ko par organizāciju redzēs apmeklētāji.</p>
    <div className="org-profile-logo">{profile.image_url&&<img src={profile.image_url} alt="Rīkotāja logo" width="80" height="80"/>}<label>Logo attēls<input disabled={!canEdit} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{setProfileLogo(e.target.files?.[0]||null);setProfileDirty(true);}}/></label></div>
    <label>Apraksts<textarea disabled={!canEdit} rows={5} maxLength={2000} value={profile.description||''} onChange={e=>{setProfile(v=>({...v,description:e.target.value}));setProfileDirty(true);}}/></label>
    <label>Mājaslapa<input disabled={!canEdit} type="url" maxLength={1000} value={profile.public_url||''} onChange={e=>{setProfile(v=>({...v,public_url:e.target.value}));setProfileDirty(true);}}/></label>
    <SocialFields disabled={!canEdit} value={profile.social_links||[]} onChange={social_links=>{setProfile(v=>({...v,social_links}));setProfileDirty(true);}}/>
    <label className="quick-flow-check"><input disabled={!canEdit} type="checkbox" checked={profile.is_public===true} onChange={e=>{setProfile(v=>({...v,is_public:e.target.checked}));setProfileDirty(true);}}/> Publiskot rīkotāja profilu</label>
    <div className={'org-public-preview'+(profile.is_public?'':' hidden-profile')} aria-label="Publiskā profila priekšskatījums">
     <small>{profile.is_public?'Tā profils izskatīsies apmeklētājiem':'Profils nav publisks — apmeklētāji to neredz'}</small>
     <div className="org-public-preview-card">
      {profileLogoPreview||profile.image_url?<img src={profileLogoPreview||profile.image_url} alt="" width="56" height="56"/>:<span className="org-public-preview-mark">{String(profile.name||'?').slice(0,1).toLocaleUpperCase('lv')}</span>}
      <div><strong>{profile.name||'Rīkotāja nosaukums'}</strong>
       <p>{profile.description||'Apraksts vēl nav pievienots.'}</p>
       {profile.public_url&&<span className="org-public-preview-link">{String(profile.public_url).replace(/^https?:\/\//,'')}</span>}
       {cleanSocialLinks(profile.social_links||[]).length>0&&<span className="org-public-preview-socials">{cleanSocialLinks(profile.social_links).map(l=>socialLabel(l.network)).join(' · ')}</span>}
       {profile.address_public&&profile.address&&<span>{profile.address}</span>}
       {(profile.contacts||[]).filter(c=>c.public&&c.value).map((c,i)=><span key={i}>{c.label?c.label+': ':''}{c.value}</span>)}
      </div>
     </div>
    </div>

      </section>
    </div>
    {canEdit&&<div className="org-actions"><button className="button primary" disabled={busy||!profileDirty}>Saglabāt profilu</button>{profileDirty&&<span className="org-unsaved">Ir nesaglabātas izmaiņas</span>}</div>}
   </form>
   {['owner','admin'].includes(activeOrg?.role)&&<section className="org-danger-zone" aria-labelledby="org-danger-title">
    <h3 id="org-danger-title">Dzēst rīkotāju</h3>
    <p>Dzēšana notiek divos soļos. Vispirms izdzēs visus pasākumus — publicētie uzreiz pazudīs no kartes. Pēc tam {activeOrg?.role==='owner'?'vari':'īpašnieks var'} izdzēst pašu rīkotāju kopā ar tā vietām, komandu un kontaktiem. Atjaunot nevarēs.</p>
    <ol className="org-danger-steps">
     <li className={orgSubmissions.length?'':'done'}><div><strong>1. Dzēst visus pasākumus</strong><small>{orgSubmissions.length?orgSubmissions.length+' pasākumi, t.sk. '+orgSubmissions.filter(x=>x.status==='published').length+' publicēti':'Pasākumu nav'}</small></div>
      <button type="button" className="button compact danger" disabled={busy||!orgSubmissions.length} onClick={deleteAllEvents}>Dzēst pasākumus…</button></li>
     <li><div><strong>2. Dzēst rīkotāju</strong><small>{orgSubmissions.length?'Pieejams pēc pasākumu dzēšanas':'Tiks dzēstas arī '+managedVenues.length+' vietas'}</small></div>
      <button type="button" className="button compact danger" disabled={busy||orgSubmissions.length>0||activeOrg?.role!=='owner'} onClick={deleteOrganization}>Dzēst rīkotāju…</button></li>
    </ol>
    <p className="meets-muted">Kad tev vairs nav rīkotāju, savu MEETS kontu vari izdzēst sadaļā <Link href="/konta-iestatijumi">Konta iestatījumi</Link>.</p>
   </section>}
  </section>}
 </section></ProfileShell>;
}

export default function OrganizerPage(){return <Suspense fallback={<div className="meets-profile-skeleton" role="status">Ielādē rīkotājus…</div>}><OrganizerPageInner/></Suspense>}

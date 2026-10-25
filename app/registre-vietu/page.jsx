'use client';
import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import VenueLocationPicker from '../organizators/venue-location-picker.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import ProfileShell from '../components/profile-shell.jsx';
import {QUICK_VENUE_EMPTY,validateQuickVenue,isCoordinatePair} from '../../lib/event-entry.js';

const SESSION='meets_user_session_v1';
const PREFIX='meets_venue_draft_v3';
function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function key(userId,orgId){return PREFIX+':'+(userId||'guest')+':'+(orgId||'unassigned');}
function readDraft(userId,orgId){try{return JSON.parse(localStorage.getItem(key(userId,orgId))||'null');}catch{return null;}}
async function refreshAccount(session){
 const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sesija beigusies.');
 const next={...b,expires_at:Date.now()+(b.expires_in||3600)*1000};localStorage.setItem(SESSION,JSON.stringify(next));window.dispatchEvent(new Event('meets-user-changed'));return next;
}

function VenueRegistrationInner(){
 const params=useSearchParams();
 const [form,setForm]=useState({...QUICK_VENUE_EMPTY});
 const [account,setAccount]=useState(null),[organizations,setOrganizations]=useState([]),[orgId,setOrgId]=useState('');
 const [myVenues,setMyVenues]=useState([]),[publicVenues,setPublicVenues]=useState([]);
 const [stage,setStage]=useState('edit'),[existingId,setExistingId]=useState(''),[publicId,setPublicId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saved,setSaved]=useState(null),[loaded,setLoaded]=useState(false);

 async function request(action,data={},session=account){
  if(!session?.access_token)throw Error('Pieslēdzies MEETS kontā.');
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:session.access_token,...data}),cache:'no-store'});
  const result=await response.json().catch(()=>({}));if(!response.ok){const e=new Error(result.error||'Neizdevās saglabāt.');e.status=response.status;throw e;}return result;
 }
 async function load(session){
  let current=session,result;
  try{result=await request('list',{},current);}
  catch(e){if(e.status!==401)throw e;current=await refreshAccount(current);result=await request('list',{},current);}
  setAccount(current);setOrganizations(result.organizations||[]);setMyVenues(result.venues||[]);setPublicVenues(result.publicVenues||[]);
  return {current,result};
 }
 useEffect(()=>{let alive=true;(async()=>{
  let session=sessionRead(),result={organizations:[],venues:[],publicVenues:[]};
  try{if(session?.access_token){const x=await load(session);session=x.current;result=x.result;}}catch(e){if(alive)setError(e.message);}
  if(!alive)return;
  const requested=params.get('org')||'',chosen=result.organizations?.find(o=>o.id===requested)?.id||(result.organizations?.length===1?result.organizations[0].id:'');
  setOrgId(chosen||'');
  const editId=params.get('edit');
  const editing=(result.venues||[]).find(v=>v.id===editId&&v.organization_id===chosen);
  if(editing){setForm({...QUICK_VENUE_EMPTY,...editing,latitude:editing.latitude??'',longitude:editing.longitude??''});setExistingId(editing.id);}
  else{
   const stored=readDraft(session?.user?.id,chosen);if(stored)setForm({...QUICK_VENUE_EMPTY,...stored});
  }
  setLoaded(true);
 })();return()=>{alive=false;};},[]);
 useEffect(()=>{if(!loaded||stage==='done')return;const timer=setTimeout(()=>{try{localStorage.setItem(key(account?.user?.id,orgId),JSON.stringify(form));}catch{}},500);return()=>clearTimeout(timer);},[form,orgId,account?.user?.id,loaded,stage]);

 const activeOrg=organizations.find(o=>o.id===orgId)||null;
 const canEdit=activeOrg?.role!=='viewer';
 function update(k,v){setForm(x=>({...x,[k]:v}));setError('');}
 function switchOrg(next){
  try{localStorage.setItem(key(account?.user?.id,orgId),JSON.stringify(form));}catch{}
  setOrgId(next);setExistingId('');setPublicId('');setForm({...QUICK_VENUE_EMPTY,...(readDraft(account?.user?.id,next)||{})});
  const u=new URL(window.location.href);u.searchParams.set('org',next);u.searchParams.delete('edit');window.history.replaceState(null,'',u.pathname+'?'+u.searchParams.toString());
 }
 function choose(place){
  const owned=myVenues.find(v=>v.id===place.venueId&&v.organization_id===orgId);
  const published=publicVenues.find(v=>v.id===place.venueId);
  setExistingId(owned?.id||'');setPublicId(!owned&&published?.id||'');
  const picked=owned||published;
  setForm(f=>({...f,name:picked?.name||place.name||f.name,address:picked?.address||place.address||'',latitude:picked?.latitude??place.latitude??'',longitude:picked?.longitude??place.longitude??'',description:picked?.description||f.description||'',directions:picked?.directions||f.directions||'',is_public:owned?.is_public??f.is_public}));
  setError('');
 }
 function preview(e){e.preventDefault();if(publicId){setStage('preview');return;}const issue=validateQuickVenue(form);if(issue){setError(issue);return;}setStage('preview');setError('');window.scrollTo({top:0,behavior:'smooth'});}
 function organizerSetup(){try{localStorage.setItem(key(account?.user?.id,orgId),JSON.stringify(form));}catch{}window.location.assign('/organizators?new=1&return='+encodeURIComponent('/registre-vietu'));}
 async function persist(){
  if(!account){setStage('auth');return;}
  if(!orgId){organizerSetup();return;}
  if(!canEdit){setError('Šajā organizācijā tev ir tikai skatīšanas tiesības.');return;}
  setBusy(true);setError('');
  try{
   let result;
   if(publicId)result=await request('useVenue',{organization_id:orgId,venue_id:publicId});
   else result=await request(existingId?'updateVenue':'createVenue',{...form,venue_id:existingId,organization_id:orgId});
   setSaved(result.item);setStage('done');try{localStorage.removeItem(key(account.user?.id,orgId));}catch{}
  }catch(e){setError(e.message);if(e.status===401)setStage('auth');}finally{setBusy(false);}
 }
 if(!loaded)return <p className="meets-profile-skeleton" role="status">Ielādē norises vietu redaktoru…</p>;

 const page=<section className="meets-organizer-page quick-flow venue-editor">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Norises vieta</p><h1>{existingId?'Labot norises vietu':'Pievienot norises vietu'}</h1><p className="meets-muted">{activeOrg?<><strong>{activeOrg.name}</strong> · </>:null}meklē esošu vietu vai izveido jaunu.</p></div>
   <Link href={orgId?'/organizators?org='+orgId+'&panel=venues':'/organizators'} className="button">← Vietu pārvaldība</Link></div>
  {organizations.length>1&&stage!=='done'&&<div className="event-editor-context"><label>Organizators<select value={orgId} onChange={e=>switchOrg(e.target.value)}><option value="">Izvēlies organizatoru</option>{organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label></div>}
  {account&&organizations.length===0&&<div className="event-editor-org-needed"><strong>Vispirms izveido organizatoru.</strong><p>Vieta tiks piesaistīta organizatoram, kas to pārvalda vai izmanto.</p><button className="button primary" type="button" onClick={organizerSetup}>Sākt organizēt →</button></div>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {stage==='edit'&&<form className="quick-flow-card" onSubmit={preview}>
   <VenueLocationPicker value={form} existingVenues={myVenues.filter(v=>v.organization_id===orgId&&v.id!==existingId)} publicVenues={publicVenues} onSelect={choose}/>
   {publicId&&<div className="org-info-box"><strong>Šī vieta jau ir MEETS.</strong><p>To varēsi izmantot savos pasākumos, bet vietas publisko profilu turpinās pārvaldīt tās īpašnieks. Dublikāts netiks veidots.</p></div>}
   {!publicId&&(existingId||form.address||isCoordinatePair(form))&&<>
    <label>Vietas nosaukums *<input required minLength={2} maxLength={160} value={form.name||''} onChange={e=>update('name',e.target.value)} placeholder="Piemēram, Mārupes sporta zāle"/></label>
    <label>Adrese<input maxLength={300} value={form.address||''} onChange={e=>update('address',e.target.value)}/></label>
    <label className="quick-flow-check"><input type="checkbox" checked={form.is_public===true} onChange={e=>update('is_public',e.target.checked)}/> Publiskot vietas profilu un tās pasākumu kalendāru</label>
    <details className="quick-flow-details"><summary>Papildu informācija</summary><label>Kā nokļūt<textarea rows={2} maxLength={2000} value={form.directions||''} onChange={e=>update('directions',e.target.value)}/></label><label>Vietas apraksts<textarea rows={3} maxLength={4000} value={form.description||''} onChange={e=>update('description',e.target.value)}/></label></details>
   </>}
   <div className="quick-flow-actions"><button className="button primary" type="submit" disabled={activeOrg?.role==='viewer'}>Pārbaudīt →</button><button className="button" type="button" onClick={()=>{try{localStorage.setItem(key(account?.user?.id,orgId),JSON.stringify(form));setNotice('Vietas melnraksts saglabāts šajā ierīcē.');}catch{}}}>Saglabāt melnrakstu</button></div>
  </form>}
  {stage==='preview'&&<div className="quick-flow-card"><p className="eyebrow">Pārbaudi vietu</p><h2>{form.name}</h2><p>⌖ {form.address||'Precīzs punkts kartē'}</p>{form.description&&<p>{form.description}</p>}
   <p className="quick-flow-note">{publicId?'Esoša publiska vieta tiks tikai piesaistīta organizatoram kā izmantota vieta.':form.is_public?'Vieta būs publiska un tai būs publiskais kalendārs.':'Vieta paliks organizācijas iekšējā sarakstā.'}</p>
   <div className="quick-flow-actions"><button className="button" type="button" onClick={()=>setStage('edit')}>← Labot</button><button className="button primary" disabled={busy||activeOrg?.role==='viewer'} onClick={persist}>{busy?'Saglabā…':publicId?'Pievienot izmantotajām vietām →':'Saglabāt vietu →'}</button></div></div>}
  {stage==='auth'&&<div className="quick-flow-card"><Authentication onSuccess={async value=>{try{const x=await load(value);const chosen=x.result.organizations?.length===1?x.result.organizations[0].id:orgId;setOrgId(chosen);setStage('preview');setError('');}catch(e){setError(e.message);}}}/><button className="button" onClick={()=>setStage('preview')}>← Atpakaļ</button></div>}
  {stage==='done'&&<div className="quick-flow-card"><div className="quick-flow-success">✓</div><h2>{saved?.name||form.name}</h2><p>{publicId?'Vieta piesaistīta organizatoram kā izmantota publiska vieta.':'Vieta saglabāta organizatora norises vietās.'}</p>
   <div className="quick-flow-actions"><Link className="button primary" href={'/registre-pasakumu/vienkarsi?venue='+saved?.id+'&org='+orgId}>+ Pasākums šajā vietā →</Link><Link className="button" href={'/organizators?org='+orgId+'&panel=venues'}>Norises vietas →</Link></div></div>}
 </section>;
 return account?<ProfileShell session={account} activeOrganization={activeOrg}>{page}</ProfileShell>:page;
}
export default function VenueRegistration(){return <Suspense fallback={<p role="status">Ielādē vietas redaktoru…</p>}><VenueRegistrationInner/></Suspense>;}

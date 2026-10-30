'use client';
import {useState} from 'react';
import {countOccurrences} from '../../lib/event-schedule.js';
import {pendingSubmissions,waitingDays} from '../../lib/admin-submissions.js';
import {rigaTodayIso} from '../../lib/event-date.js';
import {CHANGE_REASONS,DECLINE_REASONS,historyLabel,inLatvia,reasonLabel,reasonTemplate,reviewProblem,submissionChecks} from '../../lib/submission-review.js';

const WEEKDAYS=['','Pirmdiena','Otrdiena','Trešdiena','Ceturtdiena','Piektdiena','Sestdiena','Svētdiena'];
const STATUS={published:'Publicēts',auto:'Publicēts automātiski',rejected:'Gaida organizatora labojumus',declined:'Noraidīts'};
const ACTIONS=[
 {key:'publish',label:'Publicēt'},
 {key:'request_changes',label:'Lūgt precizēt'},
 {key:'decline',label:'Noraidīt'}
];
function dateText(value){
 if(!value)return '';
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(String(value).slice(0,10)+'T12:00:00'));
}
function priceText(item){
 if(item.price_status==='free')return 'Bezmaksas';
 if(item.price_min!=null&&item.price_max!=null)return item.price_min+'–'+item.price_max+' EUR';
 return item.price_status==='unknown'?'Nav norādīta':'Maksas, cena nav norādīta';
}
function osmLink(lat,lon){return 'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=17/'+lat+'/'+lon;}

function PlaceOption({place,onUse,active}){
 return <li className={active?'active':''}>
  <div><strong>{place.label||place.displayName}</strong>
   <small>{[place.source,place.displayName!==place.label&&place.displayName,place.sameArea===false?'cita pašvaldība':''].filter(Boolean).join(' · ')}</small></div>
  <div className="admin-submission-place-actions">
   <a href={osmLink(place.latitude,place.longitude)} target="_blank" rel="noreferrer">Kartē ↗</a>
   <button type="button" className="button compact" onClick={()=>onUse(place)}>{active?'Izvēlēts':'Izmantot'}</button>
  </div>
 </li>;
}

function SubmissionCard({item,today,focused,matches,onSearchPlace,onReview,busy,supabaseUrl,organization,onSetTrust}){
 const checks=submissionChecks(item,today);
 const blocked=checks.some(c=>c.level==='block');
 const [action,setAction]=useState(blocked?'':'publish');
 const [reason,setReason]=useState(''),[note,setNote]=useState('');
 const [point,setPoint]=useState(inLatvia(item.latitude,item.longitude)?{latitude:item.latitude,longitude:item.longitude,label:'Organizatora atzīmētā vieta'}:null);
 const [search,setSearch]=useState({running:false,results:null,error:''});
 const [error,setError]=useState('');
 const days=waitingDays(item);
 const known=matches||[];

 function choose(nextAction,nextReason=''){
  setAction(nextAction);setReason(nextReason);setError('');
  setNote(nextReason?reasonTemplate(nextAction,nextReason):'');
 }
 function pickReason(code){setReason(code);if(!note.trim()||[...CHANGE_REASONS,...DECLINE_REASONS].some(r=>r.template===note))setNote(reasonTemplate(action,code));}
 async function searchPlaces(){
  setSearch({running:true,results:null,error:''});
  try{setSearch({running:false,results:await onSearchPlace(item),error:''});}
  catch(e){setSearch({running:false,results:[],error:e.message||'Meklēšana neizdevās.'});}
 }
 async function submit(){
  const problem=action==='publish'?(!point?'Vispirms izvēlies vai pārbaudi norises vietu kartē.':''):reviewProblem(action,reason,note);
  if(problem){setError(problem);return;}
  setError('');
  try{await onReview(item,action,action==='publish'?null:reason,note,point?Number(point.latitude):null,point?Number(point.longitude):null);}
  catch(e){setError(e.message);}
 }
 const reasons=action==='decline'?DECLINE_REASONS:CHANGE_REASONS;
 const usePlace=place=>setPoint({latitude:place.latitude,longitude:place.longitude,label:place.label||place.displayName});
 const samePoint=place=>point&&Math.abs(Number(point.latitude)-Number(place.latitude))<1e-5&&Math.abs(Number(point.longitude)-Number(place.longitude))<1e-5;

 return <article id={'submission-'+item.id} className={'meets-organizer-review-card admin-submission-card'+(focused?' meets-organizer-review-focused':'')}>
  <header className="admin-submission-head">
   <div>
    <h3>{item.title}</h3>
    <p>{item.organization_name} · {dateText(item.date_from)}{item.date_to&&item.date_to!==item.date_from?'–'+dateText(item.date_to):''} {item.time_from?String(item.time_from).slice(0,5):''}</p>
    {organization&&onSetTrust&&<p className="admin-submission-trust">
     {organization.trusted?<><span className="admin-trust-badge">Uzticams organizators</span> Šis pasākums netika publicēts automātiski — skatīt pārbaudes zemāk.</>
      :<>{organization.published>0?(organization.published===1?'Publicēts 1 pasākums':'Publicēti '+organization.published+' pasākumi'):'Pirmais pasākums'}{organization.suggested?' · ieteicams atzīmēt kā uzticamu':''}
       {' '}<button type="button" className="text-button" onClick={()=>onSetTrust(organization,true)}>Uzticēties — turpmāk publicēt automātiski</button></>}
    </p>}
    {item.author_email&&<p className="admin-submission-contact">Iesniedza <a href={'mailto:'+item.author_email+'?subject='+encodeURIComponent('MEETS: '+item.title)}>{item.author_email}</a></p>}
   </div>
   <span className={'admin-submission-age'+(days>=2?' late':'')}>{days===0?'Iesniegts šodien':'Gaida '+days+' '+(days===1?'dienu':'dienas')}</span>
  </header>

  {checks.length>0&&<ul className="admin-submission-checks" aria-label="Automātiskās pārbaudes">
   {checks.map(check=><li key={check.text} className={'check-'+check.level}>
    <span>{check.text}</span>
    <button type="button" className="text-button" onClick={()=>choose(check.action,check.reason)}>{check.action==='decline'?'Noraidīt ar šo iemeslu':'Lūgt precizēt'}</button>
   </li>)}
  </ul>}
  {(item.possible_duplicates||[]).length>0&&<p className="admin-submission-duplicates">Līdzīgi ieraksti: {item.possible_duplicates.map(d=><a key={d.id} href={'/pasakumi/'+d.id} target="_blank" rel="noreferrer">{d.title} ({dateText(d.date_from)}{d.venue_name?', '+d.venue_name:''})</a>)}</p>}

  <div className="admin-submission-body">
   <section className="admin-submission-details">
    <p>{item.description||'Nav apraksta.'}</p>
    {item.cover_image_path&&/^[a-f\d-]+\/[a-f\d-]+\/[a-f\d-]+\.(jpg|png|webp)$/.test(item.cover_image_path)&&supabaseUrl&&<img
     src={supabaseUrl+'/storage/v1/object/public/meets-event-images/'+item.cover_image_path} alt="Iesniegtā pasākuma attēls"/>}
    <dl>
     <dt>Kategorija</dt><dd>{item.category||'—'}</dd>
     <dt>Maksa</dt><dd>{priceText(item)}</dd>
     {item.schedule_kind==='recurring'&&<><dt>Grafiks</dt><dd>{(item.recurrence_slots||[]).map(s=>WEEKDAYS[s.weekday]+' '+s.start+'–'+s.end).join(' · ')}
      {' · '}{(()=>{try{return countOccurrences(item.date_from,item.date_to,item.recurrence_slots)+' norises reizes';}catch{return 'grafika kļūda';}})()}</dd></>}
    </dl>
    {(item.history||[]).length>0&&<details className="admin-submission-history"><summary>Vēsture ({item.history.length})</summary>
     <ol>{item.history.map((h,i)=><li key={i}><time>{dateText(h.at)}</time> {historyLabel(h)}{h.note?': '+h.note:''}</li>)}</ol>
    </details>}
   </section>

   <section className="admin-submission-location" aria-label="Norises vieta">
    <h4>Norises vieta</h4>
    <p><strong>{item.venue_name||'Nav nosaukuma'}</strong><br/><span>{item.address||'Nav adreses'}</span></p>
    {point?<p className="admin-submission-point">✓ {point.label}: {Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)} · <a href={osmLink(point.latitude,point.longitude)} target="_blank" rel="noreferrer">pārbaudīt kartē ↗</a></p>
     :<p className="admin-submission-point missing">Vieta kartē vēl nav izvēlēta.</p>}
    {known.length>0&&<><h5>MEETS jau zina</h5><ul className="admin-submission-places">{known.map((place,i)=><PlaceOption key={'k'+i} place={place} active={samePoint(place)} onUse={usePlace}/>)}</ul></>}
    {search.results&&<><h5>Adrešu meklēšanas rezultāti</h5>
     {search.results.length?<ul className="admin-submission-places">{search.results.map((place,i)=><PlaceOption key={'s'+i} place={place} active={samePoint(place)} onUse={usePlace}/>)}</ul>:<p className="meets-muted">Nekas netika atrasts.</p>}</>}
    {search.error&&<p className="meets-inline-error">{search.error}</p>}
    <button type="button" className="button compact" onClick={searchPlaces} disabled={search.running}>{search.running?'Meklē…':'Meklēt adresi'}</button>
   </section>
  </div>

  <section className="admin-submission-decision" aria-label="Lēmums">
   <div className="admin-segmented" role="group" aria-label="Darbība">
    {ACTIONS.map(a=><button key={a.key} type="button" aria-pressed={action===a.key} className={action===a.key?'active '+a.key:''} onClick={()=>choose(a.key)}>{a.label}</button>)}
   </div>
   {action&&action!=='publish'&&<div className="admin-reason-chips" role="group" aria-label={action==='decline'?'Noraidīšanas iemesls':'Kas jāprecizē'}>
    {reasons.map(r=><button key={r.code} type="button" aria-pressed={reason===r.code} className={reason===r.code?'active':''} onClick={()=>pickReason(r.code)}>{r.label}</button>)}
   </div>}
   {action&&<label>{action==='publish'?'Komentārs organizatoram (nav obligāts)':'Komentārs organizatoram'}
    <textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder={action==='publish'?'Piemēram: paldies, pasākums publicēts!':'Ko tieši vajag izlabot?'}/></label>}
   {action&&<p className="admin-submission-email">Organizators saņems e-pastu{action!=='publish'&&reason?': “'+reasonLabel(reason)+'”':''}.</p>}
   {error&&<p className="meets-inline-error" role="alert">{error}</p>}
   {action&&<button type="button" className={'button '+(action==='decline'?'danger':'primary')} disabled={busy} onClick={submit}>
    {busy?'Saglabā…':action==='publish'?'✓ Publicēt kartē':action==='decline'?'Noraidīt pasākumu':'Nosūtīt precizēšanai'}</button>}
  </section>
 </article>;
}

function Organizations({organizations,onSetTrust}){
 const trusted=organizations.filter(o=>o.trusted),suggested=organizations.filter(o=>!o.trusted&&o.suggested);
 if(!organizations.length)return null;
 return <section className="admin-submission-secondary admin-organizations">
  <h3>Uzticamie organizatori ({trusted.length})</h3>
  <p className="meets-muted">Uzticamu organizatoru pasākumi tiek publicēti uzreiz, ja ir atzīmēta vieta kartē, datums nav pagājis, cena norādīta un nav līdzīga pasākuma tajā pašā datumā. Citādi tie nonāk šajā rindā. Tu par tiem saņem dienas kopsavilkumu.</p>
  <ul>
   {trusted.map(o=><li key={o.id}><strong>{o.name}</strong> · {o.published===1?'1 publicēts':o.published+' publicēti'}{o.owner_email?' · '+o.owner_email:''}
    {' '}<button type="button" className="text-button" onClick={()=>onSetTrust(o,false)}>Atcelt uzticību</button></li>)}
   {suggested.map(o=><li key={o.id}><strong>{o.name}</strong> · {o.published} publicēti bez labojumiem — ieteicams
    {' '}<button type="button" className="text-button" onClick={()=>onSetTrust(o,true)}>Uzticēties</button></li>)}
   {!trusted.length&&!suggested.length&&<li className="meets-muted">Vēl nav. Organizatoru ieteiksim, kad būs publicēti 3 pasākumi bez labojumiem.</li>}
  </ul>
 </section>;
}

export default function AdminUserSubmissions({items=[],focusedId='',onReview,busy=false,supabaseUrl='',matches={},onSearchPlace,organizations=[],onSetTrust}){
 const today=rigaTodayIso();
 const [showDone,setShowDone]=useState(false);
 // Oldest waiting first, so organizers are not left without an answer.
 const pending=pendingSubmissions(items,today).items.sort((a,b)=>Number(b.id===focusedId)-Number(a.id===focusedId));
 const waiting=items.filter(x=>x.status==='rejected');
 const done=items.filter(x=>['published','declined'].includes(x.status)).sort((a,b)=>String(b.reviewed_at||b.updated_at||'').localeCompare(String(a.reviewed_at||a.updated_at||''))).slice(0,15);
 return <section className="meets-admin-submissions">
  <div className="admin-sheet-intro"><div><p className="eyebrow">Organizatori</p><h2>Lietotāju pasākumi</h2>
   <p>Pārbaudi datus un vietu, tad publicē, lūdz precizēt vai noraidi ar iemeslu. Organizators par lēmumu saņem e-pastu.</p></div></div>
  <div className="meets-organizer-review-list">
   {!pending.length&&<p className="meets-muted">Nav pasākumu, kas gaida pārbaudi.</p>}
   {pending.map(item=><SubmissionCard key={item.id} item={item} today={today} focused={item.id===focusedId}
    matches={matches[item.id]} onSearchPlace={onSearchPlace} onReview={onReview} busy={busy} supabaseUrl={supabaseUrl}
    organization={organizations.find(o=>o.id===item.organization_id)} onSetTrust={onSetTrust}/>)}
  </div>
  {waiting.length>0&&<section className="admin-submission-secondary"><h3>Gaida organizatora labojumus ({waiting.length})</h3>
   <ul>{waiting.map(x=><li key={x.id}><strong>{x.title}</strong> · {x.organization_name} · {reasonLabel(x.review_reason)||'Lūgts precizēt'}{x.reviewed_at?' · '+dateText(x.reviewed_at):''}</li>)}</ul></section>}
  {onSetTrust&&<Organizations organizations={organizations} onSetTrust={onSetTrust}/>}
  {done.length>0&&<section className="admin-submission-secondary">
   <button type="button" className="text-button" onClick={()=>setShowDone(v=>!v)} aria-expanded={showDone}>{showDone?'Paslēpt':'Rādīt'} pēdējos lēmumus ({done.length})</button>
   {showDone&&<ul>{done.map(x=><li key={x.id}><strong>{x.title}</strong> · {(x.history||[]).some(h=>h.action==='auto_published')?STATUS.auto:STATUS[x.status]}{x.review_reason?' · '+reasonLabel(x.review_reason):''}{x.reviewed_at?' · '+dateText(x.reviewed_at):''}</li>)}</ul>}
  </section>}
 </section>;
}

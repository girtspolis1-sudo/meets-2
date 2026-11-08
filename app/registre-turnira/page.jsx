'use client';
import Link from 'next/link';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import {accountRequest,useAccountSession} from '../../lib/account-store.js';
import {canWriteOrganization,submissionDateLabel} from '../../lib/organizer-workspace.js';
import {FORMATS,GROUP_KEYS,SPORTS,buildGames,cleanTournament,estimateEnd,formatProblem,groupsOf,hasScore,newTeamKey,parseTeamLines,schedule,scheduleProblems,snakeGroups,sportOf,toMin} from '../../lib/tournament.js';
import {qrPath} from '../../lib/qr-path.js';
import {GroupTables,Places,contextOf,stageLabel} from '../turniri/tournament-views.jsx';
import {ScoreEntry} from '../turniri/score-entry.jsx';

const STEPS=[['pamati','Pamati'],['komandas','Komandas'],['laiks','Laiks un laukumi'],['grafiks','Grafiks'],['rezultati','Rezultāti'],['saites','Publicēšana un saites']];
const EMPTY={id:'',organization_id:'',title:'',sport:'basket3x3',format:'groups_places',play_date:'',venue:'',submission_id:'',youth:false,status:'draft',share_token:'',
 settings:{courts:['A','B'],start:'10:00',slot:15,rest:15,blocks:[],third:true}};
const DRAFT=userId=>'meets_tournament_draft_v1:'+(userId||'guest');
const API='/api/tournaments';

function readDraft(userId){try{return JSON.parse(localStorage.getItem(DRAFT(userId))||'null');}catch{return null;}}
function snapshot(t,teams,games){
 const {share_token,...rest}=t;
 return JSON.stringify([rest,teams,games.map(({home_score,away_score,details,...g})=>g)]);
}
function fromRow(row){
 return {...EMPTY,id:row.id,organization_id:row.organization_id,title:row.title,sport:row.sport,format:row.format,play_date:row.play_date||'',venue:row.venue||'',
  submission_id:row.submission_id||'',youth:row.youth===true,status:row.status,share_token:row.share_token,settings:{...EMPTY.settings,...(row.settings||{})}};
}
const courtsText=list=>(list||[]).join(', ');
const parseCourts=text=>[...new Set(String(text).split(',').map(x=>x.trim().slice(0,40)).filter(Boolean))].slice(0,12);

function Qr({text,label}){
 const qr=useMemo(()=>qrPath(text),[text]);
 return <svg className="tn-qr" viewBox={`-4 -4 ${qr.size+8} ${qr.size+8}`} role="img" aria-label={label} shapeRendering="crispEdges">
  <rect x="-4" y="-4" width={qr.size+8} height={qr.size+8} fill="#fff"/><path d={qr.d} fill="#1b2430"/>
 </svg>;
}
function CopyField({value,label}){
 const [copied,setCopied]=useState(false);
 return <div className="tn-copy"><input readOnly value={value} aria-label={label} onFocus={e=>e.target.select()}/>
  <button type="button" className="button compact" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{window.prompt('Nokopē saiti:',value);}}}>{copied?'✓ Nokopēts':'Kopēt'}</button></div>;
}

// Courts across, times down. In edit mode each game gets a time and a court.
function ScheduleBoard({games,ctx,courts,editing,onMove}){
 const times=[...new Set(games.map(g=>g.starts_at).filter(Boolean))].sort((a,b)=>toMin(a)-toMin(b));
 if(editing)return <ol className="tn-edit-list">{[...games].sort((a,b)=>a.no-b.no).map(g=><li key={g.no}>
  <span className="tn-edit-no">{g.no}</span>
  <span className="tn-edit-game"><small>{stageLabel(g)}</small>{sideText(g.home,ctx)} – {sideText(g.away,ctx)}</span>
  <label>Laiks<input type="time" step="300" value={g.starts_at||''} onChange={e=>onMove(g.no,{starts_at:e.target.value})}/></label>
  <label>Laukums<select value={g.court} onChange={e=>onMove(g.no,{court:e.target.value})}>{courts.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
 </li>)}</ol>;
 return <div className="tn-board" style={{'--courts':courts.length}} role="table" aria-label="Spēļu grafiks pa laukumiem">
  <div className="tn-board-row tn-board-head" role="row"><span role="columnheader">Laiks</span>{courts.map(c=><span role="columnheader" key={c}>{c}</span>)}</div>
  {times.map(t=><div className="tn-board-row" role="row" key={t}><strong role="rowheader">{t}</strong>{courts.map(c=>{const g=games.find(x=>x.starts_at===t&&x.court===c);
   return <span role="cell" key={c} className={g?'tn-board-game tn-stage-'+g.stage:'tn-board-free'}>{g&&<><small>{g.no} · {stageLabel(g)}</small><b>{sideText(g.home,ctx)}</b><b>{sideText(g.away,ctx)}</b></>}</span>;})}</div>)}
 </div>;
}
function sideText(ref,ctx){
 if(ref.startsWith('T:'))return ctx.teams.find(t=>'T:'+t.key===ref)?.name||'—';
 const m=/^([WL]):(\d+)$/.exec(ref);
 return m?(m[1]==='W'?'Uzv. ':'Zaud. ')+m[2]:ref;
}

function Wizard(){
 const params=useSearchParams();
 const {session,ready}=useAccountSession();
 const [loaded,setLoaded]=useState(false);
 const [orgs,setOrgs]=useState([]);
 const [events,setEvents]=useState([]);
 const [t,setT]=useState(EMPTY);
 const [teams,setTeams]=useState([]);
 const [games,setGames]=useState([]);
 const [scorers,setScorers]=useState([]);
 const [rights,setRights]=useState({edit:false,create:false,manage:false});
 const [saved,setSaved]=useState('');
 const [step,setStep]=useState('pamati');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [paste,setPaste]=useState('');
 const [groupCount,setGroupCount]=useState(4);
 const [courtsInput,setCourtsInput]=useState(courtsText(EMPTY.settings.courts));
 const [editing,setEditing]=useState(false);
 const [courtFilter,setCourtFilter]=useState('');
 const [invite,setInvite]=useState('');
 const loadedOnce=useRef(false);

 const writable=orgs.filter(o=>canWriteOrganization(o.role));
 const org=orgs.find(o=>o.id===t.organization_id)||null;
 const canSave=t.id?rights.edit:Boolean(org&&canWriteOrganization(org.role));
 const dirty=snapshot(t,teams,games)!==saved;
 const ctx={teams,games,sport:t.sport};
 const sport=sportOf(t.sport);
 const groupFormat=t.format!=='knockout';
 const problem=formatProblem(t.format,teams);
 const problems=useMemo(()=>games.length?scheduleProblems(games,teams,t.settings):[],[games,teams,t.settings]);
 const planned=useMemo(()=>problem?0:buildGames(t.format,teams,{third:t.settings.third}).length,[t.format,teams,t.settings.third,problem]);
 const scored=games.some(hasScore);
 // The schedule no longer matches the teams or the format.
 const stale=games.length>0&&(()=>{
  const keys=new Set(teams.map(x=>'T:'+x.key));
  const refs=games.flatMap(g=>[g.home,g.away]).filter(r=>r.startsWith('T:'));
  return refs.some(r=>!keys.has(r))||planned!==games.length;
 })();

 function apply(got){
  const next=fromRow(got.tournament);
  setT(next);setTeams(got.teams||[]);setGames(got.games||[]);setScorers(got.scorers||[]);setRights(got.rights||{});
  setCourtsInput(courtsText(next.settings.courts));
  setGroupCount(Math.max(1,Object.keys(groupsOf(got.teams||[])).length)||4);
  setSaved(snapshot(next,got.teams||[],got.games||[]));
 }
 useEffect(()=>{
  if(!ready||loadedOnce.current)return;loadedOnce.current=true;
  if(!session){setLoaded(true);return;}
  (async()=>{
   try{
    const list=await accountRequest('/api/organizer','list');
    setOrgs(list.organizations||[]);setEvents(list.submissions||[]);
    const id=params.get('id');
    if(id){apply(await accountRequest(API,'get',{id}));}
    else{
     const choices=(list.organizations||[]).filter(o=>canWriteOrganization(o.role));
     const requested=params.get('org');
     const orgId=choices.some(o=>o.id===requested)?requested:choices.length===1?choices[0].id:'';
     const draft=readDraft(session.user?.id);
     if(draft?.t&&(!requested||draft.t.organization_id===requested)){
      setT({...EMPTY,...draft.t,id:'',organization_id:draft.t.organization_id||orgId});setTeams(draft.teams||[]);setGames(draft.games||[]);
      setCourtsInput(courtsText(draft.t.settings?.courts||EMPTY.settings.courts));
      setNotice('Atjaunots nesaglabātais turnīra melnraksts šajā ierīcē.');
     }else setT({...EMPTY,organization_id:orgId});
     setSaved(snapshot({...EMPTY,organization_id:orgId},[],[]));
    }
   }catch(e){setError(e.message);}
   finally{setLoaded(true);}
  })();
 },[ready,session]);

 // A new tournament is kept on this device until it is saved.
 useEffect(()=>{
  if(!loaded||t.id||!session)return;
  const timer=setTimeout(()=>{try{if(t.title||teams.length)localStorage.setItem(DRAFT(session.user?.id),JSON.stringify({t,teams,games}));}catch{}},500);
  return()=>clearTimeout(timer);
 },[t,teams,games,loaded]);
 useEffect(()=>{
  const warn=e=>{if(dirty&&canSave){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[dirty,canSave]);

 const set=(key,value)=>setT(v=>({...v,[key]:value}));
 const setSetting=(key,value)=>setT(v=>({...v,settings:{...v.settings,[key]:value}}));
 function chooseSport(key){
  setT(v=>{
   const before=sportOf(v.sport).slot,after=SPORTS[key].slot;
   const keep=Number(v.settings.slot)!==before;
   return {...v,sport:key,settings:keep?v.settings:{...v.settings,slot:after,rest:after}};
  });
 }
 function chooseFormat(key){
  set('format',key);
  if(key==='groups_places'&&![2,4].includes(groupCount))setGroupCount(4);
 }

 // Teams
 function addPasted(){
  const added=parseTeamLines(paste,teams);
  if(!added.length){setError('Ielīmē komandu nosaukumus, katru savā rindā.');return;}
  setTeams(list=>[...list,...added]);setPaste('');setError('');
  setNotice('Pievienotas '+added.length+' komandas.'+(groupFormat?' Tagad sadali tās grupās.':''));
 }
 function addTeam(){setTeams(list=>[...list,{key:newTeamKey(new Set(list.map(x=>x.key))),name:'',coach:'',group:'',seed:list.length+1}]);}
 function updateTeam(key,field,value){setTeams(list=>list.map(x=>x.key===key?{...x,[field]:value}:x));}
 function removeTeam(key){setTeams(list=>list.filter(x=>x.key!==key).map((x,i)=>({...x,seed:i+1})));}
 function moveTeam(key,delta){
  setTeams(list=>{const i=list.findIndex(x=>x.key===key),j=i+delta;if(j<0||j>=list.length)return list;const next=[...list];[next[i],next[j]]=[next[j],next[i]];return next.map((x,n)=>({...x,seed:n+1}));});
 }
 function splitGroups(){
  if(teams.length<2){setError('Vispirms pievieno komandas.');return;}
  setTeams(list=>snakeGroups(list,groupCount));setError('');
  setNotice('Komandas sadalītas '+groupCount+' grupās čūskas kārtībā: 1. A, 2. B … un atpakaļ. Spēcīgākās liec saraksta augšā.');
 }

 // Schedule
 function makeSchedule(){
  setError('');setNotice('');
  if(problem){setError(problem);setStep('komandas');return;}
  if(teams.some(x=>!x.name.trim())){setError('Katrai komandai vajag nosaukumu.');setStep('komandas');return;}
  if(scored&&!window.confirm('Grafiks tiks sastādīts no jauna. Spēlēm, kuru pāri mainīsies, ievadītie rezultāti tiks dzēsti. Turpināt?'))return;
  const built=buildGames(t.format,teams,{third:t.settings.third});
  const result=schedule(built,teams,t.settings,{tries:160,seed:1+Math.floor(Math.random()*100000)});
  if(!result){setError('Visas spēles neizdevās ievietot līdz dienas beigām. Pievieno laukumu, saīsini spēles vai atpūtas laiku, vai pārtraukumus.');return;}
  setGames(result);setEditing(false);
  setNotice(result.length+' spēles ievietotas. Pēdējā sākas '+result.reduce((m,g)=>toMin(g.starts_at)>toMin(m)?g.starts_at:m,result[0].starts_at)+'.');
 }
 function moveGame(no,change){setGames(list=>list.map(g=>g.no===no?{...g,...change}:g));}

 // Saving
 async function save(status){
  setBusy(true);setError('');setNotice('');
  try{
   const next={...t,status:status||t.status};
   cleanTournament({...next,teams,games});
   const r=await accountRequest(API,'save',{tournament:next,teams,games});
   if(!t.id){
    try{localStorage.removeItem(DRAFT(session?.user?.id));}catch{}
    window.history.replaceState(null,'','/registre-turnira?id='+r.id);
   }
   apply(await accountRequest(API,'get',{id:r.id}));
   setNotice(status==='published'?'Turnīrs publicēts. Saite un QR kods ir gatavi.':status==='draft'&&t.status==='published'?'Turnīrs vairs nav publisks.':'Saglabāts.');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function saveScore(no,home,away,details){
  await accountRequest(API,'score',{id:t.id,no,home,away,details});
  setGames(list=>list.map(g=>g.no===no?{...g,home_score:home,away_score:away,details:details||{}}:g));
 }
 async function scorerLink(court,renew=false){
  if(renew&&!window.confirm('Izveidot jaunu saiti? Iepriekšējā saite laukumam '+(court==='*'?'(visi)':court)+' vairs nedarbosies.'))return;
  setBusy(true);setError('');
  try{
   const r=await accountRequest(API,'scorerLink',{id:t.id,court,renew});
   setScorers(list=>[...list.filter(x=>x.court!==court),{court,token:r.token}].sort((a,b)=>a.court.localeCompare(b.court)));
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function inviteEditor(){
  setBusy(true);setError('');
  try{
   const r=await accountRequest('/api/organizer','invite',{organization_id:t.organization_id,role:'contributor',item_kind:'tournament',item_id:t.id});
   setInvite(window.location.origin+'/organizators?invite='+r.invite.token+'&org='+t.organization_id);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function remove(){
  const typed=window.prompt('Dzēst turnīru “'+t.title+'” ar visām spēlēm un rezultātiem? To nevar atsaukt.\nLai turpinātu, ieraksti DZĒST:','');
  if(String(typed||'').trim().toUpperCase()!=='DZĒST')return;
  setBusy(true);setError('');
  try{await accountRequest(API,'delete',{id:t.id});window.location.assign('/organizators?org='+t.organization_id+'&panel=tournaments');}
  catch(e){setError(e.message);setBusy(false);}
 }

 if(!loaded)return <ProfileShell mode="organizer"><div className="org-skeleton" role="status" aria-label="Ielādē turnīru"><span className="org-skeleton-line wide"/><span className="org-skeleton-block"/></div></ProfileShell>;
 if(!session)return <ProfileShell mode="organizer"><section className="org-workspace"><div className="org-empty-state"><h1>Turnīrs</h1><p>Lai veidotu turnīru, pieslēdzies MEETS kontam.</p><Link className="button primary" href="/profils">Pieslēgties →</Link></div></section></ProfileShell>;
 if(!t.id&&!writable.length)return <ProfileShell mode="organizer"><section className="org-workspace"><div className="org-empty-state"><h1>Jauns turnīrs</h1>
  <p>{orgs.length?'Turnīrus veido rīkotāja komanda ar lomu “Rīkotājs” vai augstāku. Tev uzticētos turnīrus atradīsi rīkotāja pārskatā.':'Turnīru veido rīkotājs. Vispirms izveido rīkotāja profilu.'}</p>
  <Link className="button primary" href={orgs.length?'/organizators':'/organizators?new=1'}>{orgs.length?'Uz rīkotāja pārskatu':'Izveidot rīkotāju'}</Link></div></section></ProfileShell>;

 const stepIndex=STEPS.findIndex(([k])=>k===step);
 const needsSaved=key=>['rezultati','saites'].includes(key)&&!t.id;
 const origin=typeof window==='undefined'?'https://meets.lv':window.location.origin;
 const publicLink=origin+'/turniri/'+t.share_token;
 const courts=t.settings.courts;
 const readOnly=!canSave;
 const backHref='/organizators?'+(t.organization_id?'org='+t.organization_id+'&':'')+'panel=tournaments';

 return <ProfileShell mode="organizer" activeOrganization={org}><section className="org-workspace tn-wizard">
  <header className="ev-head tn-wizard-head">
   <Link className="ev-back" href={backHref}>← Turnīri</Link>
   <h1>{t.id?t.title||'Turnīrs':'Jauns turnīrs'}</h1>
   <span className={'tn-save-state'+(dirty&&canSave?' is-dirty':'')} role="status">{readOnly?'Tikai skatīšanai':busy?'Saglabā…':dirty?'Nesaglabātas izmaiņas':t.id?(t.status==='published'?'Publicēts':'Melnraksts · saglabāts'):''}</span>
  </header>

  <nav className="tn-steps" aria-label="Turnīra soļi"><ol>{STEPS.map(([key,label],i)=><li key={key}>
   <button type="button" aria-current={step===key?'step':undefined} className={step===key?'active':i<stepIndex?'done':''} disabled={needsSaved(key)} title={needsSaved(key)?'Pieejams pēc saglabāšanas':undefined} onClick={()=>{setStep(key);setError('');setNotice('');}}>
    <span aria-hidden="true">{i+1}</span>{label}</button></li>)}</ol></nav>

  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {readOnly&&t.id&&<p className="tn-note">Tev ir tiesības šo turnīru skatīt, bet ne labot.</p>}

  <fieldset className="tn-step-body" disabled={readOnly&&!['rezultati','saites'].includes(step)}>
  {step==='pamati'&&<div className="org-panel tn-form">
   {!t.id&&writable.length>1&&<label>Rīkotājs<select value={t.organization_id} onChange={e=>set('organization_id',e.target.value)}><option value="">Izvēlies rīkotāju</option>{writable.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
   <label>Turnīra nosaukums<input value={t.title} maxLength={160} placeholder="Piem., Mārupes kauss 2026 · 2018. g. dz. zēni" onChange={e=>set('title',e.target.value)}/></label>
   <fieldset className="tn-choice-grid"><legend>Sporta veids</legend>
    {Object.entries(SPORTS).map(([key,s])=><label key={key} className={'tn-choice'+(t.sport===key?' is-on':'')}><input type="radio" name="sport" checked={t.sport===key} onChange={()=>chooseSport(key)}/>
     <strong>{s.name}</strong><small>{s.slot} min · {s.rank==='wins'?'skaita uzvaras':s.rank==='sets'?'seti':'punkti tabulā'}</small></label>)}
   </fieldset>
   <p className="tn-rules">{sport.rules}</p>
   <fieldset className="tn-choice-grid tn-choice-wide"><legend>Formāts</legend>
    {Object.entries(FORMATS).map(([key,f])=><label key={key} className={'tn-choice'+(t.format===key?' is-on':'')}><input type="radio" name="format" checked={t.format===key} onChange={()=>chooseFormat(key)}/>
     <strong>{f.name}</strong><small>{f.hint}</small></label>)}
   </fieldset>
   <div className="tn-row">
    <label>Datums<input type="date" value={t.play_date} onChange={e=>set('play_date',e.target.value)}/></label>
    <label>Norises vieta<input value={t.venue} maxLength={200} placeholder="Piem., Mārupes sporta komplekss" onChange={e=>set('venue',e.target.value)}/></label>
   </div>
   <label>Saistītais pasākums <small>(neobligāti — turnīra lapā būs saite uz to)</small><select value={t.submission_id} onChange={e=>set('submission_id',e.target.value)}>
    <option value="">Nav saistīts</option>
    {events.filter(e=>e.organization_id===t.organization_id&&!['cancelled','declined'].includes(e.status)).map(e=><option key={e.id} value={e.id}>{e.title} · {submissionDateLabel(e)}</option>)}
   </select></label>
   <label className="org-public-choice"><input type="checkbox" checked={t.youth} onChange={e=>set('youth',e.target.checked)}/><span><strong>Bērnu turnīrs</strong>
    <small>{t.youth?'Publiskajā lapā redzams tikai grafiks. Rezultātus un tabulas redz rīkotājs un laukumu sekretāri.':'Rezultāti un tabulas būs redzami publiski. Ieslēdz, ja jaunāko grupu rezultātus nepublicē.'}</small></span></label>
  </div>}

  {step==='komandas'&&<div className="org-panel tn-form">
   <div className="tn-paste">
    <label>Ielīmē komandas<textarea rows={4} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={'RBS Centrs 1, Jānis Melngailis\nVentspils Spars, Ričards Vitoļskis\nOgres Lāči'}/></label>
    <small>Katra komanda savā rindā. Treneri var ierakstīt aiz komata — viena trenera komandām spēles neliks vienā laikā.</small>
    <button type="button" className="button compact" onClick={addPasted} disabled={!paste.trim()}>Pievienot sarakstam</button>
   </div>
   {groupFormat&&<div className="tn-groups-bar">
    <label>Grupu skaits<select value={groupCount} onChange={e=>setGroupCount(Number(e.target.value))}>
     {(t.format==='groups_places'?[2,4]:[1,2,3,4,5,6,7,8]).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <button type="button" className="button compact" onClick={splitGroups}>Sadalīt grupās</button>
    <small>Saraksta secība ir izsēšana: spēcīgākās augšā.</small>
   </div>}
   <div className="tn-team-table" role="table" aria-label="Komandas">
    <div className="tn-team-row tn-team-head" role="row"><span>#</span><span>Komanda</span><span>Treneris</span>{groupFormat&&<span>Grupa</span>}<span><span className="sr-only">Darbības</span></span></div>
    {teams.map((x,i)=><div className="tn-team-row" role="row" key={x.key}>
     <span className="tn-team-seed">{i+1}</span>
     <input aria-label={'Komanda '+(i+1)} value={x.name} maxLength={120} placeholder="Nosaukums" onChange={e=>updateTeam(x.key,'name',e.target.value)}/>
     <input aria-label={'Treneris '+(i+1)} value={x.coach} maxLength={120} placeholder="Treneris" onChange={e=>updateTeam(x.key,'coach',e.target.value)}/>
     {groupFormat&&<select aria-label={'Grupa '+(i+1)} value={x.group} onChange={e=>updateTeam(x.key,'group',e.target.value)}><option value="">–</option>{GROUP_KEYS.map(g=><option key={g} value={g}>{g}</option>)}</select>}
     <span className="tn-team-actions">
      <button type="button" className="icon-button" aria-label="Uz augšu" disabled={i===0} onClick={()=>moveTeam(x.key,-1)}>↑</button>
      <button type="button" className="icon-button" aria-label="Uz leju" disabled={i===teams.length-1} onClick={()=>moveTeam(x.key,1)}>↓</button>
      <button type="button" className="icon-button" aria-label={'Dzēst '+(x.name||'komandu')} onClick={()=>removeTeam(x.key)}>×</button>
     </span>
    </div>)}
   </div>
   <button type="button" className="button compact ghost" onClick={addTeam} disabled={teams.length>=64}>+ Komanda</button>
   {teams.length>0&&(problem?<p className="tn-warn">{problem}</p>:<p className="tn-ok">{teams.length} komandas{groupFormat?' · '+Object.entries(groupsOf(teams)).map(([g,l])=>g+': '+l.length).join(', '):''} · {planned} spēles</p>)}
  </div>}

  {step==='laiks'&&<div className="org-panel tn-form">
   <label>Laukumi <small>(atdali ar komatu)</small><input value={courtsInput} placeholder="A, B, C" onChange={e=>{setCourtsInput(e.target.value);setSetting('courts',parseCourts(e.target.value));}}/></label>
   <div className="tn-row tn-row-3">
    <label>Pirmā spēle<input type="time" step="300" value={t.settings.start} onChange={e=>setSetting('start',e.target.value)}/></label>
    <label>Spēles laiks, min<input type="number" min={5} max={180} value={t.settings.slot} onChange={e=>setSetting('slot',Number(e.target.value))}/><small>Ar maiņu un iesildīšanos</small></label>
    <label>Atpūta komandai, min<input type="number" min={0} max={240} value={t.settings.rest} onChange={e=>setSetting('rest',Number(e.target.value))}/><small>Starp vienas komandas spēlēm</small></label>
   </div>
   <fieldset className="tn-blocks"><legend>Pārtraukumi un citas aktivitātes</legend>
    {(t.settings.blocks||[]).map((b,i)=><div className="tn-block-row" key={i}>
     <input aria-label="Nosaukums" value={b.title} maxLength={60} placeholder="Piem., Metienu konkurss" onChange={e=>setSetting('blocks',t.settings.blocks.map((x,j)=>j===i?{...x,title:e.target.value}:x))}/>
     <input aria-label="Sākums" type="time" step="300" value={b.at} onChange={e=>setSetting('blocks',t.settings.blocks.map((x,j)=>j===i?{...x,at:e.target.value}:x))}/>
     <label className="tn-inline">min<input type="number" min={0} max={240} value={b.minutes} onChange={e=>setSetting('blocks',t.settings.blocks.map((x,j)=>j===i?{...x,minutes:Number(e.target.value)}:x))}/></label>
     <button type="button" className="icon-button" aria-label="Dzēst pārtraukumu" onClick={()=>setSetting('blocks',t.settings.blocks.filter((x,j)=>j!==i))}>×</button>
    </div>)}
    <button type="button" className="button compact ghost" onClick={()=>setSetting('blocks',[...(t.settings.blocks||[]),{title:'',at:'12:00',minutes:15}])}>+ Pārtraukums</button>
    <small>Šajā laikā spēles neliek nevienā laukumā.</small>
   </fieldset>
   {t.format==='knockout'&&<label className="org-public-choice"><input type="checkbox" checked={t.settings.third!==false} onChange={e=>setSetting('third',e.target.checked)}/><span><strong>Spēle par 3. vietu</strong><small>Pusfinālu zaudētāji spēlē par bronzu.</small></span></label>}
   {planned>0&&courts.length>0&&<p className="tn-ok">{planned} spēles {courts.length} laukumos · beigas ap {estimateEnd(t.settings,planned)} (precīzi — pēc grafika sastādīšanas)</p>}
  </div>}

  {step==='grafiks'&&<div className="org-panel tn-form">
   <div className="tn-schedule-bar">
    <button type="button" className="button primary" onClick={makeSchedule} disabled={busy}>{games.length?'Sastādīt no jauna':'Sastādīt grafiku'}</button>
    {games.length>0&&<button type="button" className="button compact ghost" onClick={()=>setEditing(v=>!v)}>{editing?'Rādīt pa laukumiem':'Mainīt laikus un laukumus'}</button>}
    <small>Ievēro laukumus, pārtraukumus, komandu atpūtu un to, ka viens treneris nevar būt divās spēlēs reizē. Spēles par vietām — pēc grupām.</small>
   </div>
   {stale&&<p className="tn-warn">Komandas vai formāts mainīti — sastādi grafiku no jauna.</p>}
   {games.length>0&&(problems.length?<ul className="tn-problems" role="alert">{problems.map(p=><li key={p}>{p}</li>)}</ul>
    :<p className="tn-ok">✓ Grafikā nav pārklāšanos: laukumi, atpūta un treneri pārbaudīti.</p>)}
   {games.length>0?<ScheduleBoard games={games} ctx={ctx} courts={courts.length?courts:[...new Set(games.map(g=>g.court))]} editing={editing} onMove={moveGame}/>
    :<p className="tn-empty">Grafiks vēl nav sastādīts.</p>}
  </div>}
  </fieldset>

  {step==='rezultati'&&<div className="tn-results">
   {dirty&&canSave?<p className="tn-warn">Vispirms saglabā izmaiņas — rezultātus ievada saglabātajā grafikā.</p>:null}
   <div className="org-panel">
    <div className="org-panel-head"><h2>Rezultāti</h2>{courts.length>1&&<label className="tn-inline">Laukums<select value={courtFilter} onChange={e=>setCourtFilter(e.target.value)}><option value="">Visi</option>{courts.map(c=><option key={c} value={c}>{c}</option>)}</select></label>}</div>
    {games.length?<ol className="tn-entries">{[...games].filter(g=>!courtFilter||g.court===courtFilter).sort((a,b)=>(toMin(a.starts_at)??0)-(toMin(b.starts_at)??0)||a.no-b.no).map(g=>
     <ScoreEntry key={g.no} game={g} ctx={ctx} sport={t.sport} onSave={saveScore} disabled={!rights.edit||(dirty&&canSave)}/>)}</ol>:<p className="tn-empty">Vispirms sastādi un saglabā grafiku.</p>}
   </div>
   <div className="org-panel"><h2>Tabulas</h2><GroupTables data={{...t,teams,games}}/>{(t.format!=='round_robin'||Object.keys(groupsOf(teams)).length===1)&&<><h2>Vietas</h2><Places data={{...t,teams,games}}/></>}</div>
  </div>}

  {step==='saites'&&<div className="tn-links">
   <section className="org-panel">
    <h2>Publiskā rezultātu lapa</h2>
    {t.status==='published'?<>
     <div className="tn-share-box"><Qr text={publicLink} label="QR kods uz rezultātu lapu"/>
      <div><p>Grafiks, rezultāti un tabulas ar automātisku atjaunošanu. Saiti vari ielikt pasākuma aprakstā vai sociālajos tīklos.</p>
       <CopyField value={publicLink} label="Rezultātu lapas saite"/>
       <div className="org-row-actions"><a className="button compact" href={'/turniri/'+t.share_token} target="_blank" rel="noopener noreferrer">Atvērt ↗</a><a className="button compact" href={'/turniri/'+t.share_token+'/druka'} target="_blank" rel="noopener noreferrer">Lapas drukai ↗</a></div></div></div>
     {canSave&&<button type="button" className="text-button" disabled={busy||dirty} onClick={()=>save('draft')}>Noņemt no publiskās piekļuves</button>}
    </>:<>
     <p>Kamēr turnīrs ir melnraksts, to redz tikai rīkotāja komanda. Publicējot rodas saite un QR kods; turnīrs MEETS kartē neparādās.</p>
     {canSave&&<button type="button" className="button primary" disabled={busy||!games.length} onClick={()=>save('published')}>{dirty?'Saglabāt un publicēt':'Publicēt rezultātu lapu'}</button>}
     {!games.length&&<small className="tn-hint">Vispirms sastādi grafiku.</small>}
    </>}
    <p className="tn-hint"><a href={'/registre-turnira/druka?id='+t.id} target="_blank" rel="noopener noreferrer">Drukāt grafiku un laukumu lapas</a> — arī melnrakstam, ar treneru vārdiem.</p>
   </section>

   <section className="org-panel">
    <h2>Laukumu sekretāri</h2>
    <p>Katram laukumam sava saite rezultātu ievadei — bez MEETS konta. Sekretārs var ievadīt tikai sava laukuma spēles.</p>
    <ul className="tn-scorers">{[...courts,'*'].map(c=>{const link=scorers.find(x=>x.court===c);const url=link?origin+'/rezultati/'+link.token:'';return <li key={c}>
     <strong>{c==='*'?'Visi laukumi':'Laukums '+c}</strong>
     {link?<><CopyField value={url} label={'Saite: '+c}/><button type="button" className="text-button" disabled={busy||!rights.edit} onClick={()=>scorerLink(c,true)}>Jauna saite</button></>
      :<button type="button" className="button compact" disabled={busy||!rights.edit} onClick={()=>scorerLink(c)}>Izveidot saiti</button>}
    </li>;})}</ul>
   </section>

   {rights.manage&&<section className="org-panel">
    <h2>Labotāji</h2>
    <p>Pievieno cilvēku, kas var labot tieši šo turnīru — komandas, grafiku un rezultātus —, bet neveido jaunus turnīrus un pasākumus.</p>
    <button type="button" className="button compact" disabled={busy} onClick={inviteEditor}>Izveidot uzaicinājuma saiti</button>
    {invite&&<><CopyField value={invite} label="Uzaicinājuma saite"/><small className="tn-hint">Saite derīga 7 dienas un der vienai personai. Visus komandas dalībniekus redzi sadaļā Komanda.</small></>}
   </section>}

   {rights.create&&<section className="org-panel tn-danger"><h2>Dzēst turnīru</h2><p>Tiks dzēstas visas spēles, rezultāti un saites.</p><button type="button" className="button compact danger" disabled={busy} onClick={remove}>Dzēst turnīru…</button></section>}
  </div>}

  <div className="tn-wizard-foot">
   <button type="button" className="button ghost" disabled={stepIndex===0||needsSaved(STEPS[stepIndex-1]?.[0])} onClick={()=>setStep(STEPS[stepIndex-1][0])}>← Atpakaļ</button>
   {canSave&&<button type="button" className={'button'+(dirty?' primary':'')} disabled={busy||!dirty&&Boolean(t.id)} onClick={()=>save()}>{busy?'Saglabā…':t.id?'Saglabāt':'Saglabāt melnrakstu'}</button>}
   {stepIndex<STEPS.length-1&&<button type="button" className="button" disabled={needsSaved(STEPS[stepIndex+1][0])} onClick={()=>setStep(STEPS[stepIndex+1][0])}>{STEPS[stepIndex+1][1]} →</button>}
  </div>
 </section></ProfileShell>;
}

export default function TournamentWizardPage(){
 return <Suspense fallback={<div className="meets-profile-skeleton" role="status">Ielādē turnīru…</div>}><Wizard/></Suspense>;
}

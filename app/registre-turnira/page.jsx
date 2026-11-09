'use client';
import Link from 'next/link';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import {accountRequest,useAccountSession} from '../../lib/account-store.js';
import {canWriteOrganization,submissionDateLabel} from '../../lib/organizer-workspace.js';
import {DEFAULT_STAGES,FORMATS,GROUP_KEYS,SPORTS,STAGE_TYPES,advanceOf,breakStarts,buildGames,dayPlan,placeGame,shiftGame,toTime,cleanStages,planStages,cleanTournament,estimateEnd,formatProblem,groupsOf,hasScore,newTeamKey,parseTeamLines,schedule,scheduleProblems,snakeGroups,sportOf,toMin,usesGroups} from '../../lib/tournament.js';
import FormatDiagram from '../turniri/format-diagrams.jsx';
import DayPlan,{sideText} from './day-plan.jsx';
import {qrPath} from '../../lib/qr-path.js';
import {GroupTables,Places,contextOf,stageLabel} from '../turniri/tournament-views.jsx';
import {ScoreEntry} from '../turniri/score-entry.jsx';

const STEPS=[['formats','Formāts'],['pamati','Pamati'],['komandas','Komandas'],['laiks','Laiks un laukumi'],['grafiks','Grafiks'],['rezultati','Rezultāti'],['saites','Publicēšana un saites']];
const EMPTY={id:'',organization_id:'',title:'',sport:'basket3x3',format:'round_robin',play_date:'',venue:'',submission_id:'',youth:false,status:'draft',share_token:'',
 settings:{courts:['A','B'],start:'10:00',slot:15,rest:15,blocks:[],third:true,advance:2,rest_places:true}};
// Usual numbers going on: the group winners to a final group, two per group to a bracket.
const ADVANCE={groups_final:1,groups_knockout:2};
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

// Whole minutes. The field keeps what is typed, so it can be emptied and
// retyped; the tournament gets the number, or '' while the field is empty.
function NumberField({value,onChange,max=999,...rest}){
 const [text,setText]=useState(value===''||value==null?'':String(value));
 useEffect(()=>{if(String(value??'')!==text&&Number(text)!==value)setText(value===''||value==null?'':String(value));},[value]);
 return <input {...rest} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={text}
  onChange={e=>{const next=e.target.value.replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,String(max).length);setText(next);onChange(next===''?'':Number(next));}}/>;
}
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
 const [step,setStep]=useState('formats');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [paste,setPaste]=useState('');
 const [groupCount,setGroupCount]=useState(4);
 const [courtsInput,setCourtsInput]=useState(courtsText(EMPTY.settings.courts));
 const [picked,setPicked]=useState(null);
 const [courtFilter,setCourtFilter]=useState('');
 const [invite,setInvite]=useState('');
 const loadedOnce=useRef(false);

 const writable=orgs.filter(o=>canWriteOrganization(o.role));
 const org=orgs.find(o=>o.id===t.organization_id)||null;
 const canSave=t.id?rights.edit:Boolean(org&&canWriteOrganization(org.role));
 const dirty=snapshot(t,teams,games)!==saved;
 const ctx={teams,games,sport:t.sport,places:t.settings.places||[]};
 const sport=sportOf(t.sport);
 const groupFormat=usesGroups(t.format);
 const problem=formatProblem(t.format,teams,t.settings);
 const problems=useMemo(()=>games.length?scheduleProblems(games,teams,t.settings):[],[games,teams,t.settings]);
 const planned=useMemo(()=>problem?0:buildGames(t.format,teams,t.settings).length,[t.format,teams,t.settings.third,t.settings.advance,t.settings.rest_places,problem]);
 // An example for each format card: the teams entered so far, else 16.
 const examples=useMemo(()=>{
  const n=teams.length>=4?teams.length:16;
  const sample=Array.from({length:n},(_,i)=>({key:'x'+(i+1),name:'x'+(i+1),coach:'',seed:i+1}));
  const grouped=snakeGroups(sample,Math.max(1,Math.min(groupCount||4,Math.floor(n/2))));
  return Object.fromEntries(Object.keys(FORMATS).map(key=>{
   const tm=usesGroups(key)?grouped:sample;
   let settings=key===t.format||!ADVANCE[key]?t.settings:{...t.settings,advance:ADVANCE[key]};
   if(key==='custom'&&!cleanStages(settings.stages).length)settings={...settings,stages:DEFAULT_STAGES};
   const ok=!formatProblem(key,tm,settings);
   return [key,n+' komandas'+(ok?' · '+buildGames(key,tm,settings).length+' spēles':'')];
  }));
 },[teams.length,groupCount,t.format,t.settings.third,t.settings.advance,t.settings.rest_places,t.settings.stages]);
 // Own stages: the teams entered so far (once in groups), else 16 in the chosen number of groups.
 const customStages=cleanStages(t.settings.stages);
 const planTeams=useMemo(()=>{
  if(teams.length>=2&&teams.every(x=>x.group))return teams;
  const sample=Array.from({length:16},(_,i)=>({key:'x'+(i+1),name:'x'+(i+1),seed:i+1}));
  return snakeGroups(sample,Math.max(1,Math.min(groupCount||4,8)));
 },[teams,groupCount]);
 const customPlan=useMemo(()=>t.format==='custom'?planStages('custom',planTeams,t.settings):[],[t.format,planTeams,t.settings.stages]);
 const customProblem=t.format==='custom'?formatProblem('custom',planTeams,t.settings):'';
 function setStages(list){setSetting('stages',list);}
 function changeStage(i,patch){setStages(customStages.map((st,j)=>{if(j!==i)return st;const next={...st,...patch};if(next.to<next.from)next.to=next.from;return next;}));}
 function addStage(type){const last=Math.max(0,...customStages.map(st=>st.to));setStages([...customStages,{type,from:last+1,to:last+(type==='final'?1:2),third:true}]);}
 function removeStage(i){setStages(customStages.filter((_,j)=>j!==i));}
 // The stages of the chosen format, in words.
 const advance=advanceOf(t.settings);
 const stages={
  round_robin:['Grupas: visi pret visiem, uzvar ar vairāk punktiem'],
  groups_places:['Grupas: visi pret visiem','Spēles par vietām: vienādo vietu komandas no visām grupām'],
  groups_final:['Grupas: visi pret visiem','Finālgrupa: '+advance+' no katras grupas, uzvar līderis',...(t.settings.rest_places!==false?['Pārējās spēlē par vietām']:[])],
  groups_knockout:['Grupas: visi pret visiem','Izslēgšana: '+advance+' no katras grupas'+(t.settings.third!==false?', ar spēli par 3. vietu':''),...(t.settings.rest_places!==false?['Pārējās spēlē par vietām']:[])],
  knockout:['Izslēgšana'+(t.settings.third!==false?', ar spēli par 3. vietu':'')]
 }[t.format]||[];
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
  setT(v=>{
   let settings=ADVANCE[key]&&v.format!==key?{...v.settings,advance:ADVANCE[key]}:v.settings;
   if(key==='custom'&&!cleanStages(settings.stages).length)settings={...settings,stages:DEFAULT_STAGES};
   return {...v,format:key,settings};
  });
  if(usesGroups(key)&&teams.some(x=>!x.group)){const next=splitInto(teams,groupCount);setTeams(next);setGroupCount(new Set(next.map(x=>x.group)).size||1);}
 }

 // Teams
 // Groups follow the list order (the seeding): 1. A, 2. B … and back (snake).
 const maxGroups=Math.max(1,Math.min(GROUP_KEYS.length,Math.floor(teams.length/2)||GROUP_KEYS.length));
 const groupChoices=Array.from({length:GROUP_KEYS.length},(_,i)=>i+1);
 function splitInto(list,count){return list.length?snakeGroups(list,Math.min(count,Math.max(1,Math.floor(list.length/2)))):list;}
 function addPasted(){
  const added=parseTeamLines(paste,teams);
  if(!added.length){setError(paste.trim()?'Šīs komandas jau ir sarakstā.':'Ielīmē komandu nosaukumus, katru savā rindā.');return;}
  const next=groupFormat?splitInto([...teams,...added],groupCount):[...teams,...added];
  setTeams(next);setPaste('');setError('');
  if(groupFormat)setGroupCount(new Set(next.map(x=>x.group)).size||1);
  setNotice('Pievienotas '+added.length+' komandas'+(groupFormat?' un sadalītas '+new Set(next.map(x=>x.group)).size+' grupās.':'.'));
 }
 function addTeam(){setTeams(list=>[...list,{key:newTeamKey(new Set(list.map(x=>x.key))),name:'',coach:'',group:'',seed:list.length+1}]);}
 function updateTeam(key,field,value){setTeams(list=>list.map(x=>x.key===key?{...x,[field]:value}:x));}
 function removeTeam(key){setTeams(list=>list.filter(x=>x.key!==key).map((x,i)=>({...x,seed:i+1})));}
 function moveTeam(key,delta){
  setTeams(list=>{const i=list.findIndex(x=>x.key===key),j=i+delta;if(j<0||j>=list.length)return list;const next=[...list];[next[i],next[j]]=[next[j],next[i]];return next.map((x,n)=>({...x,seed:n+1}));});
 }
 const groupsNow=groupsOf(teams);
 function chooseGroupCount(count){
  setGroupCount(count);setError('');
  if(teams.length<2)return;
  if(count>Math.floor(teams.length/2)){setError('Katrā grupā vajag vismaz 2 komandas: '+teams.length+' komandām līdz '+Math.floor(teams.length/2)+' grupām.');return;}
  setTeams(list=>snakeGroups(list,count));
  setNotice('Komandas sadalītas '+count+(count===1?' grupā.':' grupās.')+' Grupu vari mainīt katrai komandai sarakstā.');
 }

 // Schedule
 function makeSchedule(){
  setError('');setNotice('');
  if(problem){setError(problem);setStep('komandas');return;}
  if(teams.some(x=>!x.name.trim())){setError('Katrai komandai vajag nosaukumu.');setStep('komandas');return;}
  if(scored&&!window.confirm('Grafiks tiks sastādīts no jauna. Spēlēm, kuru pāri mainīsies, ievadītie rezultāti tiks dzēsti. Turpināt?'))return;
  const built=buildGames(t.format,teams,t.settings);
  const result=schedule(built,teams,t.settings,{tries:160,seed:1+Math.floor(Math.random()*100000)});
  if(!result){setError('Visas spēles neizdevās ievietot līdz dienas beigām. Pievieno laukumu, saīsini spēles vai atpūtas laiku, vai pārtraukumus.');return;}
  setGames(result);setSetting('places',result.direct||[]);setPicked(null);
  setNotice(result.length+' spēles ievietotas. Pēdējā sākas '+result.reduce((m,g)=>toMin(g.starts_at)>toMin(m)?g.starts_at:m,result[0].starts_at)+'.');
 }
 // By hand: pick a game, then another game (they swap) or a free place (it moves there).
 function onPlanCell(time,court,game){
  if(picked===null){if(game)setPicked(game.no);return;}
  if(game&&game.no===picked){setPicked(null);return;}
  setGames(list=>placeGame(list,picked,time,court));setPicked(null);
 }
 function stepPicked(step){setGames(list=>shiftGame(list,picked,step,t.settings));}
 const pickedGame=games.find(g=>g.no===picked)||null;
 // The day with the settings being edited: a schedule tried in the background,
 // and how much later the day ends because of each break.
 const preview=useMemo(()=>{
  if(step!=='laiks'||problem||teams.length<2||teams.some(x=>!x.name.trim())||!(t.settings.courts||[]).length)return null;
  const run=settings=>schedule(buildGames(t.format,teams,settings),teams,settings,{tries:20,seed:7});
  const slot=Number(t.settings.slot)||15;
  const endOf=list=>list&&list.length?Math.max(...list.map(g=>toMin(g.starts_at)))+slot:null;
  const base=run(t.settings);
  if(!base)return {failed:true};
  const end=endOf(base),impacts={};
  (t.settings.blocks||[]).forEach((b,i)=>{const other=run({...t.settings,blocks:t.settings.blocks.filter((_,j)=>j!==i)});if(other)impacts[i]=end-endOf(other);});
  if(Number(t.settings.stage_break)>0){const other=run({...t.settings,stage_break:0});if(other)impacts.pause=end-endOf(other);}
  return {games:base,impacts};
 },[step,problem,teams,t.format,t.settings]);
 const hasStages=t.format!=='round_robin'&&t.format!=='knockout';
 // A break starts where a game could: the time nearest to `target` among those.
 function addBlock(title,minutes,target){
  const options=breakStarts(t.settings).map(toMin);
  const at=options.length?options.reduce((best,x)=>Math.abs(x-target)<Math.abs(best-target)?x:best,options[0]):target;
  setSetting('blocks',[...(t.settings.blocks||[]),{title,at:toTime(at),minutes}]);
 }

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
 // Every court and "all courts" at once; links that exist stay as they are.
 async function allScorerLinks(){
  setBusy(true);setError('');
  try{
   const missing=[...(t.settings.courts||[]),'*'].filter(c=>!scorers.some(x=>x.court===c));
   const made=[];
   for(const court of missing){const r=await accountRequest(API,'scorerLink',{id:t.id,court,renew:false});made.push({court,token:r.token});}
   setScorers(list=>[...list,...made].sort((a,b)=>a.court.localeCompare(b.court)));
   setNotice(made.length?'Izveidotas '+made.length+' saites. Laukumu drukas lapās tās ir kā QR kodi.':'Visām saitēm jau ir izveidotas.');
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

 return <ProfileShell mode="organizer" activeOrganization={org} compact><section className="org-workspace tn-wizard">
  <header className="ev-head tn-wizard-head">
   <Link className="ev-back" href={backHref}>← Turnīri</Link>
   <h1>{t.id?t.title||'Turnīrs':'Jauns turnīrs'}</h1>
   <span className={'tn-save-state'+(dirty&&canSave?' is-dirty':'')} role="status">{readOnly?'Tikai skatīšanai':busy?'Saglabā…':dirty?'Nesaglabātas izmaiņas':t.id?(t.status==='published'?'Publicēts':'Melnraksts · saglabāts'):''}</span>
  </header>

  <nav className="tn-steps" aria-label="Turnīra soļi"><ol>{STEPS.map(([key,label],i)=><li key={key}>
   <button type="button" aria-current={step===key?'step':undefined} className={step===key?'active':i<stepIndex?'done':''} disabled={needsSaved(key)} title={needsSaved(key)?'Pieejams pēc saglabāšanas':undefined} onClick={()=>{setStep(key);setError('');setNotice('');}}>
    <span aria-hidden="true">{i+1}</span><span className="tn-step-label">{label}</span></button></li>)}</ol></nav>
  <p className="tn-step-caption" aria-hidden="true">{stepIndex+1}. solis no {STEPS.length}: {STEPS[stepIndex][1]}</p>

  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {readOnly&&t.id&&<p className="tn-note">Tev ir tiesības šo turnīru skatīt, bet ne labot.</p>}

  <fieldset className="tn-step-body" disabled={readOnly&&!['rezultati','saites'].includes(step)}>
  {step==='formats'&&<div className="tn-formats">
   <div className="tn-formats-head"><h2>Kā notiks turnīrs?</h2><p>Izvēlies uzbūvi. Komandas, laikus un laukumus ievadīsi nākamajos soļos.</p></div>
   <fieldset className="tn-format-grid"><legend className="sr-only">Turnīra formāts</legend>
    {Object.entries(FORMATS).map(([key,f])=><label key={key} className={'tn-format-card'+(t.format===key?' is-on':'')}>
     <input type="radio" name="format" checked={t.format===key} onChange={()=>chooseFormat(key)}/>
     <FormatDiagram format={key}/>
     <span className="tn-format-text"><strong>{f.name}</strong><small>{f.hint}</small><em>{examples[key]}</em></span>
    </label>)}
   </fieldset>
   <section className="tn-format-plan" aria-labelledby="tn-plan-title">
    <h3 id="tn-plan-title">{FORMATS[t.format]?.name}</h3>
    {t.format!=='custom'&&<ol>{stages.map((line,i)=><li key={i}><span aria-hidden="true">{i+1}</span>{line}</li>)}</ol>}
    {t.format==='custom'&&<div className="tn-stage-builder">
     <p className="tn-stage-intro">{teams.length>=2&&teams.every(x=>x.group)?'Tavām komandām':'Piemērs: 16 komandas '+Object.keys(groupsOf(planTeams)).length+' grupās'} — vietas sadalās pēc posmu secības.</p>
     <ol>
      <li className="tn-stage"><span className="tn-stage-no" aria-hidden="true">1</span><div className="tn-stage-body"><strong>Grupas</strong><small>Visi pret visiem grupā</small></div></li>
      {customStages.map((st,i)=>{const info=customPlan.find(x=>x.index===i);return <li className="tn-stage" key={i}>
       <span className="tn-stage-no" aria-hidden="true">{i+2}</span>
       <div className="tn-stage-body">
        <label>Posms<select value={st.type} onChange={e=>changeStage(i,{type:e.target.value})}>{Object.entries(STAGE_TYPES).map(([key,x])=><option key={key} value={key}>{x.name}</option>)}</select></label>
        <div className="tn-stage-range">
         <label>No vietas<select value={st.from} onChange={e=>changeStage(i,{from:Number(e.target.value)})}>{Array.from({length:8},(_,n)=><option key={n} value={n+1}>{n+1}.</option>)}</select></label>
         <label>Līdz vietai<select value={st.to} onChange={e=>changeStage(i,{to:Number(e.target.value)})}>{Array.from({length:8},(_,n)=>n+1).filter(n=>n>=st.from).map(n=><option key={n} value={n}>{n}.</option>)}</select></label>
        </div>
        {st.type==='knockout'&&<label className="tn-switch"><input type="checkbox" checked={st.third} onChange={e=>changeStage(i,{third:e.target.checked})}/><span><strong>Spēle par 3. vietu</strong></span></label>}
        <small>{(st.from===st.to?st.from+'. vieta':st.from+'.–'+st.to+'. vieta')+' katrā grupā'}{info&&info.refs.length?' · '+info.refs.length+' komandas · par '+(info.refs.length>1?info.start+'.–'+info.end+'. vietu':info.start+'. vietu'):' · šīm vietām grupās nav komandu'}</small>
       </div>
       <button type="button" className="icon-button tn-stage-remove" aria-label={'Noņemt posmu: '+STAGE_TYPES[st.type].name} onClick={()=>removeStage(i)}>×</button>
      </li>;})}
     </ol>
     {customProblem&&<p className="tn-stage-problem" role="alert">{customProblem}</p>}
     {customStages.length<4&&<div className="tn-stage-add"><span>+ Pievienot posmu</span>
      {Object.entries(STAGE_TYPES).map(([key,x])=><button key={key} type="button" onClick={()=>addStage(key)}><strong>{x.name}</strong><small>{x.hint}</small></button>)}</div>}
    </div>}
    {FORMATS[t.format]?.advance&&<div className="tn-segment-field"><span id="tn-advance">No katras grupas iziet</span>
     <div className="tn-segment" role="group" aria-labelledby="tn-advance">{[1,2,3,4].map(n=><button key={n} type="button" aria-pressed={advance===n} className={advance===n?'is-on':''} onClick={()=>setSetting('advance',n)}>{n}</button>)}</div></div>}
    {['knockout','groups_knockout'].includes(t.format)&&<label className="tn-switch"><input type="checkbox" checked={t.settings.third!==false} onChange={e=>setSetting('third',e.target.checked)}/><span><strong>Spēle par 3. vietu</strong><small>Pusfinālu zaudētāji spēlē par bronzu</small></span></label>}
    {FORMATS[t.format]?.advance&&<label className="tn-switch"><input type="checkbox" checked={t.settings.rest_places!==false} onChange={e=>setSetting('rest_places',e.target.checked)}/><span><strong>Pārējām spēles par vietām</strong><small>Neizgājušās komandas izspēlē savas vietas</small></span></label>}
   </section>
  </div>}

  {step==='pamati'&&<div className="org-panel tn-form">
   {!t.id&&writable.length>1&&<label>Rīkotājs<select value={t.organization_id} onChange={e=>set('organization_id',e.target.value)}><option value="">Izvēlies rīkotāju</option>{writable.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
   <label>Turnīra nosaukums<input value={t.title} maxLength={160} placeholder="Piem., Mārupes kauss 2026 · 2018. g. dz. zēni" onChange={e=>set('title',e.target.value)}/></label>
   <fieldset className="tn-choice-grid"><legend>Sporta veids</legend>
    {Object.entries(SPORTS).map(([key,s])=><label key={key} className={'tn-choice'+(t.sport===key?' is-on':'')}><input type="radio" name="sport" checked={t.sport===key} onChange={()=>chooseSport(key)}/>
     <strong>{s.name}</strong><small>{s.slot} min · {s.rank==='wins'?'skaita uzvaras':s.rank==='sets'?'seti':'punkti tabulā'}</small></label>)}
   </fieldset>
   <p className="tn-rules">{sport.rules}</p>
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
    <label>Grupu skaits<select value={groupCount} onChange={e=>chooseGroupCount(Number(e.target.value))}>
     {groupChoices.map(n=><option key={n} value={n} disabled={teams.length>=2&&n>maxGroups}>{n}</option>)}</select></label>
    <small>Komandas sadalās grupās pēc saraksta secības (spēcīgākās augšā): 1. A, 2. B … un atpakaļ.</small>
   </div>}
   {groupFormat&&Object.keys(groupsNow).length>0&&<div className="tn-group-summary" aria-label="Grupas">{Object.entries(groupsNow).map(([g,list])=><div key={g}>
    <strong>{g}</strong><span>{list.map(x=>x.name||'—').join(', ')}</span></div>)}</div>}
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
   <div className="tn-row tn-row-3 tn-row-even">
    <label>Pirmā spēle<input type="time" step="300" value={t.settings.start} onChange={e=>setSetting('start',e.target.value)}/><small>Kad sākas pirmā spēle</small></label>
    <label>Spēles laiks, min<NumberField max={180} value={t.settings.slot} onChange={v=>setSetting('slot',v)}/><small>Ar maiņu un iesildīšanos</small></label>
    <label>Atpūta komandai, min<NumberField max={240} value={t.settings.rest} onChange={v=>setSetting('rest',v)}/><small>Starp vienas komandas spēlēm</small></label>
   </div>
   <div className="tn-row tn-row-3 tn-row-even">
    <label>Starplaiks starp spēlēm, min<NumberField max={60} value={t.settings.gap??0} onChange={v=>setSetting('gap',v)}/><small>Laukums brīvs pēc katras spēles</small></label>
    {hasStages&&<label>Pārtraukums pēc grupām, min<NumberField max={240} value={t.settings.stage_break??0} onChange={v=>setSetting('stage_break',v)}/><small>Pirms spēlēm par vietām vai izslēgšanas</small></label>}
   </div>
   <fieldset className="tn-blocks"><legend>Pārtraukumi un citas aktivitātes</legend>
    {(t.settings.blocks||[]).map((b,i)=>{const change=(key,value)=>setSetting('blocks',t.settings.blocks.map((x,j)=>j===i?{...x,[key]:value}:x));return <div className="tn-block-row" key={i}>
     <label className="tn-block-title">Nosaukums<input value={b.title} maxLength={60} placeholder="Piem., Metienu konkurss" onChange={e=>change('title',e.target.value)}/></label>
     <label>Sākums<select value={b.at} onChange={e=>change('at',e.target.value)}>{[...new Set([b.at,...breakStarts(t.settings,i)])].filter(Boolean).sort().map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label>Ilgums, min<NumberField max={240} value={b.minutes} onChange={v=>change('minutes',v)}/></label>
     <button type="button" className="icon-button" aria-label={'Dzēst: '+(b.title||'pārtraukums')} onClick={()=>setSetting('blocks',t.settings.blocks.filter((x,j)=>j!==i))}>×</button>
    </div>;})}
    <div className="tn-block-presets">
     <button type="button" className="button compact ghost" onClick={()=>addBlock('Pārtraukums',15,(toMin(t.settings.start)??600)+120)}>+ Pārtraukums 15 min</button>
     <button type="button" className="button compact ghost" onClick={()=>addBlock('Pusdienas',30,12*60)}>+ Pusdienas 30 min</button>
     <button type="button" className="button compact ghost" onClick={()=>addBlock('',15,(toMin(t.settings.start)??600)+60)}>+ Cita aktivitāte</button>
    </div>
    <small>Sākumu var izvēlēties tikai tad, kad varētu sākties spēle. Šajā laikā spēles neliek nevienā laukumā.</small>
   </fieldset>
   <section className="tn-day-wrap" aria-labelledby="tn-day-title">
    <h3 id="tn-day-title">Dienas plāns</h3>
    {preview?.games?<>
     <p>{preview.games.length} spēles {courts.length} laukumos, {dayPlan(preview.games,t.settings).start}–{dayPlan(preview.games,t.settings).end}. Pie katra pārtraukuma redzams, cik vēlāk tā dēļ beigsies diena. Precīzu grafiku sastādīsi nākamajā solī.</p>
     <DayPlan plan={dayPlan(preview.games,t.settings)} courts={courts} ctx={{...ctx,games:preview.games}} impacts={preview.impacts}/>
    </>:preview?.failed?<p className="tn-warn">Ar šiem laikiem visas spēles dienā neietilpst. Pievieno laukumu vai saīsini laikus.</p>
     :<p className="tn-hint">{planned>0&&courts.length>0?planned+' spēles '+courts.length+' laukumos · beigas ap '+estimateEnd(t.settings,planned)+'. ':''}Dienas plāns parādīsies, kad būs ievadītas komandas.</p>}
   </section>
  </div>}

  {step==='grafiks'&&<div className="org-panel tn-form">
   <div className="tn-schedule-bar">
    <button type="button" className="button primary" onClick={makeSchedule} disabled={busy}>{games.length?'Sastādīt no jauna':'Sastādīt grafiku'}</button>
    <small>Ievēro laukumus, pārtraukumus, komandu atpūtu un to, ka viens treneris nevar būt divās spēlēs reizē. Lai mainītu ar roku, pieskaries spēlei un tad citai spēlei (samainīt) vai brīvai vietai (pārvietot).</small>
   </div>
   {stale&&<p className="tn-warn">Komandas vai formāts mainīti — sastādi grafiku no jauna.</p>}
   {games.length>0&&(problems.length?<ul className="tn-problems" role="alert">{problems.map(p=><li key={p}>{p}</li>)}</ul>
    :<p className="tn-ok">✓ Grafikā nav pārklāšanos: laukumi, atpūta un treneri pārbaudīti.</p>)}
   {pickedGame&&<div className="tn-pick-bar" role="status">
    <span><strong>Spēle {pickedGame.no}</strong> · {pickedGame.starts_at} · {pickedGame.court}: {sideText(pickedGame.home,ctx)} – {sideText(pickedGame.away,ctx)}</span>
    <span className="tn-pick-actions">
     <button type="button" className="button compact" onClick={()=>stepPicked(-1)}>↑ Agrāk</button>
     <button type="button" className="button compact" onClick={()=>stepPicked(1)}>↓ Vēlāk</button>
     <button type="button" className="button compact ghost" onClick={()=>setPicked(null)}>Gatavs</button>
    </span>
   </div>}
   {games.length>0?<DayPlan plan={dayPlan(games,t.settings,{extra:2})} courts={courts.length?courts:[...new Set(games.map(g=>g.court))]} ctx={ctx} picked={picked} onCell={onPlanCell}/>
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
    <div className="org-row-actions">
     <button type="button" className="button compact primary" disabled={busy||!rights.edit} onClick={allScorerLinks}>Izveidot visas saites</button>
     <a className="button compact" href={'/registre-turnira/druka?id='+t.id+'&lapa=laukumi'} target="_blank" rel="noopener noreferrer">Drukāt laukumu lapas ar QR ↗</a>
    </div>
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
   <button type="button" className="button ghost tn-foot-back" aria-label="Iepriekšējais solis" disabled={stepIndex===0||needsSaved(STEPS[stepIndex-1]?.[0])} onClick={()=>{setStep(STEPS[stepIndex-1][0]);window.scrollTo({top:0});}}>← <span className="tn-wide">Atpakaļ</span></button>
   {canSave&&<button type="button" className={'button'+(dirty?' primary':'')} disabled={busy||!dirty&&Boolean(t.id)} onClick={()=>save()}>{busy?'Saglabā…':'Saglabāt'}</button>}
   {stepIndex<STEPS.length-1&&<button type="button" className="button" disabled={needsSaved(STEPS[stepIndex+1][0])} title={needsSaved(STEPS[stepIndex+1][0])?'Vispirms saglabā':undefined} onClick={()=>{setStep(STEPS[stepIndex+1][0]);window.scrollTo({top:0});}}><span className="tn-wide">{STEPS[stepIndex+1][1]}</span><span className="tn-narrow">Tālāk</span> →</button>}
  </div>
 </section></ProfileShell>;
}

export default function TournamentWizardPage(){
 return <Suspense fallback={<div className="meets-profile-skeleton" role="status">Ielādē turnīru…</div>}><Wizard/></Suspense>;
}

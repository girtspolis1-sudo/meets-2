'use client';
import {useEffect,useMemo,useState} from 'react';
import {hasScore,sportOf,toMin} from '../../../lib/tournament.js';
import {ScoreEntry} from '../../turniri/score-entry.jsx';
import {GroupTables,Schedule,contextOf,playDateLabel} from '../../turniri/tournament-views.jsx';

const REFRESH_MS=30000;

// Results entry for one court ('*' = every court). Other courts are shown for
// reference; the tables update as results come in.
export default function ScorerBoard({token,initial}){
 const [data,setData]=useState(initial);
 const [view,setView]=useState('mine');
 const all=data.court==='*';
 async function reload(){
  const response=await fetch('/api/tournaments?scorer='+encodeURIComponent(token),{cache:'no-store'});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||'Neizdevās ielādēt.');
  setData(body.tournament);
 }
 useEffect(()=>{
  const timer=setInterval(()=>{if(document.visibilityState==='visible')reload().catch(()=>{});},REFRESH_MS);
  return()=>clearInterval(timer);
 },[token]);
 async function save(no,home,away,details){
  const response=await fetch('/api/tournaments',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
   body:JSON.stringify({action:'scorerScore',scorer_token:token,no,home,away,details})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||'Neizdevās saglabāt.');
  await reload();
 }
 const ctx=contextOf(data);
 const mine=useMemo(()=>ctx.games.filter(g=>all||g.court===data.court).sort((a,b)=>(toMin(a.starts_at)??0)-(toMin(b.starts_at)??0)||a.no-b.no),[data]);
 const next=mine.find(g=>!hasScore(g));
 const done=mine.filter(hasScore).length;
 return <main className="tn-page tn-scorer">
  <header className="tn-hero tn-hero-compact">
   <div className="tn-hero-inner">
    <p className="tn-sport">{sportOf(data.sport).name} · rezultātu ievade</p>
    <h1>{all?'Visi laukumi':'Laukums '+data.court}</h1>
    <p className="tn-hero-meta">{[data.title,playDateLabel(data.play_date)].filter(Boolean).join(' · ')}</p>
    <p className="tn-progress"><span style={{'--done':mine.length?done/mine.length:0}}/><small>{done} no {mine.length} spēlēm ar rezultātu</small></p>
   </div>
  </header>
  <nav className="tn-tabs" aria-label="Skats"><div role="tablist">
   <button type="button" role="tab" aria-selected={view==='mine'} className={view==='mine'?'active':''} onClick={()=>setView('mine')}>{all?'Spēles':'Mans laukums'}</button>
   {!all&&<button type="button" role="tab" aria-selected={view==='all'} className={view==='all'?'active':''} onClick={()=>setView('all')}>Viss grafiks</button>}
   <button type="button" role="tab" aria-selected={view==='tables'} className={view==='tables'?'active':''} onClick={()=>setView('tables')}>Tabulas</button>
  </div></nav>
  <div className="tn-body">
   {view==='mine'&&<ol className="tn-entries">{mine.map(g=><ScoreEntry key={g.no} game={g} ctx={ctx} sport={data.sport} current={g===next} onSave={save}/>)}</ol>}
   {view==='all'&&<Schedule data={data}/>}
   {view==='tables'&&<GroupTables data={data}/>}
   <p className="tn-note">Rezultāti uzreiz parādās turnīra lapā. Ja kļūdījies, izlabo un saglabā vēlreiz.</p>
  </div>
 </main>;
}

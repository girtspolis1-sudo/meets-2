'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import ShareButton from '../../components/share-button.jsx';
import {groupsOf,playsIn,sportOf} from '../../../lib/tournament.js';
import {GameRow,GroupTables,Places,Schedule,contextOf,formatName,gameMoments,nowBlock,playDateLabel,rigaNow} from '../tournament-views.jsx';
import {organizerPath} from '../../../lib/organizer-path.js';

const REFRESH_MS=30000;
const TEAM_KEY=token=>'meets_tournament_team:'+token;

function QrCode({qr,label}){
 return <svg className="tn-qr" viewBox={`-4 -4 ${qr.size+8} ${qr.size+8}`} role="img" aria-label={label} shapeRendering="crispEdges">
  <rect x="-4" y="-4" width={qr.size+8} height={qr.size+8} fill="#fff"/><path d={qr.d} fill="#1b2430"/>
 </svg>;
}

// The public page of a published tournament: schedule, tables and places,
// refreshed every 30 seconds while the page is open.
export default function TournamentLive({token,initial,link,qr}){
 const [data,setData]=useState(initial);
 const [updated,setUpdated]=useState(null);
 const [now,setNow]=useState(null);
 const [tab,setTab]=useState('grafiks');
 const [court,setCourt]=useState('');
 const [team,setTeam]=useState('');
 const [stale,setStale]=useState(false);

 useEffect(()=>{
  try{setTeam(localStorage.getItem(TEAM_KEY(token))||'');}catch{}
  setNow(rigaNow());setUpdated(new Date());
  let alive=true;
  async function refresh(){
   if(document.visibilityState!=='visible')return;
   try{
    // No cache option: the response itself says how long the CDN may keep it.
    const response=await fetch('/api/tournaments?share='+encodeURIComponent(token));
    if(!response.ok)throw Error();
    const body=await response.json();
    if(alive&&body.tournament){setData(body.tournament);setUpdated(new Date());setStale(false);}
   }catch{if(alive)setStale(true);}
   if(alive)setNow(rigaNow());
  }
  const timer=setInterval(refresh,REFRESH_MS);
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[token]);

 function chooseTeam(key){
  setTeam(key);
  try{key?localStorage.setItem(TEAM_KEY(token),key):localStorage.removeItem(TEAM_KEY(token));}catch{}
 }

 const sport=sportOf(data.sport);
 const ctx=contextOf(data);
 const courts=useMemo(()=>[...new Set((data.games||[]).map(g=>g.court).filter(Boolean))],[data.games]);
 const groups=Object.keys(groupsOf(data.teams||[]));
 const youth=data.youth===true;
 const showPlaces=!youth&&(data.format!=='round_robin'||groups.length===1);
 const tabs=[['grafiks','Grafiks'],...(!youth&&groups.length?[['tabulas','Tabulas']]:[]),...(showPlaces?[['vietas','Vietas']]:[])];
 const moments=useMemo(()=>gameMoments(data,now),[data,now]);
 const current=useMemo(()=>nowBlock(data,moments,team),[data,moments,team]);
 // The chosen team's games, also the later ones once their references (A1, W:5) are settled.
 const games=useMemo(()=>(data.games||[]).filter(g=>(!court||g.court===court)&&playsIn(g,team,ctx)),[data,court,team]);
 const when=playDateLabel(data.play_date);
 const org=data.organization||{};
 const orgHref=org.id?organizerPath(org):'';

 return <main className="tn-page">
  <header className="tn-hero">
   <div className="tn-hero-inner">
    <p className="tn-sport">{sport.name} · {formatName(data.format)}</p>
    <h1>{data.title}</h1>
    <p className="tn-hero-meta">{[when,data.venue].filter(Boolean).join(' · ')}</p>
    {org.name&&<p className="tn-hero-org">Rīko {orgHref?<Link href={orgHref}>{org.name}</Link>:org.name}{data.event_token&&<> · <Link href={'/ielugums/'+data.event_token}>Pasākuma lapa</Link></>}</p>}
   </div>
  </header>

  <nav className="tn-tabs" aria-label="Turnīra sadaļas">
   <div role="tablist">{tabs.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
   <span className={'tn-refresh'+(stale?' is-stale':'')} role="status">{stale?'Nav savienojuma — rāda pēdējos datus':updated?'Atjaunots '+updated.toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'}):''}</span>
  </nav>

  <div className="tn-body">
   {youth&&<p className="tn-note">Bērnu turnīrs: rezultāti un tabulas publiski netiek rādīti.</p>}

   {tab==='grafiks'&&current&&(current.ended
    ?<section className="tn-now tn-now-ended" aria-label="Turnīrs beidzies"><h2>Turnīrs beidzies</h2><p>Visām spēlēm ir rezultāts.</p>{showPlaces&&<button type="button" className="button compact" onClick={()=>setTab('vietas')}>Skatīt vietas</button>}</section>
    :<section className="tn-now" aria-labelledby="tn-now-title">
     <h2 id="tn-now-title">{current.live.length?'Notiek tagad':'Nākamās spēles'}</h2>
     <ul className="tn-now-list">{(current.live.length?current.live:current.next).map(g=><GameRow key={g.no} game={g} ctx={ctx} showScore={!youth} moment={moments[g.no]} focusTeam={team} showCourt={courts.length>1}/>)}</ul>
     {current.mine&&<p className="tn-now-mine">Tava komanda: nākamā spēle {current.mine.starts_at}{courts.length>1?', laukums '+current.mine.court:''} (Nr. {current.mine.no})</p>}
     {current.recent.length>0&&<details className="tn-now-recent"><summary>Tikko beigušās ({current.recent.length})</summary>
      <ul className="tn-now-list">{current.recent.map(g=><GameRow key={g.no} game={g} ctx={ctx} showScore={!youth} focusTeam={team} showCourt={courts.length>1}/>)}</ul></details>}
     <a className="tn-now-all" href="#tn-schedule">Viss grafiks ↓</a>
    </section>)}

   {tab==='grafiks'&&<section aria-label="Spēļu grafiks" id="tn-schedule">
    <div className="tn-filters">
     {courts.length>1&&<label>Laukums<select value={court} onChange={e=>setCourt(e.target.value)}><option value="">Visi laukumi</option>{courts.map(c=><option key={c} value={c}>{c}</option>)}</select></label>}
     <label>Mana komanda<select value={team} onChange={e=>chooseTeam(e.target.value)}><option value="">Visas komandas</option>{(data.teams||[]).map(t=><option key={t.key} value={t.key}>{t.name}</option>)}</select></label>
    </div>
    <Schedule data={data} games={games} showScores={!youth} moments={moments} focusTeam={team} showCourt={courts.length>1}/>
   </section>}

   {tab==='tabulas'&&<section aria-label="Grupu tabulas"><GroupTables data={data} focusTeam={team}/><p className="tn-rules">{sport.rules}</p></section>}
   {tab==='vietas'&&<section aria-label="Gala vietas"><Places data={data} focusTeam={team}/></section>}

   <aside className="tn-share" aria-label="Saite uz rezultātiem">
    <QrCode qr={qr} label="QR kods uz šo lapu"/>
    <div>
     <strong>Rezultāti tālrunī</strong>
     <p>Noskenē kodu vai atver saiti — lapa atjaunojas pati.</p>
     <span className="tn-link">{link.replace(/^https?:\/\//,'')}</span>
     <div className="tn-share-actions">
      <ShareButton path={'/turniri/'+token} title={data.title} label="Dalīties" className="button compact"/>
      <a className="button compact ghost" href={'/turniri/'+token+'/druka'} target="_blank" rel="noopener noreferrer">Drukāt</a>
     </div>
    </div>
   </aside>
  </div>
 </main>;
}

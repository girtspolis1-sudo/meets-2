// Read-only views of a tournament, shared by the public page, the court
// secretary page, the organizer wizard and the print sheets.
import {FORMATS,finalGroupStandings,finalPlaces,groupsOf,hasScore,planStages,resolveRef,sideName,sportOf,standings,toMin,winnerSide} from '../../lib/tournament.js';

export function contextOf(data){
 return {teams:data?.teams||[],games:data?.games||[],sport:data?.sport||'other',places:data?.settings?.places||[]};
}
export function stageLabel(game){
 if(game.stage==='group')return game.group?game.group+' grupa':'Grupa';
 if(game.stage==='final')return 'Finālgrupa';
 return game.label||(game.place?'Par '+game.place+'. vietu':'Izslēgšanas spēle');
}
const DATE=new Intl.DateTimeFormat('lv-LV',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export function playDateLabel(iso){
 return /^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?DATE.format(new Date(iso+'T12:00:00Z')):'';
}
// Riga date and minutes of the day, for "now playing".
export function rigaNow(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
// 'live' while a game's slot runs on the tournament day, 'next' for the next
// start of a game not played yet (a game with a result is never "next").
export function gameMoments(data,now){
 const out={};
 if(!now||data?.play_date!==now.date)return out;
 const slot=Number(data.settings?.slot)||15;
 let next=null;
 for(const g of data.games||[]){
  const at=toMin(g.starts_at);if(at===null)continue;
  if(!hasScore(g)&&at<=now.minutes&&now.minutes<at+slot)out[g.no]='live';
  else if(!hasScore(g)&&at>now.minutes&&(next===null||at<next))next=at;
 }
 if(next!==null)for(const g of data.games||[])if(toMin(g.starts_at)===next&&!hasScore(g))out[g.no]=out[g.no]||'next';
 return out;
}

// The block at the top of the schedule while a tournament is on: the games on
// the courts now (else the next start), the chosen team's next game and the
// games that just ended. null before the first result on another day, and
// 'ended' once every game has a result.
export function nowBlock(data,moments,focusTeam=''){
 const games=[...(data?.games||[])].sort((a,b)=>(toMin(a.starts_at)??9999)-(toMin(b.starts_at)??9999)||a.no-b.no);
 if(!games.length)return null;
 const open=games.filter(g=>!hasScore(g)),played=games.filter(hasScore);
 if(!open.length)return {ended:true};
 const live=games.filter(g=>moments[g.no]==='live');
 const firstAt=open[0].starts_at;
 const next=live.length?[]:open.filter(g=>g.starts_at===firstAt);
 const underway=played.length>0||Object.keys(moments).length>0;
 if(!underway)return null;
 const ctx=contextOf(data);
 const mine=focusTeam?open.find(g=>[g.home,g.away].some(ref=>ref==='T:'+focusTeam||resolveRef(ref,ctx)?.key===focusTeam))||null:null;
 return {live,next,mine,recent:played.slice(-3).reverse()};
}

export function Score({game,show=true}){
 if(!show)return <span className="tn-score tn-score-hidden" aria-label="Rezultāts netiek rādīts">–</span>;
 if(!hasScore(game))return <span className="tn-score tn-score-empty" aria-label="Vēl nav rezultāta">:</span>;
 const extra=game.details?.ot?' pl.':game.home_score===game.away_score&&game.details?.winner?' *':'';
 return <span className="tn-score" aria-label={'Rezultāts '+game.home_score+':'+game.away_score}><b>{game.home_score}</b><i>:</i><b>{game.away_score}</b>{extra&&<small>{extra}</small>}</span>;
}

export function GameRow({game,ctx,showScore=true,moment='',focusTeam='',showCourt=true,children=null}){
 const home=sideName(game.home,ctx),away=sideName(game.away,ctx);
 const won=showScore?winnerSide(game):'';
 const mine=key=>focusTeam&&key===focusTeam?' is-mine':'';
 return <li className={'tn-game'+(moment?' is-'+moment:'')+(hasScore(game)&&showScore?' is-done':'')}>
  <span className="tn-game-when"><strong>{game.starts_at||'—'}</strong>{showCourt&&game.court&&<small>{game.court}</small>}</span>
  <span className={'tn-side tn-home'+(home.known?'':' is-open')+(won==='home'?' is-won':'')+mine(home.key)}>{home.name}</span>
  <Score game={game} show={showScore}/>
  <span className={'tn-side tn-away'+(away.known?'':' is-open')+(won==='away'?' is-won':'')+mine(away.key)}>{away.name}</span>
  <span className="tn-game-meta">Nr. {game.no} · {stageLabel(game)}{moment==='live'&&<em className="tn-live">Notiek</em>}{moment==='next'&&<em className="tn-next">Nākamā</em>}</span>
  {children}
 </li>;
}

// Games by start time; one list per time so courts read side by side.
export function Schedule({data,games,showScores=true,moments={},focusTeam='',showCourt=true}){
 const ctx=contextOf(data);
 const list=games||ctx.games;
 const times=[];
 for(const g of [...list].sort((a,b)=>(toMin(a.starts_at)??9999)-(toMin(b.starts_at)??9999)||a.no-b.no)){
  const last=times[times.length-1];
  if(last&&last.at===g.starts_at)last.games.push(g);else times.push({at:g.starts_at,games:[g]});
 }
 if(!list.length)return <p className="tn-empty">Spēļu grafiks vēl nav sastādīts.</p>;
 return <ol className="tn-schedule">{times.map(block=><li key={block.at||'none'} className="tn-time-block">
  <ul>{block.games.map(g=><GameRow key={g.no} game={g} ctx={ctx} showScore={showScores} moment={moments[g.no]} focusTeam={focusTeam} showCourt={showCourt}/>)}</ul>
 </li>)}</ol>;
}

// One group table with the columns the sport ranks by.
export function GroupTable({data,group,focusTeam=''}){
 return <TableView data={data} id={'tn-group-'+group} title={group+' grupa'} table={standings(group,data.teams||[],data.games||[],data.sport)} focusTeam={focusTeam} zones={goingOn(data)}/>;
}
// Group places that go on to a final group or a knockout: {place: 'Izslēgšana' …}.
const ZONE_NAMES={final:'finālgrupā',knockout:'izslēgšanā'};
export function goingOn(data){
 const out={};
 for(const st of planStages(data?.format,data?.teams||[],data?.settings||{}))
  if(ZONE_NAMES[st.type])for(let k=st.from;k<=st.to;k++)out[k]=ZONE_NAMES[st.type];
 return out;
}
// The final group: the best of every group, shown by name once the groups are over.
export function FinalGroupTable({data,focusTeam=''}){
 return <TableView data={data} id="tn-group-final" title="Finālgrupa" table={finalGroupStandings(contextOf(data))} focusTeam={focusTeam}/>;
}
function TableView({data,id,title,table,focusTeam,zones={}}){
 const sport=sportOf(data.sport);
 const {rows,complete}=table;
 const sets=sport.rank==='sets';
 const draws=sport.draw;
 const primary=sport.rank==='wins'?'U':'P';
 return <section className="tn-table" aria-labelledby={id}>
  <h3 id={id}>{title}{complete&&<small>Noslēgta</small>}</h3>
  <table>
   <thead><tr><th scope="col" className="tn-pos">#</th><th scope="col" className="tn-team">Komanda</th><th scope="col" title="Spēles">S</th><th scope="col" title="Uzvaras">U</th>{draws&&<th scope="col" title="Neizšķirti">N</th>}<th scope="col" title="Zaudējumi">Z</th><th scope="col" title={sets?'Seti':'Gūti un zaudēti'}>{sets?'Seti':'G:Z'}</th>{sport.rank!=='wins'&&<th scope="col" title="Punkti" className="tn-points">P</th>}</tr></thead>
   <tbody>{rows.map((r,i)=><tr key={r.ref} className={(r.key&&focusTeam===r.key?'is-mine':'')+(zones[i+1]?' is-through':'')}>
    <td className="tn-pos">{i+1}</td><th scope="row" className="tn-team">{r.name}</th><td>{r.gp}</td><td className={primary==='U'?'tn-points':''}>{r.w}</td>{draws&&<td>{r.d}</td>}<td>{r.l}</td><td className="tn-ratio">{r.f}:{r.a}</td>{sport.rank!=='wins'&&<td className="tn-points">{r.p}</td>}
   </tr>)}</tbody>
  </table>
  {Object.keys(zones).length>0&&<p className="tn-zone-note"><span aria-hidden="true"/>{zoneText(zones)}</p>}
 </section>;
}
function zoneText(zones){
 const byName={};for(const [k,name] of Object.entries(zones))(byName[name]=byName[name]||[]).push(Number(k));
 return Object.entries(byName).map(([name,list])=>(list.length>1?Math.min(...list)+'.–'+Math.max(...list)+'. vieta':list[0]+'. vieta')+' turpina '+name).join('; ');
}
export function GroupTables({data,focusTeam=''}){
 const groups=Object.keys(groupsOf(data.teams||[]));
 if(!groups.length)return <p className="tn-empty">Šim turnīram nav grupu.</p>;
 const final=(data.games||[]).some(g=>g.stage==='final');
 return <div className="tn-tables">
  {final&&<FinalGroupTable data={data} focusTeam={focusTeam}/>}
  {groups.map(g=><GroupTable key={g} data={data} group={g} focusTeam={focusTeam}/>)}
 </div>;
}

// Final places as far as they are decided.
export function Places({data,focusTeam=''}){
 const ctx=contextOf(data);
 const places=finalPlaces(ctx,data.format);
 const count=data.format==='knockout'?Math.max(places.length,ctx.games.some(g=>g.place===3)?4:2):Math.max(places.length,ctx.teams.length);
 if(!places.some(Boolean))return <p className="tn-empty">Vietas būs zināmas pēc spēlēm par vietām.</p>;
 return <ol className="tn-places">{Array.from({length:count},(_,i)=>places[i]).map((team,i)=><li key={i} className={(i<3?'tn-medal tn-medal-'+(i+1):'')+(team&&team.key===focusTeam?' is-mine':'')}>
  <span className="tn-place-no">{i+1}.</span><span>{team?team.name:<em>vēl nav zināms</em>}</span>
 </li>)}</ol>;
}

export function formatName(format){return FORMATS[format]?.name||'';}

// A4 sheets of a tournament for printing: a QR poster for the results page,
// the whole schedule, one sheet per court for the court secretary, and the groups.
import {dayPlan,groupsOf,hasScore,refLabel,sideName,sportOf,toMin} from '../../lib/tournament.js';
import {qrPath} from '../../lib/qr-path.js';
import {contextOf,formatName,playDateLabel,stageLabel} from './tournament-views.jsx';

export function sheetChoices(data){
 const courts=[...new Set((data.games||[]).map(g=>g.court).filter(Boolean))];
 return [['visas','Visas lapas'],['qr','QR plakāts'],['grafiks','Viss grafiks'],...(courts.length>1?[['laukumi','Visi laukumi']]:[]),...courts.map(c=>['laukums-'+c,'Laukums '+c]),...(Object.keys(groupsOf(data.teams||[])).length?[['grupas','Grupas']]:[])];
}

function SheetHead({data,title}){
 const when=playDateLabel(data.play_date);
 return <header className="tn-sheet-head">
  <div><p>{sportOf(data.sport).name}{when?' · '+when:''}{data.venue?' · '+data.venue:''}</p><h1>{data.title}</h1></div>
  {title&&<strong className="tn-sheet-tag">{title}</strong>}
 </header>;
}
function SheetFoot({link}){
 return <div className="tn-sheet-foot"><span>Rezultāti tiešsaistē: {link.replace(/^https?:\/\//,'')}</span><span className="tn-sheet-brand">meets<span>.</span>lv</span></div>;
}

export function QrPoster({data,link,qr}){
 const when=playDateLabel(data.play_date);
 return <section className="tn-sheet tn-sheet-poster" aria-label="QR plakāts">
  <p className="tn-poster-sport">{sportOf(data.sport).name}</p>
  <h1>{data.title}</h1>
  <p className="tn-poster-meta">{[when,data.venue].filter(Boolean).join(' · ')}</p>
  <svg className="tn-poster-qr" viewBox={`-4 -4 ${qr.size+8} ${qr.size+8}`} role="img" aria-label="QR kods uz rezultātu lapu" shapeRendering="crispEdges">
   <rect x="-4" y="-4" width={qr.size+8} height={qr.size+8} fill="#fff"/><path d={qr.d} fill="#1b2430"/>
  </svg>
  <p className="tn-poster-call">Grafiks, rezultāti un tabulas</p>
  <p className="tn-poster-hint">Noskenē ar tālruņa kameru. Lapa atjaunojas pati.</p>
  <p className="tn-poster-link">{link.replace(/^https?:\/\//,'')}</p>
  <p className="tn-sheet-brand tn-poster-brand">meets<span>.</span>lv</p>
 </section>;
}

// Times down, courts across — the overview the organizer hangs on the wall.
// The same rows as the day plan (breaks and the pause after the groups
// included, empty times left out). More than four courts go in even tables
// (6 → 3+3); a long table starts on its own page so its heading never stays
// alone at the bottom, and every printed page repeats what it is.
const COURTS_PER_TABLE=4,ROWS_ON_ONE_PAGE=12;
function courtChunks(courts){
 const count=Math.ceil(courts.length/COURTS_PER_TABLE)||1,size=Math.ceil(courts.length/count);
 const out=[];for(let i=0;i<courts.length;i+=size)out.push(courts.slice(i,i+size));
 return out.length?out:[[]];
}
// A thead row shown only on paper: the browser repeats it on every page a table runs over.
function RepeatRow({span,label,title}){
 return <tr className="tn-repeat"><th colSpan={span} scope="colgroup"><span>{label}</span><span>{title}</span></th></tr>;
}
export function ScheduleSheet({data,link,showScores=false}){
 const ctx=contextOf(data);
 const courts=[...new Set(ctx.games.map(g=>g.court).filter(Boolean))];
 const plan=dayPlan(ctx.games,{...(data.settings||{}),courts},{extra:0});
 const rows=plan.rows.filter(r=>r.kind!=='slot'||r.cells.some(c=>c.game));
 const side=ref=>refLabel(ref,ctx.teams);
 const chunks=courtChunks(courts);
 const split=chunks.length>1;
 const ownPages=split&&rows.length*chunks.length>ROWS_ON_ONE_PAGE;
 return <section className="tn-sheet" aria-label="Spēļu grafiks">
  <SheetHead data={data} title="Spēļu grafiks"/>
  {chunks.map((list,ci)=>{const range=list.length>1?'Laukumi '+list[0]+'–'+list[list.length-1]:'Laukums '+(list[0]||'');return <table className={'tn-grid'+(ci>0?(ownPages?' is-new-page':' is-whole'):'')} key={ci}>
   {split&&<caption>{range}</caption>}
   <thead>
    <RepeatRow span={list.length+1} label={'Spēļu grafiks'+(split?' · '+range:'')} title={data.title}/>
    <tr><th scope="col">Laiks</th>{list.map(c=><th key={c} scope="col">Laukums {c}</th>)}</tr>
   </thead>
   <tbody>{rows.map((row,i)=>row.kind!=='slot'?<tr key={'b'+i} className={'tn-grid-block'+(row.kind==='pause'?' is-pause':'')}><th scope="row">{row.time}</th><td colSpan={list.length}>{row.title} · {row.time}–{row.until}</td></tr>
    :<tr key={row.time}><th scope="row">{row.time}</th>{list.map(c=>{const g=row.cells.find(x=>x.court===c)?.game;return <td key={c}>{g&&<>
     <small>Nr. {g.no} · {stageLabel(g)}</small>
     <span>{side(g.home)}</span><span>{side(g.away)}</span>
     {showScores&&hasScore(g)&&<b>{g.home_score}:{g.away_score}</b>}
    </>}</td>;})}</tr>)}</tbody>
  </table>;})}
  <SheetFoot link={link}/>
 </section>;
}

// The court secretary writes results here; known teams are printed by name.
// scorerLink (organizer print only): the court's results link as a QR code for the secretary.
export function CourtSheet({data,court,link,showScores=false,scorerLink=''}){
 const ctx=contextOf(data);
 const games=ctx.games.filter(g=>g.court===court).sort((a,b)=>(toMin(a.starts_at)??0)-(toMin(b.starts_at)??0));
 const sport=sportOf(data.sport);
 return <section className="tn-sheet" aria-label={'Laukums '+court}>
  <SheetHead data={data} title={'Laukums '+court}/>
  <table className="tn-court">
   <thead>
    <RepeatRow span={sport.overtime?7:6} label={'Laukums '+court} title={data.title}/>
    <tr><th scope="col">Nr.</th><th scope="col">Laiks</th><th scope="col">Spēle</th><th scope="col" className="tn-court-team">Komanda</th><th scope="col" className="tn-court-score">{sport.unit}</th><th scope="col" className="tn-court-team">Komanda</th>{sport.overtime&&<th scope="col">Pl.</th>}</tr>
   </thead>
   <tbody>{games.map(g=>{const h=sideName(g.home,ctx),a=sideName(g.away,ctx);const filled=showScores&&hasScore(g);return <tr key={g.no}>
    <td>{g.no}</td><td>{g.starts_at}</td><td className="tn-court-stage">{stageLabel(g)}</td>
    <td className={'tn-court-team'+(h.known?'':' is-open')}>{h.name}</td>
    <td className="tn-court-score"><span>{filled?g.home_score:''}</span>:<span>{filled?g.away_score:''}</span></td>
    <td className={'tn-court-team'+(a.known?'':' is-open')}>{a.name}</td>{sport.overtime&&<td className="tn-court-box"/>}
   </tr>;})}</tbody>
  </table>
  {scorerLink?<div className="tn-court-scorer">
   <ScorerQr link={scorerLink}/>
   <div><strong>Rezultātu ievade laukumam {court}</strong><span>Sekretārs noskenē ar tālruni un ievada rezultātus uzreiz turnīra lapā. Šo kodu nerādi skatītājiem.</span>
    <p className="tn-court-sign">Laukuma sekretārs: ______________________ &nbsp; Paraksts: ____________</p></div>
  </div>:<p className="tn-court-sign">Laukuma sekretārs: ______________________ &nbsp; Paraksts: ____________</p>}
  <SheetFoot link={link}/>
 </section>;
}

// Groups with a blank cross table, as on a paper tournament sheet. Two groups
// side by side (one per row when a group has more than six teams); the rows sit
// in a layout table so a printed page that runs over still says what it is.
function CrossTable({name,list}){
 return <table className="tn-cross">
  <caption>{name} grupa</caption>
  <thead><tr><th scope="col">Komanda</th>{list.map((t,i)=><th key={t.key} scope="col">{i+1}</th>)}<th scope="col">U</th><th scope="col">Vieta</th></tr></thead>
  <tbody>{list.map((t,i)=><tr key={t.key}><th scope="row"><span>{i+1}. {t.name}</span>{t.coach&&<small>{t.coach}</small>}</th>{list.map((o,j)=><td key={o.key} className={i===j?'tn-cross-self':''}/>)}<td/><td/></tr>)}</tbody>
 </table>;
}
export function GroupsSheet({data,link}){
 const groups=Object.entries(groupsOf(data.teams||[]));
 const perRow=groups.every(([,list])=>list.length<=6)?2:1;
 const rows=[];for(let i=0;i<groups.length;i+=perRow)rows.push(groups.slice(i,i+perRow));
 return <section className="tn-sheet" aria-label="Grupas">
  <SheetHead data={data} title="Grupas"/>
  <table className={'tn-groups-print'+(perRow===1?' is-wide':'')} role="presentation">
   <thead><tr className="tn-repeat"><td colSpan={perRow}><span>Grupas</span><span>{data.title}</span></td></tr></thead>
   <tbody>{rows.map((row,i)=><tr key={i}>{row.map(([key,list])=><td key={key}><CrossTable name={key} list={list}/></td>)}{row.length<perRow&&<td/>}</tr>)}</tbody>
  </table>
  <p className="tn-rules">{formatName(data.format)}. {sportOf(data.sport).rules}</p>
  <SheetFoot link={link}/>
 </section>;
}

function ScorerQr({link}){
 const qr=qrPath(link);
 return <svg className="tn-court-qr" viewBox={`-4 -4 ${qr.size+8} ${qr.size+8}`} role="img" aria-label="QR kods rezultātu ievadei" shapeRendering="crispEdges">
  <rect x="-4" y="-4" width={qr.size+8} height={qr.size+8} fill="#fff"/><path d={qr.d} fill="#1b2430"/>
 </svg>;
}
// scorers: {court: results link} — given only in the organizer's print view.
export function PrintSheets({data,link,qr,choice='visas',showScores=false,scorers={}}){
 const courts=[...new Set((data.games||[]).map(g=>g.court).filter(Boolean))];
 const all=choice==='visas';
 const court=choice.startsWith('laukums-')?choice.slice(8):'';
 return <>
  {(all||choice==='qr')&&<QrPoster data={data} link={link} qr={qr}/>}
  {(all||choice==='grafiks')&&<ScheduleSheet data={data} link={link} showScores={showScores}/>}
  {courts.filter(c=>all||choice==='laukumi'||c===court).map(c=><CourtSheet key={c} data={data} court={c} link={link} showScores={showScores} scorerLink={scorers[c]||scorers['*']||''}/>)}
  {(all||choice==='grupas')&&Object.keys(groupsOf(data.teams||[])).length>0&&<GroupsSheet data={data} link={link}/>}
 </>;
}

'use client';
import {refLabel} from '../../lib/tournament.js';
import {stageLabel} from '../turniri/tournament-views.jsx';

// How a reference reads in the plan: the team, "Uzv. 12" or "B gr. 3. vieta".
export function sideText(ref,ctx){
 const m=/^([WL]):(\d+)$/.exec(ref);
 return m?(m[1]==='W'?'Uzv. ':'Zaud. ')+m[2]:refLabel(ref,ctx.teams);
}
function impactText(minutes){
 if(minutes===undefined||minutes===null)return '';
 return minutes>0?'dienas beigas +'+minutes+' min':'beigas nemaina';
}

// The day: times down, courts across, breaks across all courts. With onCell the
// cells are buttons: pick a game, then another game (swap) or a free place (move).
export default function DayPlan({plan,courts,ctx,picked=null,onCell=null,impacts={}}){
 const interactive=Boolean(onCell);
 return <div className="tn-day" style={{'--courts':Math.max(1,courts.length)}}>
  <div className="tn-day-row tn-day-head" aria-hidden="true"><span>Laiks</span>{courts.map(c=><span key={c}>Laukums {c}</span>)}</div>
  {plan.rows.map((row,i)=>row.kind==='slot'?<div className="tn-day-row" key={'s'+row.at}>
   <strong className="tn-day-time">{row.time}</strong>
   {row.cells.map(cell=>{
    const g=cell.game,isPicked=Boolean(g&&picked===g.no);
    const cls='tn-day-cell'+(g?' tn-stage-'+g.stage:' is-free')+(isPicked?' is-picked':'')+(picked&&!g?' is-target':'');
    const body=g?<><small>{g.no} · {stageLabel(g)}</small><b>{sideText(g.home,ctx)}</b><b>{sideText(g.away,ctx)}</b></>
     :<span className="tn-day-free">{picked?'Pārvietot šeit':''}</span>;
    if(!interactive)return <span key={cell.court} className={cls}>{body}</span>;
    const label=row.time+', laukums '+cell.court+': '+(g?'spēle '+g.no+', '+sideText(g.home,ctx)+' – '+sideText(g.away,ctx):'brīvs');
    return <button type="button" key={cell.court} className={cls} aria-pressed={g?isPicked:undefined} aria-label={label} disabled={!g&&!picked} onClick={()=>onCell(row.time,cell.court,g)}>{body}</button>;
   })}
  </div>:<div className={'tn-day-row tn-day-break'+(row.kind==='pause'?' is-pause':'')} key={'b'+i}>
   <strong className="tn-day-time">{row.time}</strong>
   <span className="tn-day-break-cell"><b>{row.title}</b><span>{row.time}–{row.until}</span>{impactText(row.kind==='pause'?impacts.pause:impacts[row.index])&&<em>{impactText(row.kind==='pause'?impacts.pause:impacts[row.index])}</em>}</span>
  </div>)}
  <div className="tn-day-row tn-day-end"><strong className="tn-day-time">{plan.end}</strong><span className="tn-day-end-cell">Pēdējā spēle beidzas</span></div>
 </div>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {rangeIndexes,rangeLabel,dayLabel} from '../../lib/day-histogram.js';

// Events per day for the coming weeks, with the chosen stretch of days framed. Drag the frame's
// edges (or across the bars) to choose other days; the arrow keys move an edge by a day.
export default function DayHistogram({bars,from,to,count,onRange,quick,period,onQuick,stacked=false}){
 const box=useRef(null),drag=useRef(null);
 const [live,setLive]=useState(null);
 const chosen=live||rangeIndexes(bars,from,to);
 useEffect(()=>{if(!drag.current)setLive(null);},[from,to]);
 const max=Math.max(1,...bars.map(b=>b.count));
 const n=bars.length;
 if(!n)return null;
 function indexAt(x){const r=box.current.getBoundingClientRect();return Math.max(0,Math.min(n-1,Math.floor((x-r.left)/r.width*n)));}
 function commit(sel){onRange(bars[sel.a].date,bars[sel.b].date);}
 function down(e){
  if(e.button>0)return;
  const i=indexAt(e.clientX),edge=e.target.dataset?.edge;
  const anchor=edge==='a'?chosen.b:edge==='b'?chosen.a:i;
  drag.current={anchor};
  const sel=anchor<=i?{a:anchor,b:i}:{a:i,b:anchor};
  setLive(sel);
  box.current.setPointerCapture?.(e.pointerId);
  e.preventDefault();
 }
 function move(e){
  if(!drag.current)return;
  const i=indexAt(e.clientX),anchor=drag.current.anchor;
  setLive(anchor<=i?{a:anchor,b:i}:{a:i,b:anchor});
 }
 function up(){
  if(!drag.current)return;
  drag.current=null;
  if(live)commit(live);
 }
 function key(edge,e){
  const step=e.key==='ArrowRight'||e.key==='ArrowUp'?1:e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:0;
  if(!step)return;
  e.preventDefault();
  const sel={...chosen};
  sel[edge]=Math.max(0,Math.min(n-1,sel[edge]+step));
  if(sel.a>sel.b)return;
  commit(sel);
 }
 const left=chosen.a/n*100,width=(chosen.b-chosen.a+1)/n*100;
 const ticks=bars.map((b,i)=>i%7===0?{i,label:i===0?'Šodien':dayLabel(b.date)}:null).filter(Boolean);
 return <section className={'mhist'+(stacked?' stacked':'')} aria-label="Pasākumi pa dienām">
  <div className="mhist-head">
   <strong>{stacked?'Kad':'Pasākumi pa dienām · nākamās '+n+' dienas'}</strong>
   <span>Velc rāmja malas vai pāri stabiņiem</span>
  </div>
  <div className="mhist-body">
   <div className="mhist-chart">
    <div className="mhist-bars" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
     {bars.map((b,i)=><i key={b.date} className={(i>=chosen.a&&i<=chosen.b?'in':'')+(b.weekend?' we':'')}
      style={{height:Math.round(b.count/max*100)+'%'}} title={dayLabel(b.date)+': '+b.count}/>)}
     <span className="mhist-frame" style={{left:left+'%',width:width+'%'}} aria-hidden="true"/>
     <span className="mhist-edge" data-edge="a" style={{left:left+'%'}} role="slider" tabIndex={0} aria-label="Pirmā diena"
      aria-valuemin={0} aria-valuemax={n-1} aria-valuenow={chosen.a} aria-valuetext={dayLabel(bars[chosen.a].date)} onKeyDown={e=>key('a',e)}/>
     <span className="mhist-edge" data-edge="b" style={{left:(left+width)+'%'}} role="slider" tabIndex={0} aria-label="Pēdējā diena"
      aria-valuemin={0} aria-valuemax={n-1} aria-valuenow={chosen.b} aria-valuetext={dayLabel(bars[chosen.b].date)} onKeyDown={e=>key('b',e)}/>
    </div>
    <div className="mhist-ticks" aria-hidden="true">{ticks.map(t=><span key={t.i} style={{left:(t.i+0.5)/n*100+'%'}}>{t.label}</span>)}</div>
   </div>
   <div className="mhist-side">
    <span className="mhist-range">{rangeLabel(bars[chosen.a].date,bars[chosen.b].date)}<b>{count}</b></span>
    <div className="mhist-quick" role="group" aria-label="Ātrā izvēle">
     {quick.map(q=><button key={q.key} type="button" aria-pressed={period===q.key} className={period===q.key?'on':''} onClick={()=>onQuick(q.key)}>{q.label}</button>)}
    </div>
   </div>
  </div>
 </section>;
}

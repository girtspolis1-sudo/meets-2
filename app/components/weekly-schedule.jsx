'use client';
import {countOccurrences} from '../../lib/event-schedule.js';
const WEEK=['Pirmdiena','Otrdiena','Trešdiena','Ceturtdiena','Piektdiena','Sestdiena','Svētdiena'];
export default function WeeklySchedule({slots=[],onChange,dateFrom,dateTo}){
 function add(day){if(slots.length>=14)return;onChange([...slots,{weekday:day,start:'17:00',end:'18:00'}]);}
 function change(index,key,value){onChange(slots.map((s,i)=>i===index?{...s,[key]:value}:s));}
 function del(index){onChange(slots.filter((_,i)=>i!==index));}
 let count=null;
 if(dateFrom&&dateTo&&slots.length){try{count=countOccurrences(dateFrom,dateTo,slots);}catch{count=null;}}
 return <section className="quick-weekly-schedule">
  <h3>Kurās dienās notiks pasākums?</h3>
  <p className="quick-flow-note">Atzīmē dienas. Katrai dienai vari noteikt atšķirīgus laikus un vairākas nodarbības.</p>
  {WEEK.map((name,j)=>{const day=j+1;const listed=slots.map((x,i)=>({...x,i})).filter(x=>x.weekday===day);return <div className="quick-weekday" key={day}>
   <div className="quick-weekday-head"><strong>{name}</strong><button type="button" className="button" disabled={slots.length>=14} onClick={()=>add(day)}>+ Laiks</button></div>
   {listed.map(({start,end,i})=><div className="quick-week-time" key={i}>
     <label>No<input type="time" value={start} onChange={e=>change(i,'start',e.target.value)}/></label>
     <label>Līdz<input type="time" value={end} onChange={e=>change(i,'end',e.target.value)}/></label>
     <button type="button" aria-label={'Dzēst '+name+' laiku'} className="button" onClick={()=>del(i)}>×</button>
    </div>)}
  </div>;})}
  {count!=null&&<p className="quick-flow-note"><strong>Plānotas {count} norises reizes.</strong> Katra apstiprinātā norise tiks rādīta kartē atsevišķi.</p>}
 </section>;
}

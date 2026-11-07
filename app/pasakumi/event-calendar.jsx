'use client';
import {useEffect,useMemo,useState} from 'react';
import DiscoveryEventCard from '../components/discovery-event-card.jsx';
import {CALENDAR_ROWS,addDays,calendarCounts,dayRange,heatStep,matchesCalendarChoice} from '../../lib/event-calendar.js';
import {compareForList} from '../../lib/catalog-list.js';
import {dateRangeLabel} from '../../lib/shared-event.js';

const WD=['Sv','Pr','Ot','Tr','Ce','Pk','Se'];
const PAGE=24;
const dayLong=new Intl.DateTimeFormat('lv',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'});
const longLabel=day=>{const text=dayLong.format(new Date(day+'T12:00:00Z'));return text.charAt(0).toUpperCase()+text.slice(1);};
const countWord=n=>n%10===1&&n%100!==11?'pasākums':'pasākumi';
const ROW=Object.fromEntries(CALENDAR_ROWS.map(row=>[row.key,row]));

// A week on a phone, two weeks on a wider screen.
function useSpan(){
 const [span,setSpan]=useState(7);
 useEffect(()=>{
  const query=window.matchMedia('(min-width: 900px)');
  const update=()=>setSpan(query.matches?14:7);
  update();query.addEventListener('change',update);
  return()=>query.removeEventListener('change',update);
 },[]);
 return span;
}

// Topics down, days across. A day, a topic or one cell is the filter for the
// list under the table; choosing it again clears it.
export default function EventCalendar({events,longCount=0,today,onOpen,onShowLong}){
 const span=useSpan();
 const [start,setStart]=useState(today);
 const [choice,setChoice]=useState({day:today,row:''});
 const [shown,setShown]=useState(PAGE);
 useEffect(()=>{setStart(today);},[today]);
 const days=useMemo(()=>dayRange(start,span),[start,span]);
 const range={from:days[0],to:days[days.length-1]};
 const {counts,totals}=useMemo(()=>calendarCounts(events,days),[events,days]);
 const rowTotals=useMemo(()=>Object.fromEntries(CALENDAR_ROWS.map(({key})=>[key,days.reduce((sum,day)=>sum+(counts[day][key]||0),0)])),[counts,days]);
 const chosen=useMemo(()=>events.filter(event=>matchesCalendarChoice(event,choice,range))
  .sort((a,b)=>compareForList(a,b,choice.day||range.from)),[events,choice,range.from,range.to]);
 useEffect(()=>{setShown(PAGE);},[choice,start,span]);

 function move(weeks){
  const next=addDays(start,weeks*span);
  const from=next<today?today:next;
  setStart(from);
  const to=addDays(from,span-1);
  setChoice(current=>({row:current.row,day:current.day&&current.day>=from&&current.day<=to?current.day:''}));
 }
 const pick=(day,row)=>setChoice(current=>{
  if(day&&row)return current.day===day&&current.row===row?{day,row:''}:{day,row};
  if(day)return current.day===day&&!current.row?{day:'',row:''}:{day,row:''};
  return current.row===row&&!current.day?{day:'',row:''}:{day:'',row};
 });

 const rangeText=dateRangeLabel(range.from,range.to);
 const title=[choice.day?longLabel(choice.day):rangeText,choice.row?ROW[choice.row].label:''].filter(Boolean).join(' · ');
 const weekend=day=>[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());
 const cls=(day,row)=>[choice.day===day?'is-day':'',choice.row===row?'is-row':'',choice.day===day&&choice.row===row?'is-cell':''].filter(Boolean).join(' ');

 return <section className="event-calendar" aria-label="Pasākumu kalendārs pa tēmām">
  <div className="event-calendar-nav">
   <button type="button" className="event-calendar-step" onClick={()=>move(-1)} disabled={start<=today} aria-label={span===14?'Iepriekšējās divas nedēļas':'Iepriekšējā nedēļa'}>←</button>
   <strong>{rangeText}</strong>
   {start!==today&&<button type="button" className="text-button" onClick={()=>{setStart(today);setChoice(c=>({row:c.row,day:today}));}}>Šodien</button>}
   <button type="button" className="event-calendar-step" onClick={()=>move(1)} aria-label={span===14?'Nākamās divas nedēļas':'Nākamā nedēļa'}>→</button>
  </div>

  <div className="event-calendar-scroll">
   <div className="event-calendar-grid" style={{'--calendar-days':span}} role="group" aria-label={'Pasākumu skaits pa tēmām, '+rangeText}>
    <span className="event-calendar-corner" aria-hidden="true"/>
    {days.map(day=><button key={day} type="button" className={'event-calendar-day'+(weekend(day)?' is-weekend':'')+(day===today?' is-today':'')+(choice.day===day?' is-day':'')}
     aria-pressed={choice.day===day&&!choice.row} aria-label={longLabel(day)+': '+totals[day]+' '+countWord(totals[day])} onClick={()=>pick(day,'')}>
     <small>{WD[new Date(day+'T12:00:00Z').getUTCDay()]}</small><b>{Number(day.slice(8))}</b>
    </button>)}
    {span===14&&<span className="event-calendar-sum-head">Kopā</span>}

    {CALENDAR_ROWS.map(({key,label,short})=>[
     <button key={key} type="button" className={'event-calendar-row'+(choice.row===key?' is-row':'')} title={label}
      aria-pressed={choice.row===key&&!choice.day} aria-label={label+': '+rowTotals[key]+' '+countWord(rowTotals[key])+', '+rangeText} onClick={()=>pick('',key)}>
      <span className="event-calendar-short">{short}</span><span className="event-calendar-long-label">{label}</span>
     </button>,
     ...days.map(day=>{
      const n=counts[day][key]||0;
      return <button key={key+day} type="button" className={'event-calendar-cell heat-'+heatStep(n)+' '+cls(day,key)} disabled={!n}
       aria-pressed={choice.day===day&&choice.row===key} aria-label={longLabel(day)+', '+label+': '+n} onClick={()=>pick(day,key)}>{n||''}</button>;
     }),
     span===14&&<span key={key+'sum'} className="event-calendar-sum">{rowTotals[key]||''}</span>
    ])}

    <span className="event-calendar-row is-total">Kopā</span>
    {days.map(day=><button key={'t'+day} type="button" className={'event-calendar-total'+(choice.day===day?' is-day':'')} disabled={!totals[day]}
     aria-label={longLabel(day)+': visi '+totals[day]+' '+countWord(totals[day])} onClick={()=>pick(day,'')}>{totals[day]}</button>)}
    {span===14&&<span className="event-calendar-sum">{Object.values(totals).reduce((a,b)=>a+b,0)}</span>}
   </div>
  </div>
  <div className="event-calendar-scale" aria-hidden="true"><span>Mazāk</span><i className="heat-1"/><i className="heat-2"/><i className="heat-3"/><i className="heat-4"/><span>Vairāk</span></div>

  <div className="event-calendar-choice" aria-live="polite">
   <div>
    <h2>{title}</h2>
    <p>{chosen.length} {countWord(chosen.length)}{choice.day||choice.row?'':' šajā periodā'}</p>
   </div>
   {(choice.day||choice.row)&&<div className="event-calendar-chips">
    {choice.day&&<button type="button" onClick={()=>setChoice(c=>({...c,day:''}))} aria-label={'Noņemt dienu: '+longLabel(choice.day)}>{longLabel(choice.day)} <span aria-hidden="true">✕</span></button>}
    {choice.row&&<button type="button" onClick={()=>setChoice(c=>({...c,row:''}))} aria-label={'Noņemt tēmu: '+ROW[choice.row].label}>{ROW[choice.row].short} <span aria-hidden="true">✕</span></button>}
   </div>}
  </div>
  {longCount>0&&<button type="button" className="event-calendar-long" onClick={onShowLong}>+ {longCount} {longCount%10===1&&longCount%100!==11?'izstāde vai ilgstošs pasākums':'izstādes un ilgstoši pasākumi'} notiek visu laiku — skatīt sarakstā</button>}

  {chosen.length?<div className="catalog-card-grid meets-catalog-image-grid">{chosen.slice(0,shown).map(event=><DiscoveryEventCard key={event.id} event={event} onOpen={onOpen} actions/>)}</div>
   :<p className="event-calendar-empty">Šajā izvēlē pasākumu nav. Izvēlies citu dienu vai tēmu.</p>}
  {chosen.length>shown&&<div className="catalog-more">
   <button type="button" className="button" onClick={()=>setShown(n=>n+PAGE)}>Rādīt vēl {Math.min(PAGE,chosen.length-shown)}</button>
   <small>Rādīti {shown} no {chosen.length}</small>
  </div>}
 </section>;
}

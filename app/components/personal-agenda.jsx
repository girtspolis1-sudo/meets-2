'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ProfileIcon} from './profile-shell.jsx';
import {agendaEvents,agendaDay,isPastEvent,monthDays,occursOn} from '../../lib/personal-agenda.js';
import {rigaTodayIso,addIsoDays} from '../../lib/event-date.js';
import {cardLocation,cardPrice} from '../../lib/discovery-card.js';
import {timeLabel} from '../../lib/catalog.js';

const formatDate=value=>value?new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'Datums nav norādīts';
export default function PersonalAgenda({events=[],favorites=[],plans=[],onToggle,busy=false,loading=false,error='',initialStatus='all'}){
 const [now,setNow]=useState(()=>new Date()),[status,setStatus]=useState(initialStatus),[period,setPeriod]=useState('upcoming'),[date,setDate]=useState(''),[query,setQuery]=useState(''),[month,setMonth]=useState(()=>rigaTodayIso().slice(0,7)),[calendarOpen,setCalendarOpen]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 const today=rigaTodayIso(now),savedIds=new Set([...favorites,...plans]);
 const saved=events.filter(e=>savedIds.has(e.id));
 const filtered=agendaEvents(saved,{plans,status,period,query,now});
 const selected=date?filtered.filter(e=>occursOn(e,date)):filtered;
 const groups=new Map();for(const e of selected){const day=date||agendaDay(e,today);if(!groups.has(day))groups.set(day,[]);groups.get(day).push(e);}
 const days=useMemo(()=>monthDays(month),[month]);
 const dateHeading=day=>day===today?'Šodien · '+formatDate(day):day===addIsoDays(today,1)?'Rīt · '+formatDate(day):formatDate(day);
 function moveMonth(delta){const [y,m]=month.split('-').map(Number);setMonth(new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7));}
 const missing=[...savedIds].filter(id=>!events.some(e=>e.id===id)).length;
 return <section className="meets-agenda" aria-label="Mani pasākumi">
  <div className="meets-agenda-filters">
   <div className="meets-agenda-status" role="group" aria-label="Pasākumu atlase">
    <button aria-pressed={status==='all'} onClick={()=>setStatus('all')}>Saglabātie <span>{savedIds.size}</span></button>
    <button aria-pressed={status==='planned'} onClick={()=>setStatus('planned')}>Plānoju apmeklēt <span>{plans.length}</span></button>
   </div>
   <div className="meets-agenda-search"><input type="search" aria-label="Meklēt manos pasākumos" placeholder="Meklēt pasākumu vai vietu…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Pasākumu periods" value={period} onChange={e=>{setPeriod(e.target.value);setDate('');}}><option value="upcoming">Aktuālie</option><option value="past">Pagājušie</option></select></div>
  </div>
  <p className="meets-agenda-help">“Plānoju apmeklēt” ir tavs personīgais plāns — tas neaizstāj biļeti vai reģistrāciju.</p>
  <button className="meets-agenda-calendar-toggle" aria-expanded={calendarOpen} aria-controls="personal-mini-calendar" onClick={()=>setCalendarOpen(v=>!v)}><ProfileIcon name="calendar"/>{calendarOpen?'Paslēpt kalendāru':'Rādīt kalendāru'}</button>
  {error&&<p role="alert" className="meets-inline-error">{error}</p>}
  <div className="meets-agenda-layout">
   <div className="meets-agenda-results" aria-busy={loading}>
    <div className="meets-agenda-result-head"><h2>{period==='past'?'Pagājušie pasākumi':'Tavi tuvākie pasākumi'}</h2><span aria-live="polite">{selected.length} pasākumi</span></div>
    {date&&<button className="meets-agenda-date-reset" onClick={()=>setDate('')}>{formatDate(date)} · Rādīt visus datumus ×</button>}
    {loading&&!events.length?<p role="status">Ielādē pasākumus…</p>:selected.length?[...groups].map(([day,items])=><section className="meets-agenda-day-group" key={day}><h3>{dateHeading(day)}</h3><ul>{items.map(event=>{
     const planned=plans.includes(event.id),past=isPastEvent(event,now),cancelled=event.status==='cancelled';
     const range=event.date_to&&event.date_to!==event.date_from;
     return <li key={event.id} className={'meets-agenda-event'+(planned?' is-planned':'')}>
      <div className="meets-agenda-event-info"><p className="meets-agenda-time">{range?(event.date_from<=today&&event.date_to>=today?'Notiek līdz '+formatDate(event.date_to):formatDate(event.date_from)+'–'+formatDate(event.date_to)):timeLabel(event)==='Nav norādīts'?'Laiks nav norādīts':timeLabel(event)}</p>
       <Link className="meets-agenda-title" href={'/pasakumi?event='+encodeURIComponent(event.id)}>{event.title}</Link>
       <p className="meets-agenda-location" title={cardLocation(event)}><ProfileIcon name="pin" size={16}/><span>{cardLocation(event)}</span></p>
       <div className="meets-agenda-meta">{cardPrice(event)&&<span>{cardPrice(event)}</span>}{cancelled&&<strong className="meets-agenda-cancelled">Atcelts</strong>}{past&&<span>Noslēdzies</span>}{['recurring','selected_dates'].includes(event.schedule_type)&&range&&<span>Norises dienas pārbaudi pasākuma aprakstā</span>}</div>
      </div>
      <div className="meets-agenda-actions"><button className={'meets-agenda-plan'+(planned?' selected':'')} disabled={busy||(!planned&&(past||cancelled))} aria-pressed={planned} aria-label={(planned?'Atcelt plānu: ':'Plānoju apmeklēt: ')+event.title} onClick={()=>onToggle(event.id,'plan')}><ProfileIcon name="calendar" size={18}/>{planned?'Ieplānots':'Plānoju apmeklēt'}</button>
       <button className="meets-agenda-save" disabled={busy} aria-pressed="true" aria-label={'Noņemt no saglabātajiem'+(planned?' un plāna':'')+': '+event.title} title={planned?'Noņemt no saglabātajiem un plāna':'Noņemt no saglabātajiem'} onClick={()=>onToggle(event.id,'favorite')}><ProfileIcon name="heart" size={18}/><span>Saglabāts</span></button></div>
     </li>;
    })}</ul></section>):<div className="meets-agenda-empty"><ProfileIcon name="calendar" size={28}/><h3>{date?'Šajā dienā nav izvēlētu pasākumu':status==='planned'?'Vēl nav ieplānotu pasākumu':query?'Nav atbilstošu pasākumu':period==='past'?'Vēl nav pagājušu pasākumu':'Sāc ar pasākumu, kas tevi interesē'}</h3><p>{status==='planned'?'Pie saglabāta pasākuma izvēlies “Plānoju apmeklēt”.':'Saglabā interesējošos pasākumus ar sirsniņu.'}</p>{(date||query||status==='planned')&&<button onClick={()=>{setDate('');setQuery('');setStatus('all');}}>Rādīt visus saglabātos</button>}<Link href={'/karte'+(date?'?period=manual&from='+date+'&to='+date:'')}>Atrast pasākumus →</Link></div>}
    {!!missing&&!loading&&<p className="meets-agenda-help" role="status">{missing} saglabāto pasākumu dati pašlaik nav pieejami. Tavas izvēles ir saglabātas.</p>}
   </div>
   <aside id="personal-mini-calendar" className={'meets-agenda-calendar'+(calendarOpen?' is-open':'')} aria-label="Saglabāto pasākumu kalendārs">
    <div className="meets-agenda-month"><button aria-label="Iepriekšējais mēnesis" onClick={()=>moveMonth(-1)}>‹</button><h2>{new Intl.DateTimeFormat('lv-LV',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'))}</h2><button aria-label="Nākamais mēnesis" onClick={()=>moveMonth(1)}>›</button></div>
    <div className="meets-agenda-month-grid">{['P','O','T','C','Pk','S','Sv'].map(d=><span key={d} className="meets-agenda-weekday">{d}</span>)}{days.map(day=>{
     const dayEvents=filtered.filter(e=>occursOn(e,day)),hasPlan=dayEvents.some(e=>plans.includes(e.id));
     return <button key={day} className={[day.slice(0,7)!==month?'outside':'',day===today?'today':'',day===date?'chosen':''].join(' ')} aria-current={day===today?'date':undefined} aria-pressed={day===date} aria-label={formatDate(day)+': '+dayEvents.length+' pasākumi'+(hasPlan?', ir plānoti':'')} onClick={()=>{setDate(day===date?'':day);setMonth(day.slice(0,7));}}><span>{Number(day.slice(-2))}</span><span aria-hidden="true" className={'meets-agenda-marker'+(dayEvents.length?' visible':'')+(hasPlan?' planned':'')}/></button>;
    })}</div>
    <div className="meets-agenda-legend"><span><i/>Saglabāts</span><span><i className="planned"/>Ieplānots</span></div>
    <button className="meets-agenda-today" onClick={()=>{setMonth(today.slice(0,7));setDate('');}}>Šis mēnesis · visi datumi</button>
    <p className="meets-agenda-help">Izvēlies dienu, lai atlasītu pasākumus. Kalendārs ievēro izvēlētos filtrus.</p>
   </aside>
  </div>
 </section>;
}

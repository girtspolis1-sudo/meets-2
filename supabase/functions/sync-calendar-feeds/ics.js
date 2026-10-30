// iCalendar (.ics) feeds as MEETS events: one item per occurrence, dates and
// times in Riga. Recurring events (RRULE with DAILY/WEEKLY/MONTHLY/YEARLY,
// INTERVAL, COUNT, UNTIL, weekly BYDAY), EXDATE and RECURRENCE-ID overrides are
// expanded; cancelled events are left out. Shared by the edge function and tests.

const RIGA='Europe/Riga';
const WEEKDAYS=['SU','MO','TU','WE','TH','FR','SA'];
const MAX_OCCURRENCES=500;

function unescapeText(value){
 return String(value||'').replace(/\\([nN,;\\])/g,(_,c)=>c==='n'||c==='N'?'\n':c).trim();
}

// Lines with their parameters; folded lines (starting with a space) are joined first.
export function contentLines(text){
 return String(text||'').replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'').split('\n').filter(Boolean).map(line=>{
  const colon=line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const head=colon<0?line:line.slice(0,colon),value=colon<0?'':line.slice(colon+1);
  const [name,...params]=head.split(';');
  return {name:name.toUpperCase(),params:Object.fromEntries(params.map(p=>{
   const i=p.indexOf('=');return [p.slice(0,i).toUpperCase(),p.slice(i+1).replace(/^"|"$/g,'')];
  })),value};
 });
}

function pad(n){return String(n).padStart(2,'0');}
function isoDate(y,m,d){return y+'-'+pad(m)+'-'+pad(d);}
export function addDays(iso,days){
 const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}

// Wall-clock time in a time zone at a UTC instant.
function wallClock(date,tz){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
}
// The UTC instant of a wall-clock time in a time zone.
function zonedToUtc(y,mo,d,h,mi,s,tz){
 let guess=Date.UTC(y,mo-1,d,h,mi,s);
 for(let i=0;i<2;i++){
  const w=wallClock(new Date(guess),tz);
  const shown=Date.UTC(+w.date.slice(0,4),+w.date.slice(5,7)-1,+w.date.slice(8,10),+w.time.slice(0,2),+w.time.slice(3,5),s);
  guess+=Date.UTC(y,mo-1,d,h,mi,s)-shown;
 }
 return new Date(guess);
}
function validZone(tz){try{new Intl.DateTimeFormat('en',{timeZone:tz});return true;}catch{return false;}}

// DTSTART/DTEND as {date,time|null} in Riga; all-day values keep their date.
export function parseDateValue(value,params={}){
 const m=String(value||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
 if(!m)return null;
 const [,y,mo,d,h,mi,s,z]=m;
 if(h===undefined||params.VALUE==='DATE')return {date:isoDate(+y,+mo,+d),time:null,allDay:true};
 const tz=z?'UTC':(params.TZID&&validZone(params.TZID)?params.TZID:RIGA);
 if(tz===RIGA)return {date:isoDate(+y,+mo,+d),time:h+':'+mi,allDay:false};
 const utc=tz==='UTC'?new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,+(s||0))):zonedToUtc(+y,+mo,+d,+h,+mi,+(s||0),tz);
 return {...wallClock(utc,RIGA),allDay:false};
}

function parseRule(value){
 const rule=Object.fromEntries(String(value||'').split(';').map(p=>p.split('=')).filter(p=>p[0]).map(([k,v])=>[k.toUpperCase(),v]));
 return {freq:rule.FREQ,interval:Math.max(1,Number(rule.INTERVAL)||1),count:Number(rule.COUNT)||null,
  until:rule.UNTIL?parseDateValue(rule.UNTIL)?.date:null,
  byDay:(rule.BYDAY||'').split(',').map(x=>x.replace(/^[+-]?\d+/,'')).filter(x=>WEEKDAYS.includes(x))};
}
function addMonths(iso,n){
 const y=+iso.slice(0,4),m=+iso.slice(5,7)-1+n,d=+iso.slice(8,10);
 const date=new Date(Date.UTC(y,m,1,12));
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 return d>last?null:isoDate(date.getUTCFullYear(),date.getUTCMonth()+1,d);
}

// Start dates of a recurring event, in order, up to `to`.
export function expandDates(start,ruleValue,to){
 const rule=parseRule(ruleValue);
 if(!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(rule.freq))return [start];
 const last=rule.until&&rule.until<to?rule.until:to;
 const out=[];
 const take=date=>{if(date>=start&&date<=last&&out.length<MAX_OCCURRENCES&&(!rule.count||out.length<rule.count))out.push(date);};
 if(rule.freq==='WEEKLY'){
  const days=rule.byDay.length?rule.byDay:[WEEKDAYS[new Date(start+'T12:00:00Z').getUTCDay()]];
  const weekStart=addDays(start,-((new Date(start+'T12:00:00Z').getUTCDay()+6)%7));
  for(let week=weekStart;week<=last&&(!rule.count||out.length<rule.count)&&out.length<MAX_OCCURRENCES;week=addDays(week,7*rule.interval)){
   for(let i=0;i<7;i++){const day=addDays(week,i);if(days.includes(WEEKDAYS[new Date(day+'T12:00:00Z').getUTCDay()]))take(day);}
  }
  return out;
 }
 for(let i=0;out.length<MAX_OCCURRENCES&&(!rule.count||out.length<rule.count);i++){
  const date=rule.freq==='DAILY'?addDays(start,i*rule.interval)
   :rule.freq==='MONTHLY'?addMonths(start,i*rule.interval):addMonths(start,12*i*rule.interval);
  if(date===null)continue;
  if(date>last)break;
  take(date);
 }
 return out;
}

// VEVENT blocks as plain objects.
export function parseEvents(text){
 const events=[];let current=null;
 for(const line of contentLines(text)){
  if(line.name==='BEGIN'&&line.value.toUpperCase()==='VEVENT'){current={exdates:[]};continue;}
  if(line.name==='END'&&line.value.toUpperCase()==='VEVENT'){if(current)events.push(current);current=null;continue;}
  if(!current)continue;
  if(line.name==='EXDATE'){for(const v of line.value.split(','))current.exdates.push(parseDateValue(v,line.params)?.date);continue;}
  if(['DTSTART','DTEND','RECURRENCE-ID'].includes(line.name)){current[line.name]=parseDateValue(line.value,line.params);continue;}
  if(['SUMMARY','DESCRIPTION','LOCATION','CATEGORIES'].includes(line.name)){current[line.name]=unescapeText(line.value);continue;}
  current[line.name]=line.value.trim();
 }
 return events;
}

// One item per occurrence between `from` and `to` (YYYY-MM-DD, Riga).
export function occurrences(text,{from,to}){
 const events=parseEvents(text).filter(e=>e.DTSTART&&e.SUMMARY&&String(e.STATUS||'').toUpperCase()!=='CANCELLED');
 const overridden=new Set(events.filter(e=>e['RECURRENCE-ID']).map(e=>e.UID+'@'+e['RECURRENCE-ID'].date));
 const out=[];
 for(const e of events){
  const start=e.DTSTART;
  let end=e.DTEND||null;
  // An all-day DTEND is the day after the last day.
  const lengthDays=end?Math.max(0,Math.round((Date.parse(end.date)-Date.parse(start.date))/864e5)-(start.allDay?1:0)):0;
  const geo=String(e.GEO||'').split(/[;,]/).map(Number);
  const base={uid:e.UID||e.SUMMARY+'|'+start.date,title:e.SUMMARY,description:e.DESCRIPTION||'',location:e.LOCATION||'',
   url:e.URL||'',categories:(e.CATEGORIES||'').split(',').map(c=>c.trim()).filter(Boolean),
   geo:geo.length===2&&geo.every(Number.isFinite)?{latitude:geo[0],longitude:geo[1]}:null,
   allDay:start.allDay,timeFrom:start.time,timeTo:end&&!end.allDay&&lengthDays===0?end.time:null};
  const recurring=Boolean(e.RRULE)&&!e['RECURRENCE-ID'];
  const dates=recurring?expandDates(start.date,e.RRULE,to):[start.date];
  for(const date of dates){
   if(recurring&&(e.exdates.includes(date)||overridden.has(e.UID+'@'+date)))continue;
   const dateTo=addDays(date,lengthDays);
   if(dateTo<from||date>to)continue;
   const key=e['RECURRENCE-ID']?base.uid+'@'+e['RECURRENCE-ID'].date:recurring?base.uid+'@'+date:base.uid;
   out.push({...base,key,dateFrom:date,dateTo});
  }
 }
 return out.sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom)||String(a.timeFrom||'').localeCompare(String(b.timeFrom||'')));
}

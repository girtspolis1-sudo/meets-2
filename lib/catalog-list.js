// What the public event list shows and in which order: no events that are
// already over, today's events by start time, and long-running exhibitions or
// season calendars kept apart so they do not crowd out what happens today.

const LONG_RUNNING_DAYS=14;
// Without an end time, a single-day event counts as over this long after it starts.
const ASSUMED_LENGTH_MIN=180;

function minutes(time){
 const m=String(time||'').match(/^(\d{1,2}):(\d{2})/);
 return m?Number(m[1])*60+Number(m[2]):null;
}
function days(from,to){return Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/864e5);}
function lastDay(event){return String(event?.date_to||event?.date_from||'');}

export function isOver(event,today,clock){
 const end=lastDay(event);
 if(!end||end<today)return true;
 if(end>today||clock===null||clock===undefined)return false;
 const endTime=minutes(event.time_to);
 if(endTime!==null&&endTime>(minutes(event.time_from)??-1))return clock>=endTime;
 const start=minutes(event.time_from);
 return String(event.date_from)===today&&start!==null&&clock>=start+ASSUMED_LENGTH_MIN;
}

// Started before today and runs two weeks or longer: exhibitions, season programmes.
export function isLongRunning(event,today){
 const from=String(event?.date_from||''),to=lastDay(event);
 return Boolean(from)&&from<today&&days(from,to)>=LONG_RUNNING_DAYS;
}

// The day an event appears under: today for events already running.
export function listDay(event,today){
 const from=String(event?.date_from||'');
 return from<today?today:from;
}

// Day, then start time (events with a time first), then title.
export function compareForList(a,b,today){
 const day=listDay(a,today).localeCompare(listDay(b,today));
 if(day)return day;
 const ta=minutes(a.time_from),tb=minutes(b.time_from);
 if(ta!==tb)return ta===null?1:tb===null?-1:ta-tb;
 return String(a.title||'').localeCompare(String(b.title||''),'lv');
}

export function splitForList(events,today,clock){
 const current=[],longRunning=[];
 for(const event of Array.isArray(events)?events:[]){
  if(isOver(event,today,clock))continue;
  (isLongRunning(event,today)?longRunning:current).push(event);
 }
 current.sort((a,b)=>compareForList(a,b,today));
 longRunning.sort((a,b)=>lastDay(a).localeCompare(lastDay(b))||String(a.title||'').localeCompare(String(b.title||''),'lv'));
 return {current,longRunning};
}

// How long an event runs decides how it is shown:
//  short  – 1–3 days: concerts, games, a weekend festival. The main focus.
//  medium – 4–14 days: a festival week, a run of performances.
//  long   – over 14 days: exhibitions, season programmes. Kept in the background
//           while they run, brought forward on the opening day and in the last week.
export const SHORT_MAX_DAYS=3;
export const MEDIUM_MAX_DAYS=14;
export const LAST_DAYS=7;

const MONTHS_GEN=['janv.','febr.','marta','apr.','maija','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
const toDay=iso=>Date.parse(String(iso)+'T12:00:00Z');
const between=(a,b)=>Math.round((toDay(b)-toDay(a))/864e5);
const valid=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''));

function lastDay(event){return valid(event?.date_to)&&event.date_to>=event.date_from?event.date_to:event?.date_from;}

// Calendar days the event covers, counting both ends (a one-day event is 1).
export function spanDays(event){
 if(!valid(event?.date_from))return 1;
 return between(event.date_from,lastDay(event))+1;
}
export function durationKind(event){
 const n=spanDays(event);
 return n<=SHORT_MAX_DAYS?'short':n<=MEDIUM_MAX_DAYS?'medium':'long';
}
export function daysLeft(event,today){return valid(today)&&valid(lastDay(event))?between(today,lastDay(event)):null;}

// A multi-day event that starts today.
export function isOpeningDay(event,today){return durationKind(event)!=='short'&&event?.date_from===today;}
// A long event in its last week.
export function isLastDays(event,today){
 const left=daysLeft(event,today);
 return durationKind(event)==='long'&&String(event?.date_from||'')<today&&left!==null&&left>=0&&left<LAST_DAYS;
}
// A long event that is simply running: shown in the background, not counted with today's events.
export function isBackgroundLong(event,today){
 return durationKind(event)==='long'&&String(event?.date_from||'')<today&&!isLastDays(event,today);
}
// "7. janv."
export function longDate(iso){
 if(!valid(iso))return '';
 const d=new Date(toDay(iso));
 return d.getUTCDate()+'. '+MONTHS_GEN[d.getUTCMonth()];
}
// Short badge for a map pin: "līdz 7.01."
export function untilBadge(event){
 const end=lastDay(event);
 return valid(end)?'līdz '+Number(end.slice(8,10))+'.'+end.slice(5,7)+'.':'';
}

// Label for an event that is already running today, by its kind; '' when it has not started.
export function runningLabel(event,today){
 if(!valid(event?.date_from)||event.date_from>=today)return '';
 const kind=durationKind(event),left=daysLeft(event,today),end=longDate(lastDay(event));
 if(kind==='short')return 'Notiek šodien · '+(between(event.date_from,today)+1)+'. diena no '+spanDays(event);
 if(kind==='medium')return 'Notiek līdz '+end+(left>0?' · vēl '+left+' '+(left%10===1&&left%100!==11?'diena':'dienas'):' · pēdējā diena');
 if(isLastDays(event,today))return left===0?'Pēdējā diena!':'Pēdējās dienas · līdz '+end;
 return 'Apskatāms līdz '+end;
}

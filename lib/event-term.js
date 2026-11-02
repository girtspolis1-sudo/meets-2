// C3 term logic, used everywhere a date is coloured: map markers, legend,
// day headings and badges. Green = today, yellow = tomorrow, soft red = later.
import {eventDateState,rigaTodayIso} from './event-date.js';

export const TERM_TONES=['today','tomorrow','later'];
export const TERM_LABELS={today:'Šodien',tomorrow:'Rīt',later:'Vēlāk'};

// Whole days from today to the start; an event already running counts as 0.
export function daysUntil(event,today=rigaTodayIso()){
 const start=String(event?.date_from||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return null;
 if(start<=today)return 0;
 return Math.round((Date.parse(start+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5);
}

export function termTone(days){
 if(days==null)return 'later';
 return days<=0?'today':days===1?'tomorrow':'later';
}

// "0d", "1d", "7d" … and "30+" for a month or more.
export function daysBadge(days){
 if(days==null)return '—';
 return days>=30?'30+':Math.max(0,days)+'d';
}

// "Šodien (0 d)", "Rīt (1 d)", "Vēlāk (3 d)", "Vēlāk (30+ d)"
export function termLabel(days){
 const tone=termTone(days);
 const amount=days==null?'':' ('+(days>=30?'30+':Math.max(0,days))+' d)';
 return TERM_LABELS[tone]+amount;
}

// The tone of one event right now: running events that already ended today
// are 'ended', everything else follows the day count.
export function eventTerm(event,today=rigaTodayIso(),now=new Date()){
 const days=daysUntil(event,today);
 const ended=eventDateState(event,today,now).tone==='ended-today';
 return {days,tone:ended?'ended':termTone(days),badge:daysBadge(days),label:ended?'Šodien, beidzies':termLabel(days)};
}

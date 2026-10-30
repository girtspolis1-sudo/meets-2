import test from 'node:test';
import assert from 'node:assert/strict';
import {contentLines,expandDates,occurrences,parseDateValue} from '../supabase/functions/sync-calendar-feeds/ics.js';

const feed=events=>['BEGIN:VCALENDAR','VERSION:2.0',...events.flatMap(e=>['BEGIN:VEVENT',...e,'END:VEVENT']),'END:VCALENDAR'].join('\r\n');

test('folded lines are joined and text is unescaped',()=>{
 const lines=contentLines('SUMMARY:Koncerts\r\n  Rīgā\r\nLOCATION;LANGUAGE=lv:Kalēju iela 9\\, Rīga\r\n');
 assert.equal(lines[0].value,'Koncerts Rīgā');
 assert.deepEqual(lines[1].params,{LANGUAGE:'lv'});
 const [event]=occurrences(feed([['UID:a','DTSTART;VALUE=DATE:20261105','SUMMARY:Tirgus','LOCATION:Kalēju iela 9\\, Rīga','DESCRIPTION:Pirmā rinda\\nOtrā']]),{from:'2026-10-30',to:'2027-01-30'});
 assert.equal(event.location,'Kalēju iela 9, Rīga');
 assert.equal(event.description,'Pirmā rinda\nOtrā');
});

test('times are shown in Riga whatever zone the feed uses',()=>{
 assert.deepEqual(parseDateValue('20261105T170000Z'),{date:'2026-11-05',time:'19:00',allDay:false},'UTC in winter: +2');
 assert.deepEqual(parseDateValue('20260705T170000Z'),{date:'2026-07-05',time:'20:00',allDay:false},'UTC in summer: +3');
 assert.deepEqual(parseDateValue('20261105T180000',{TZID:'Europe/Berlin'}),{date:'2026-11-05',time:'19:00',allDay:false});
 assert.deepEqual(parseDateValue('20261105T180000',{TZID:'Europe/Riga'}),{date:'2026-11-05',time:'18:00',allDay:false});
 assert.deepEqual(parseDateValue('20261105T180000'),{date:'2026-11-05',time:'18:00',allDay:false},'floating time');
 assert.deepEqual(parseDateValue('20261105',{VALUE:'DATE'}),{date:'2026-11-05',time:null,allDay:true});
 assert.deepEqual(parseDateValue('20261231T230000Z'),{date:'2027-01-01',time:'01:00',allDay:false},'next day in Riga');
});

test('all-day and timed events get their dates and times',()=>{
 const items=occurrences(feed([
  ['UID:fair','DTSTART;VALUE=DATE:20261106','DTEND;VALUE=DATE:20261109','SUMMARY:Gadatirgus'],
  ['UID:talk','DTSTART:20261110T160000Z','DTEND:20261110T173000Z','SUMMARY:Lekcija'],
  ['UID:old','DTSTART:20261001T160000Z','SUMMARY:Pagājis'],
  ['UID:off','DTSTART:20261112T160000Z','SUMMARY:Atcelts','STATUS:CANCELLED']
 ]),{from:'2026-10-30',to:'2027-01-30'});
 assert.deepEqual(items.map(i=>[i.key,i.dateFrom,i.dateTo,i.timeFrom,i.timeTo]),[
  ['fair','2026-11-06','2026-11-08',null,null],
  ['talk','2026-11-10','2026-11-10','18:00','19:30']
 ]);
});

test('weekly rules expand with BYDAY, COUNT, EXDATE and overrides',()=>{
 assert.deepEqual(expandDates('2026-11-02','FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4','2027-01-30'),['2026-11-02','2026-11-04','2026-11-09','2026-11-11']);
 assert.deepEqual(expandDates('2026-11-02','FREQ=WEEKLY;INTERVAL=2;UNTIL=20261201T000000Z','2027-01-30'),['2026-11-02','2026-11-16','2026-11-30']);
 assert.deepEqual(expandDates('2026-01-31','FREQ=MONTHLY;COUNT=3','2027-01-30'),['2026-01-31','2026-03-31','2026-05-31'],'months without day 31 are skipped');
 const items=occurrences(feed([
  ['UID:yoga','DTSTART;TZID=Europe/Riga:20261102T180000','DTEND;TZID=Europe/Riga:20261102T190000','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE;TZID=Europe/Riga:20261109T180000','SUMMARY:Joga'],
  ['UID:yoga','RECURRENCE-ID;TZID=Europe/Riga:20261116T180000','DTSTART;TZID=Europe/Riga:20261117T190000','SUMMARY:Joga (pārcelta)']
 ]),{from:'2026-10-30',to:'2027-01-30'});
 assert.deepEqual(items.map(i=>[i.key,i.dateFrom,i.timeFrom]),[
  ['yoga@2026-11-02','2026-11-02','18:00'],
  ['yoga@2026-11-16','2026-11-17','19:00'],
  ['yoga@2026-11-23','2026-11-23','18:00']
 ]);
});

test('occurrences before the window are dropped, long runs stay',()=>{
 const items=occurrences(feed([['UID:daily','DTSTART:20261001T080000Z','RRULE:FREQ=DAILY','SUMMARY:Rīta skrējiens']]),{from:'2026-10-30',to:'2026-11-02'});
 assert.deepEqual(items.map(i=>i.dateFrom),['2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
});

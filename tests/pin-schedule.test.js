import test from 'node:test';
import assert from 'node:assert/strict';
import {dayTone,scheduleDots,scheduleDays,scheduleText} from '../lib/pin-schedule.js';

const today='2026-11-25';
const ev=(id,date_from,time_from='',date_to='')=>({id,date_from,time_from,date_to:date_to||date_from,title:'P'+id});

test('day tones follow the map legend', ()=>{
 assert.equal(dayTone(0),'today');
 assert.equal(dayTone(1),'tomorrow');
 assert.equal(dayTone(2),'soon');
 assert.equal(dayTone(15),'soon');
 assert.equal(dayTone(16),'far');
 assert.equal(dayTone(null),'far');
});

test('dots start from the soonest event, at most five, with the rest counted', ()=>{
 const events=[ev(1,'2026-12-20'),ev(2,'2026-11-27'),ev(3,'2026-11-25'),ev(4,'2026-11-26'),ev(5,'2026-12-01'),ev(6,'2027-01-03'),ev(7,'2026-12-12')];
 assert.deepEqual(scheduleDots(events,today),{dots:['today','tomorrow','soon','soon','far'],more:2});
 assert.deepEqual(scheduleDots([ev(1,'2026-11-27')],today),{dots:['soon'],more:0});
});

test('date strip: one chip per day, running events on today', ()=>{
 const days=scheduleDays([ev(1,'2026-11-27','18:00'),ev(2,'2026-11-27','12:00'),ev(3,'2026-11-01','','2026-12-31'),ev(4,'2026-12-12')],today);
 assert.deepEqual(days.map(d=>[d.date,d.day,d.month,d.tone,d.count,d.firstId]),[
  ['2026-11-25','25','NOV','today',1,3],
  ['2026-11-27','27','NOV','soon',2,2],
  ['2026-12-12','12','DEC','far',1,4]
 ]);
});

test('spoken summary by colour', ()=>{
 assert.equal(scheduleText([ev(1,'2026-11-27'),ev(2,'2026-11-28'),ev(3,'2027-01-10')],today),'2 2–15 d, 1 pēc 15 d');
});

import {occursOn,lastEventDay,weekDays,weekNav,weekTitle} from '../lib/pin-schedule.js';
test('week calendar starts today and stops at the last event of the place', ()=>{
 const events=[ev(1,'2026-11-26'),ev(2,'2026-11-28'),ev(3,'2026-11-01','','2026-12-31'),ev(4,'2026-12-09')];
 assert.ok(occursOn(events[2],'2026-11-26'));
 assert.ok(!occursOn(events[0],'2026-11-27'));
 assert.equal(lastEventDay(events,'2026-11-26'),'2026-12-09');
 const week=weekDays(events.slice(0,2),'2026-11-26');
 assert.deepEqual(week.map(d=>[d.dow,d.day,d.count]),[['C','26',1],['Pk','27',0],['S','28',1],['Sv','29',0],['P','30',0],['O','1',0],['T','2',0]]);
 assert.equal(week[0].tone,'today');
 assert.deepEqual(weekNav(events,'2026-11-26'),{prev:null,next:'2026-12-03'});
 assert.deepEqual(weekNav(events,'2026-11-26','2026-12-03'),{prev:'2026-11-26',next:null});
 assert.deepEqual(weekNav(events.slice(0,2),'2026-11-26'),{prev:null,next:null});
 assert.equal(weekDays(events,'2026-11-26','2026-11-01')[0].date,'2026-11-26');
 assert.equal(weekTitle(week),'26. nov. – 2. dec.');
});

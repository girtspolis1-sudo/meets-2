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

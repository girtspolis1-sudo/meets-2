import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSlots,countOccurrences,cleanPrice} from '../lib/event-schedule.js';
test('three weekly sessions over 14 days',()=>{
 const slots=[{weekday:1,start:'17:00',end:'18:30'},{weekday:3,start:'19:00',end:'20:30'},{weekday:5,start:'17:00',end:'18:30'}];
 assert.equal(countOccurrences('2026-10-26','2026-11-08',slots),6);
});
test('no duplicate slots or invalid cross-midnight',()=>{
 assert.throws(()=>cleanSlots([{weekday:8,start:'10:00',end:'11:00'}]));
 assert.throws(()=>cleanSlots([{weekday:1,start:'20:00',end:'19:00'}]));
 assert.throws(()=>cleanSlots([{weekday:1,start:'10:00',end:'11:00'},{weekday:1,start:'10:00',end:'12:00'}]));
});
test('recurring series bounded and must include occurrence',()=>{
 assert.throws(()=>countOccurrences('2026-10-26','2027-03-30',[{weekday:1,start:'10:00',end:'11:00'}]));
 assert.throws(()=>countOccurrences('2026-10-27','2026-10-27',[{weekday:1,start:'10:00',end:'11:00'}]));
});
test('free and paid prices',()=>{
 assert.deepEqual(cleanPrice('free',null,null),{price_min:0,price_max:0});
 assert.deepEqual(cleanPrice('paid','10.00','19.50'),{price_min:10,price_max:19.5});
 assert.throws(()=>cleanPrice('paid',12,10));
});

test('empty time fields open at 16:00, the end two hours later',async()=>{
 const {defaultEndTime,DEFAULT_START}=await import('../lib/event-schedule.js');
 assert.equal(DEFAULT_START,'16:00');
 assert.equal(defaultEndTime('16:00'),'18:00');
 assert.equal(defaultEndTime('09:30'),'11:30');
 assert.equal(defaultEndTime('23:00'),'23:59');
});

test('how an event takes place is read back from what was saved',async()=>{
 const {scheduleModeOf,nextDateAfter}=await import('../lib/event-schedule.js');
 assert.equal(scheduleModeOf({schedule_kind:'once',date_from:'2026-11-08'}),'single');
 assert.equal(scheduleModeOf({schedule_kind:'ongoing',date_from:'2026-11-08',date_to:'2026-11-10'}),'range');
 assert.equal(scheduleModeOf({schedule_kind:'recurring'}),'weekly');
 const run=['2026-11-08','2026-11-09','2026-11-10'].map(date=>({date,start:'16:00',end:'18:00'}));
 assert.equal(scheduleModeOf({schedule_kind:'dated',date_from:'2026-11-08',date_to:'2026-11-10',recurrence_slots:run}),'range');
 assert.equal(scheduleModeOf({schedule_kind:'dated',date_from:'2026-11-08',date_to:'2026-11-22',recurrence_slots:[run[0],{date:'2026-11-22',start:'16:00',end:'18:00'}]}),'dates');
 assert.equal(nextDateAfter([{date:'2026-11-08'},{date:'2026-11-12'}]),'2026-11-19');
});

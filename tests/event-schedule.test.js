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

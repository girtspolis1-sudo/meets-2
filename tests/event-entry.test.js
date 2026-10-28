import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENT_CATEGORIES,validateQuickEvent,validateQuickVenue,copyEventDraft,normalizeEventTime,QUICK_EVENT_EMPTY} from '../lib/event-entry.js';
const base={...QUICK_EVENT_EMPTY,title:'Sporta diena',date_from:'2026-11-13',time_from:'10:00',time_to:'12:00',venue_name:'Parks',address:'Mārupes parks'};
test('valid simple event uses map-compatible data',()=>assert.equal(validateQuickEvent(base),''));
test('invalid date and time rejected',()=>{
 assert.match(validateQuickEvent({...base,date_from:'2026-02-31'}),/datumu/);
 assert.match(validateQuickEvent({...base,time_to:'09:00'}),/beigu laikam/);
 assert.match(validateQuickEvent({...base,date_to:'2026-11-12'}),/Beigu datums/);
});
test('location requires verified description or point',()=>{
 assert.match(validateQuickEvent({...base,address:'',latitude:'',longitude:''}),/kartē/);
 assert.equal(validateQuickEvent({...base,address:'',latitude:56.89,longitude:24.06}),'');
});
test('copy retains venue and description but clears dates and identity',()=>{
 const out=copyEventDraft({...base,id:'private',status:'published',venue_id:'abc'});
 assert.equal(out.date_from,'');assert.equal(out.title,base.title);assert.equal(out.venue_id,'abc');
 assert.equal(out.id,undefined);assert.equal(out.status,undefined);
});
test('venue validation and categories',()=>{
 assert.equal(validateQuickVenue({name:'Skola',address:'Skolas iela 1'}),'');
 assert.match(validateQuickVenue({name:'Skola',address:''}),/adresi/);
 assert.equal(EVENT_CATEGORIES.includes('Teātris un kino'),true);
});

test('multi-day event accepts time values returned by PostgreSQL',()=>{
 const event={...base,date_from:'2026-10-29',date_to:'2026-10-30',time_from:'11:00:00',time_to:'15:00:00'};
 assert.equal(validateQuickEvent(event),'');
 assert.equal(validateQuickEvent({...event,time_from:'11:00',time_to:'15:00:00'}),'');
});
test('persisted event time precision is normalized for browser time inputs',()=>{
 assert.equal(normalizeEventTime('11:00:00'),'11:00');
 assert.equal(normalizeEventTime('15:00:00.000000'),'15:00');
 assert.equal(normalizeEventTime('11:00:30'),'11:00:30');
 assert.equal(normalizeEventTime('invalid'),'invalid');
});
test('one-day events still reject equal or reversed times in different formats',()=>{
 assert.match(validateQuickEvent({...base,time_from:'11:00:00',time_to:'11:00'}),/beigu laikam/);
 assert.match(validateQuickEvent({...base,time_from:'14:00',time_to:'11:00:00'}),/beigu laikam/);
 assert.equal(validateQuickEvent({...base,time_from:'11:00:00',time_to:'15:00'}),'');
 assert.match(validateQuickEvent({...base,time_from:'11:00:99'}),/derīgu sākuma/);
});

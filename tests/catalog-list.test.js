import test from 'node:test';
import assert from 'node:assert/strict';
import {compareForList,isLongRunning,isOver,splitForList} from '../lib/catalog-list.js';

const today='2026-10-31';
const at=(h,m=0)=>h*60+m;

test('events that are over are not listed',()=>{
 assert.equal(isOver({date_from:'2026-10-30'},today,at(9)),true,'yesterday');
 assert.equal(isOver({date_from:'2026-10-20',date_to:'2026-10-30'},today,at(9)),true,'ended yesterday');
 assert.equal(isOver({date_from:today,time_from:'10:00',time_to:'12:00'},today,at(12,1)),true,'ended at noon');
 assert.equal(isOver({date_from:today,time_from:'10:00',time_to:'12:00'},today,at(11)),false,'still on');
 assert.equal(isOver({date_from:today,time_from:'10:00'},today,at(13,30)),true,'no end time: over three hours after the start');
 assert.equal(isOver({date_from:today,time_from:'10:00'},today,at(12)),false);
 assert.equal(isOver({date_from:today},today,at(23)),false,'no times: the whole day');
 assert.equal(isOver({date_from:today,time_from:'22:00',time_to:'02:00'},today,at(23)),false,'ends after midnight');
 assert.equal(isOver({date_from:'2026-10-01',date_to:'2026-11-30',time_from:'10:00',time_to:'18:00'},today,at(19)),false,'runs on later days');
});

test('long exhibitions and season calendars are kept apart',()=>{
 assert.equal(isLongRunning({date_from:'2023-10-26',date_to:'2026-12-30'},today),true);
 assert.equal(isLongRunning({date_from:'2026-10-20',date_to:'2026-11-05'},today),true,'two weeks or more');
 assert.equal(isLongRunning({date_from:'2026-10-30',date_to:'2026-11-02'},today),false,'a festival weekend');
 assert.equal(isLongRunning({date_from:today,date_to:'2026-12-31'},today),false,'starting today: listed today');
});

test('a day is ordered by start time, events without a time last',()=>{
 const list=[
  {title:'Bez laika',date_from:today},
  {title:'Vakars',date_from:today,time_from:'19:00'},
  {title:'Rīts',date_from:today,time_from:'09:30'},
  {title:'Rīt',date_from:'2026-11-01',time_from:'08:00'},
  {title:'Festivāls',date_from:'2026-10-30',date_to:'2026-11-01',time_from:'12:00'}
 ].sort((a,b)=>compareForList(a,b,today)).map(e=>e.title);
 assert.deepEqual(list,['Rīts','Festivāls','Vakars','Bez laika','Rīt']);
});

test('the list keeps current events and sets long-running ones aside',()=>{
 const {current,longRunning}=splitForList([
  {title:'Izstāde līdz 30.12.',date_from:'2026-09-01',date_to:'2026-12-30'},
  {title:'Izstāde līdz 15.11.',date_from:'2026-07-25',date_to:'2026-11-15'},
  {title:'Koncerts',date_from:today,time_from:'19:00'},
  {title:'Beidzies',date_from:today,time_from:'08:00',time_to:'09:00'}
 ],today,at(15));
 assert.deepEqual(current.map(e=>e.title),['Koncerts']);
 assert.deepEqual(longRunning.map(e=>e.title),['Izstāde līdz 15.11.','Izstāde līdz 30.12.'],'ending soonest first');
});

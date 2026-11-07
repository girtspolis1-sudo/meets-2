import test from 'node:test';
import assert from 'node:assert/strict';
import {CALENDAR_ROWS,calendarCounts,calendarRow,dayRange,distanceKm,eventDaysWithin,heatStep,matchesCalendarChoice,nearPlace,withinRadius} from '../lib/event-calendar.js';

const concert={id:'a',event_type:'concert',primary_category:'Koncerts',date_from:'2026-11-14',sources:[{source:'tukums.lv'}]};
const festival={id:'b',event_type:'market',primary_category:'Tirgus',date_from:'2026-11-13',date_to:'2026-11-15',sources:[{source:'tukums.lv'}]};
const exhibition={id:'c',event_type:'exhibition',primary_category:'Izstāde',date_from:'2026-10-01',date_to:'2026-12-30',sources:[{source:'jurmala.lv'}]};
const unclear={id:'d',primary_category:'Lāčplēša diena',date_from:'2026-11-11',sources:[{source:'tukums.lv'}]};

test('rows: the eight topic groups in a fixed order, then Citi',()=>{
 assert.equal(CALENDAR_ROWS.length,9);
 assert.equal(CALENDAR_ROWS.at(-1).key,'other');
 assert.equal(calendarRow(concert),'music');
 assert.equal(calendarRow(unclear),'other');
});

test('an event counts on each day it runs; exhibitions are not counted by day',()=>{
 assert.deepEqual(eventDaysWithin(festival,'2026-11-14','2026-11-20'),['2026-11-14','2026-11-15']);
 assert.deepEqual(eventDaysWithin(exhibition,'2026-11-14','2026-11-20'),[]);
 const days=dayRange('2026-11-13',3);
 assert.deepEqual(days,['2026-11-13','2026-11-14','2026-11-15']);
 const {counts,totals}=calendarCounts([concert,festival,exhibition,unclear],days);
 assert.equal(counts['2026-11-14'].music,1);
 assert.equal(counts['2026-11-14'].markets,1);
 assert.equal(totals['2026-11-14'],2);
 assert.equal(totals['2026-11-13'],1);
});

test('a chosen day, row or cell filters the list',()=>{
 assert.equal(matchesCalendarChoice(festival,{day:'2026-11-15'}),true);
 assert.equal(matchesCalendarChoice(concert,{day:'2026-11-15'}),false);
 assert.equal(matchesCalendarChoice(concert,{row:'music'},{from:'2026-11-13',to:'2026-11-19'}),true);
 assert.equal(matchesCalendarChoice(festival,{day:'2026-11-14',row:'music'}),false);
});

test('shade steps and the radius filter',()=>{
 assert.deepEqual([0,1,3,8,40].map(heatStep),[0,1,2,3,4]);
 const riga=nearPlace('riga'),jurmala=nearPlace('jurmala');
 assert.ok(Math.abs(distanceKm(riga,jurmala)-20.5)<2);
 assert.equal(withinRadius({latitude:jurmala.lat,longitude:jurmala.lon},riga,25),true);
 assert.equal(withinRadius({latitude:jurmala.lat,longitude:jurmala.lon},riga,10),false);
 assert.equal(withinRadius({latitude:null},riga,25),false);
 assert.equal(withinRadius({latitude:null},null,0),true);
});

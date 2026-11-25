import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestionAction} from '../lib/map-search.js';

test('an event suggestion searches for the event and never becomes the place', ()=>{
 const action=suggestionAction({label:'2026. gada lielākie notikumi Smiltenes novadā',eventTitle:'2026. gada lielākie notikumi Smiltenes novadā',latitude:57.42,longitude:25.9,local:true});
 assert.equal(action.kind,'event');
 assert.equal(action.search,'2026. gada lielākie notikumi Smiltenes novadā');
 assert.deepEqual(action.view,[57.42,25.9]);
 assert.equal(action.location,undefined);
});

test('a place suggestion becomes the place', ()=>{
 const action=suggestionAction({label:'Smiltene, Latvija',latitude:'57.42',longitude:'25.9',local:true});
 assert.deepEqual(action,{kind:'place',location:{lat:57.42,lon:25.9,label:'Smiltene, Latvija',source:'events'}});
 assert.equal(suggestionAction({displayName:'Cēsis',latitude:57.3,longitude:25.27}).location.source,'search');
});

test('a suggestion without coordinates does nothing', ()=>{
 assert.equal(suggestionAction({label:'Nekur'}).kind,'none');
 assert.equal(suggestionAction(null).kind,'none');
});

import {matchesText,eventSuggestions,placeSuggestions,whatFilterCount} from '../lib/map-search.js';

test('the Ko field matches title, organizer or venue, without diacritics', ()=>{
 const e={title:'Ziemas koncerts',organizer_name:'Smiltenes kultūras centrs',venue_name:'Apes Amatu māja'};
 assert.ok(matchesText(e,'koncert'));
 assert.ok(matchesText(e,'kulturas centrs'));
 assert.ok(matchesText(e,'Amatu'));
 assert.ok(!matchesText(e,'teātris'));
 assert.ok(matchesText(e,''));
});

test('event suggestions: title start first, then the soonest, at most five', ()=>{
 const events=[
  {id:1,title:'Ziemas koncerts',date_from:'2026-12-01'},
  {id:2,title:'Koncerts baznīcā',date_from:'2026-12-05'},
  {id:3,title:'Koncerts skolā',date_from:'2026-11-30'},
  {id:4,title:'Tirgus',date_from:'2026-11-29'}
 ];
 assert.deepEqual(eventSuggestions(events,'koncert').map(e=>e.id),[3,2,1]);
 assert.deepEqual(eventSuggestions(events,'k'),[]);
 assert.equal(eventSuggestions(Array.from({length:9},(_,i)=>({id:i,title:'Koncerts '+i})),'konc').length,5);
});

test('place suggestions while typing', ()=>{
 const choices=[{label:'Ape, Latvija'},{label:'Smiltene, Latvija'},{label:'Smiltenes novads, Latvija'},{label:'Cēsis, Latvija'}];
 assert.deepEqual(placeSuggestions(choices,'smilt').map(c=>c.label),['Smiltene, Latvija','Smiltenes novads, Latvija']);
 assert.deepEqual(placeSuggestions(choices,'cesis').map(c=>c.label),['Cēsis, Latvija']);
});

test('the Filtri badge counts what differs from the defaults', ()=>{
 assert.equal(whatFilterCount({showLong:true}),0);
 assert.equal(whatFilterCount({category:'music',price:'free',onlineOnly:true,showLong:false,eventTypes:['lff']}),5);
});

import {shortWhen} from '../lib/map-search.js';
test('short dates for suggestions', ()=>{
 assert.equal(shortWhen({date_from:'2026-11-25',time_from:'17:30:00'},'2026-11-25'),'Šodien 17:30');
 assert.equal(shortWhen({date_from:'2026-11-26'},'2026-11-25'),'Rīt');
 assert.equal(shortWhen({date_from:'2026-11-28',time_from:'19:00'},'2026-11-25'),'28. nov. 19:00');
 assert.equal(shortWhen({date_from:'2026-11-01',date_to:'2026-12-31',time_from:'10:00'},'2026-11-25'),'Notiek');
 assert.equal(shortWhen({date_from:''},'2026-11-25'),'');
});

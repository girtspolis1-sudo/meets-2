import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_PICK_COUNT,homePicks} from '../lib/home-picks.js';

const today='2026-11-28';
const ev=(id,o={})=>({id,title:'Pasākums '+id,event_type:'concert',primary_category:'Koncerts',date_from:today,date_to:today,...o});

test('picks are coming events in date order, own picture first on the same day',()=>{
 const picks=homePicks([
  ev('c',{date_from:'2026-11-30',date_to:'2026-11-30'}),
  ev('a'),
  ev('b',{cover_image_url:'https://example.com/b.jpg'}),
  ev('old',{date_from:'2026-11-20',date_to:'2026-11-27'})
 ],today);
 assert.deepEqual(picks.map(e=>e.id),['b','a','c']);
});

test('council meetings, youth games and running exhibitions are left out',()=>{
 const picks=homePicks([
  ev('council',{event_type:'government',primary_category:'Domes sēde',title:'Domes sēde'}),
  ev('youth',{event_type:'sports_match',primary_category:'Sports',sport_level:'youth'}),
  ev('running',{event_type:'exhibition',primary_category:'Izstāde',date_from:'2026-10-01',date_to:'2027-02-01'}),
  ev('game',{event_type:'sports_match',primary_category:'Sports',sport_level:'senior'})
 ],today);
 assert.deepEqual(picks.map(e=>e.id),['game']);
});

test('at most six picks, and nothing for an empty catalogue',()=>{
 const many=Array.from({length:10},(_,i)=>ev('e'+i));
 assert.equal(homePicks(many,today).length,HOME_PICK_COUNT);
 assert.deepEqual(homePicks(null,today),[]);
});

import {HOME_PERIODS,gameSports,homeGames,homeSelection} from '../lib/home-picks.js';

// Rīga centre and places around it.
const RIGA={lat:56.9496,lon:24.1052};
const at=(lat,lon)=>({latitude:lat,longitude:lon});
const JURMALA=at(56.968,23.77),OGRE=at(56.8162,24.614),SIGULDA=at(57.1537,24.8531),LIEPAJA=at(56.5047,21.0108),RIGA_PT=at(56.95,24.11);

test('with a place: the nearest within 50 km, by day and then distance',()=>{
 const list=[
  ev('liepaja',{...LIEPAJA}),
  ev('ogre',{...OGRE}),
  ev('riga',{...RIGA_PT}),
  ev('jurmala-tomorrow',{...JURMALA,date_from:'2026-11-29',date_to:'2026-11-29'}),
  ev('nowhere'),
  ...Array.from({length:4},(_,i)=>ev('near'+i,{...RIGA_PT,date_from:'2026-11-30',date_to:'2026-11-30'}))
 ];
 const {events,radius}=homeSelection(list,today,{origin:RIGA});
 assert.equal(radius,50);
 assert.deepEqual(events.map(e=>e.id),['riga','ogre','jurmala-tomorrow','near0','near1','near2']);
});

test('fewer than six near: the radius widens',()=>{
 const list=[ev('riga',{...RIGA_PT}),ev('sigulda',{...SIGULDA}),ev('liepaja',{...LIEPAJA}),
  ...Array.from({length:4},(_,i)=>ev('s'+i,{...SIGULDA}))];
 const {events,radius}=homeSelection(list,today,{origin:RIGA});
 assert.equal(radius,100);
 assert.equal(events.length,6);
 assert.ok(!events.some(e=>e.id==='liepaja'));
 // Nothing reaches six even at 200 km: every event with a place, nearest first on each day.
 const few=homeSelection([ev('riga',{...RIGA_PT}),ev('liepaja',{...LIEPAJA}),ev('nowhere')],today,{origin:RIGA});
 assert.equal(few.radius,0);
 assert.deepEqual(few.events.map(e=>e.id),['riga','liepaja']);
});

test('the period keeps only events on those days',()=>{
 assert.deepEqual(HOME_PERIODS.map(([k])=>k),['today','tomorrow','weekend']);
 const list=[ev('today'),ev('tomorrow',{date_from:'2026-11-29',date_to:'2026-11-29'}),ev('later',{date_from:'2026-12-03',date_to:'2026-12-03'})];
 assert.deepEqual(homeSelection(list,today,{period:'tomorrow'}).events.map(e=>e.id),['tomorrow']);
 // 2026-11-28 is a Saturday: the weekend is today and tomorrow.
 assert.deepEqual(homeSelection(list,today,{period:'weekend'}).events.map(e=>e.id),['today','tomorrow']);
 assert.deepEqual(homeSelection(list,today,{period:'nonsense'}).events.map(e=>e.id),['today','tomorrow','later']);
});

const game=(id,o={})=>ev(id,{event_type:'sports_match',primary_category:'Sports',sport_format:'basketball',competition_name:'Optibet Latvijas–Igaunijas Basketbola līga',sport_level:'senior',...o});
test('games this week: adult games only, nearest first with a place',()=>{
 const list=[
  game('b-riga',{...RIGA_PT,time_from:'19:00'}),
  game('h-liepaja',{...LIEPAJA,sport_format:'ice_hockey',competition_name:'Optibet hokeja līga',time_from:'12:00'}),
  game('youth',{...RIGA_PT,sport_level:'youth'}),
  game('next-week',{date_from:'2026-12-06',date_to:'2026-12-06'}),
  ev('concert')
 ];
 assert.deepEqual(homeGames(list,today).map(e=>e.id),['h-liepaja','b-riga']);
 assert.deepEqual(homeGames(list,today,{origin:RIGA}).map(e=>e.id),['b-riga','h-liepaja']);
 assert.deepEqual(gameSports(list,today),[{label:'Basketbols',count:1},{label:'Hokejs',count:1}]);
 assert.deepEqual(homeGames(list,today,{sport:'Hokejs'}).map(e=>e.id),['h-liepaja']);
});

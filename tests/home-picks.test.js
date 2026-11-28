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

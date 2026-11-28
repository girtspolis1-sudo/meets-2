import test from 'node:test';
import assert from 'node:assert/strict';
import {agesOf,gameAge,sportGames,sportLeagues,sportsOf,youthLeagues} from '../lib/sports-pages.js';

const today='2026-11-28';
const game=(id,o={})=>({id,title:'A – B '+id,event_type:'sports_match',primary_category:'Sports',date_from:today,date_to:today,...o});
const events=[
 game('lbl1',{competition_name:'Optibet Latvijas–Igaunijas Basketbola līga',sport_format:'basketball',time_from:'19:00'}),
 game('lbl2',{competition_name:'Optibet Latvijas–Igaunijas Basketbola līga',sport_format:'basketball',date_from:'2026-11-30',date_to:'2026-11-30'}),
 game('ohl',{competition_name:'Optibet hokeja līga',time_from:'18:00'}),
 game('ljbl',{competition_name:'U16 Puiši, Superlīga',governing_body:'LBS / LJBL',sport_format:'basketball',age_group:'U16',sport_level:'youth'}),
 game('lhf',{competition_name:'Latvijas Bērnu un Jaunatnes čempionāts hokejā (U11)',age_group:'U11',sport_level:'youth',date_from:'2026-12-02',date_to:'2026-12-02'}),
 game('lhf-late',{competition_name:'Latvijas Bērnu un Jaunatnes čempionāts hokejā (U11)',age_group:'U11',sport_level:'youth',date_from:'2026-12-20',date_to:'2026-12-20'}),
 game('vol',{competition_name:'Kausa izcīņa U14 M',age_group:'U14 zēni',sport_level:'youth',sport_format:'volleyball'}),
 game('old',{competition_name:'Optibet hokeja līga',date_from:'2026-11-20',date_to:'2026-11-20'}),
 {id:'concert',title:'Koncerts',event_type:'concert',primary_category:'Koncerts',date_from:today,date_to:today}
];

test('adult games: coming sports events of adults, soonest first',()=>{
 assert.deepEqual(sportGames(events,today).map(e=>e.id),['ohl','lbl1','lbl2']);
});

test('adult leagues with their game count and next game',()=>{
 const leagues=sportLeagues(events,today);
 assert.deepEqual(leagues.map(l=>[l.name,l.count,l.next.id]),[
  ['Optibet Latvijas–Igaunijas Basketbola līga',2,'lbl1'],['Optibet hokeja līga',1,'ohl']]);
 assert.match(leagues[0].path,/^\/pasakumi\/sports\/[a-z0-9-]+$/);
 assert.equal(leagues[0].sport,'Basketbols');
});

test('youth leagues: games in the next 14 days only',()=>{
 const leagues=youthLeagues(events,today);
 const lhf=leagues.find(l=>l.name.includes('hokejā'));
 assert.equal(lhf.count,1,'the game on 20 Dec is beyond two weeks');
 assert.equal(leagues.length,3);
 assert.ok(!leagues.some(l=>l.name.includes('Optibet')),'adult leagues are not youth leagues');
 assert.deepEqual(sportLeagues(events,today,{level:'youth'}).find(l=>l.name.includes('hokejā')).count,2);
});

test('youth filters: sports and age groups, youngest first',()=>{
 const games=sportGames(events,today,{level:'youth',days:14});
 assert.deepEqual(agesOf(games),['U11','U14','U16']);
 assert.equal(gameAge(events.find(e=>e.id==='vol')),'U14');
 assert.equal(gameAge({competition_name:'Jaunatnes čempionāts telpu futbolā: U-15 čempionāts 2026/27'}),'U15');
 assert.equal(gameAge({competition_name:'Optibet hokeja līga'}),'');
 assert.deepEqual(sportsOf(games).map(s=>s.label).sort(),['Basketbols','Hokejs','Volejbols']);
});

import {sportPages} from '../lib/sports-pages.js';
import {indexableListings} from '../lib/event-listings.js';
test('sitemap: both sports pages and youth league pages once they have enough games',()=>{
 const many=Array.from({length:6},(_,i)=>game('y'+i,{competition_name:'U16 Puiši, Superlīga',governing_body:'LBS / LJBL',age_group:'U16',sport_level:'youth',sport_format:'basketball'}));
 const adults=Array.from({length:5},(_,i)=>game('a'+i,{competition_name:'Optibet hokeja līga'}));
 assert.deepEqual(sportPages([...many,...adults],today).map(p=>p.path),['/pasakumi/sports','/pasakumi/sports/jauniesi']);
 assert.deepEqual(sportPages(events,today),[]);
 assert.ok(indexableListings(many,today).some(l=>/^\/pasakumi\/sports\/u16-puisi/.test(l.path)),'the youth league page is in the sitemap');
});

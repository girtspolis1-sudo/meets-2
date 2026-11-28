import test from 'node:test';
import assert from 'node:assert/strict';
import {sportLine,ageLabel,isYouthSport} from '../lib/sport-line.js';

// Real competition names from the database (event_sports_metadata → sports_competitions).
const game=(competition_name,extra={})=>({event_type:'sports_match',title:'Mājinieki – Viesi',competition_name,...extra});

test('adult leagues keep the name fans use, without sponsor clutter where it is long',()=>{
 assert.equal(sportLine(game('Optibet Latvijas–Igaunijas Basketbola līga')),'Latvijas–Igaunijas līga');
 assert.equal(sportLine(game('Aizdevums.lv Reģionālā basketbola līga')),'Reģionālā basketbola līga');
 assert.equal(sportLine(game('Ramirent Nacionālā basketbola līga')),'Nacionālā basketbola līga');
 assert.equal(sportLine(game('Sieviešu Baltijas Basketbola līga, B divīzija')),'Sieviešu Baltijas līga, B divīzija');
 assert.equal(sportLine(game('Latvijas Sieviešu basketbola līga, 2. divīzija')),'Sieviešu basketbola līga, 2. divīzija');
 assert.equal(sportLine(game('Estonian - Latvian Women´s Handball League',{competition_stage:'Regular Season'})),'Igaunijas–Latvijas sieviešu līga');
 assert.equal(sportLine(game('Latvijas Čempionāts Nacionālā līga vīriešiem')),'Nacionālā līga vīriešiem');
 assert.equal(sportLine(game('LČ Nacionālā līga sievietēm')),'Nacionālā līga sievietēm');
 assert.equal(sportLine(game('Latvijas SynotTip kauss vīriešiem 2027')),'Latvijas SynotTip kauss vīriešiem');
 assert.equal(sportLine(game('Optibet hokeja līga')),'Optibet hokeja līga');
 assert.equal(sportLine(game('Florbola 1. līga vīriešiem',{governing_body:'LFS'})),'Florbola 1. līga vīriešiem');
 assert.equal(sportLine(game('Maksibasketbols K45+',{age_group:'40+'})),'Maksibasketbols K45+');
});

test('youth leagues name the federation and the age group',()=>{
 assert.equal(sportLine(game('U16 Puiši, Superlīga',{governing_body:'LBS / LJBL',sport_level:'youth',age_group:'U16'})),'LJBL · U16 puiši, Superlīga');
 assert.equal(sportLine(game('U12 Puiši',{governing_body:'LBS / LJBL',age_group:'U12'})),'LJBL · U12 puiši');
 assert.equal(sportLine(game('Latvijas Bērnu un Jaunatnes čempionāts hokejā (U11)',{governing_body:'LHF',age_group:'U11'})),'LHF jaunatne · U11');
 assert.equal(sportLine(game('Latvijas Bērnu un Jaunatnes čempionāts hokejā (U18M)',{age_group:'U18'})),'LHF jaunatne · U18');
 assert.equal(sportLine(game('Jaunatnes čempionāts telpu futbolā: U-15 čempionāts 2026/27',{age_group:'U15',governing_body:'LFF'})),'LFF jaunatne · U15 telpu futbols');
 assert.equal(sportLine(game('Kausa izcīņa U14 M',{governing_body:'LVF',age_group:'U14 zēni'})),'Kausa izcīņa · U14 zēni');
 assert.equal(sportLine(game('Kausa izcīņa U14 Z',{governing_body:'LVF',age_group:'U14 meitenes'})),'Kausa izcīņa · U14 meitenes');
 assert.equal(sportLine(game('Meitenes U12 (2015)',{age_group:'U12 meitenes',competition_stage:'Regulārā sezona'})),'U12 meitenes');
 assert.equal(sportLine(game('Zēni U14 (2013)')),'U14 zēni');
});

test('a stage that matters is added, the regular season is not',()=>{
 assert.equal(sportLine(game('Optibet hokeja līga',{competition_stage:'Pusfināls'})),'Optibet hokeja līga · Pusfināls');
 assert.equal(sportLine(game('Tonybet Virslīga',{competition_stage:'Regulārā sezona'})),'Tonybet Virslīga');
});

test('long names are cut at a word with an ellipsis',()=>{
 const line=sportLine(game('Novada atklātais čempionāts basketbolā vīriešiem un sievietēm'));
 assert.ok(line.length<=38,line);
 assert.ok(line.endsWith('…'),line);
 assert.ok(!/\s…$/.test(line),line);
});

test('no line for events that are not sports or have no competition',()=>{
 assert.equal(sportLine({title:'Ziemassvētku koncerts',category:'Mūzika'}),'');
 assert.equal(sportLine(null),'');
 assert.equal(sportLine({event_type:'sports_match',title:'A – B'}),'');
 assert.equal(sportLine({event_type:'sports_match',title:'A – B',age_group:'U13 zēni'}),'U13 zēni');
});

test('age labels',()=>{
 assert.equal(ageLabel('U-15'),'U15');
 assert.equal(ageLabel('U14 zēni'),'U14 zēni');
 assert.equal(ageLabel('U12 Meitenes'),'U12 meitenes');
 assert.equal(ageLabel('40+'),'');
 assert.equal(ageLabel('U23'),'');
 assert.equal(ageLabel(''),'');
});

test('youth mark follows the sports level',()=>{
 assert.equal(isYouthSport(game('U12 Puiši',{sport_level:'youth'})),true);
 assert.equal(isYouthSport(game('Optibet hokeja līga')),false);
 assert.equal(isYouthSport({title:'Koncerts'}),false);
});

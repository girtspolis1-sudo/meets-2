import test from 'node:test';
import assert from 'node:assert/strict';
import {eventMapIcon,groupedSportIcon,sportIcon} from '../lib/event-map-icons.js';

const sport=title=>eventMapIcon({title,primary_category:'Sports'}).glyph;

test('sport events get the icon of their sport',()=>{
 assert.equal(sport('Beisbola5 turnīrs Siguldas rudens 2026'),'⚾');
 assert.equal(sport('Galda tenisa čempionāts'),'🏓');
 assert.equal(sport('Tenisa turnīrs'),'🎾');
 assert.equal(sport('Šaha turnīrs bērniem'),'♟️');
 assert.equal(sport('Slēpošanas sacensības'),'⛷️');
 assert.equal(sport('Džudo kauss'),'🥋');
 assert.equal(sport('Handbola spēle'),'🤾');
 assert.equal(eventMapIcon({title:'Baltijas kausa izcīņa',sport_format:'Futbols'}).glyph,'⚽');
});

test('events of other kinds keep their category icon',()=>{
 assert.notEqual(eventMapIcon({title:'Koncerts',primary_category:'Mūzika'}).glyph,'⚾');
});

test('league imports show their sport even when the title does not name it',()=>{
 assert.equal(eventMapIcon({title:'Rīga – Liepāja',governing_body:'LHF'}).glyph,'🏒');
 assert.equal(eventMapIcon({title:'RTU – Jelgava',governing_body:'LVF'}).glyph,'🏐');
 assert.equal(eventMapIcon({title:'Ogre – Valmiera',sources:[{source:'handball.lv'}]}).glyph,'🤾');
});

test('a map pin shows a sport only when all its events are that sport',()=>{
 const hockey={title:'A – B',governing_body:'LHF'};
 assert.equal(groupedSportIcon([hockey,hockey])?.glyph,'🏒');
 assert.equal(groupedSportIcon([hockey,{title:'Koncerts',primary_category:'Mūzika'}]),null);
 assert.equal(sportIcon({title:'Koncerts',primary_category:'Mūzika'}),null);
});

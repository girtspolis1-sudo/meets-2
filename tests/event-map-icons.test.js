import test from 'node:test';
import assert from 'node:assert/strict';
import {eventMapIcon,groupedSportIcon,sportIcon} from '../lib/event-map-icons.js';

const sport=title=>eventMapIcon({title,primary_category:'Sports'}).icon;

test('sport events get the icon of their sport',()=>{
 assert.equal(sport('Beisbola5 turnīrs Siguldas rudens 2026'),'baseball');
 assert.equal(sport('Galda tenisa čempionāts'),'table-tennis');
 assert.equal(sport('Tenisa turnīrs'),'tennis');
 assert.equal(sport('Šaha turnīrs bērniem'),'chess');
 assert.equal(sport('Slēpošanas sacensības'),'skiing');
 assert.equal(sport('Džudo kauss'),'martial');
 assert.equal(sport('Handbola spēle'),'handball');
 assert.equal(eventMapIcon({title:'Baltijas kausa izcīņa',sport_format:'Futbols'}).icon,'football');
});

test('events of other kinds keep their category icon',()=>{
 assert.notEqual(eventMapIcon({title:'Koncerts',primary_category:'Mūzika'}).icon,'baseball');
});

test('league imports show their sport even when the title does not name it',()=>{
 assert.equal(eventMapIcon({title:'Rīga – Liepāja',governing_body:'LHF'}).icon,'hockey');
 assert.equal(eventMapIcon({title:'RTU – Jelgava',governing_body:'LVF'}).icon,'volleyball');
 assert.equal(eventMapIcon({title:'Ogre – Valmiera',sources:[{source:'handball.lv'}]}).icon,'handball');
});

test('a map pin shows a sport only when all its events are that sport',()=>{
 const hockey={title:'A – B',governing_body:'LHF'};
 assert.equal(groupedSportIcon([hockey,hockey])?.icon,'hockey');
 assert.equal(groupedSportIcon([hockey,{title:'Koncerts',primary_category:'Mūzika'}]),null);
 assert.equal(sportIcon({title:'Koncerts',primary_category:'Mūzika'}),null);
});

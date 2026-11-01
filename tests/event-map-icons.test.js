import test from 'node:test';
import assert from 'node:assert/strict';
import {eventMapIcon} from '../lib/event-map-icons.js';

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

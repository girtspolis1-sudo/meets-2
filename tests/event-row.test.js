import test from 'node:test';
import assert from 'node:assert/strict';
import {rowPlace,rowTile,statusChip} from '../lib/event-row.js';

test('tile shows day and month in the theme palette',()=>{
 const tile=rowTile({date_from:'2026-11-24',title:'Zaļā Marka – OTanks',event_type:'sports_match',primary_category:'Basketbols'});
 assert.equal(tile.day,'24');assert.equal(tile.month,'NOV');assert.equal(tile.palette,'priede');assert.equal(tile.label,'Basketbols');
 assert.equal(rowTile({}).day,'—');
});
test('place does not repeat the town',()=>{
 assert.equal(rowPlace({venue_name:'Ogre',settlement:'Ogre'}),'Ogre');
 assert.equal(rowPlace({venue_name:'Rundāles Avoti',settlement:'Rundāle'}),'Rundāles Avoti, Rundāle');
});
test('status chips share one wording',()=>{
 assert.deepEqual(statusChip('pending_review'),{label:'Pārbaudē',tone:'wait'});
 assert.deepEqual(statusChip('published'),{label:'Publicēts',tone:'ok'});
 assert.equal(statusChip('weird').tone,'muted');
});

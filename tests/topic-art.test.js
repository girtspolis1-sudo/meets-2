import test from 'node:test';
import assert from 'node:assert/strict';
import {artVariant,topicArt} from '../lib/topic-art.js';

test('sport events get their sport picture and the sport on the chip',()=>{
 const art=topicArt({id:'1',title:'Zaļā Marka – OTanks',event_type:'sports_match',primary_category:'Basketbols'});
 assert.equal(art.scene,'basketbols');assert.equal(art.palette,'priede');assert.equal(art.label,'Basketbols');
 assert.equal(topicArt({title:'Daugavpils atklātais čempionāts volejbolā 2026',event_type:'sports_competition',primary_category:'Volejbols'}).scene,'volejbols');
});
test('the title decides when the category says nothing',()=>{
 assert.equal(topicArt({title:'Ziemassvētku tirdziņš',primary_category:'Pasākums'}).scene,'ziemassvetki');
 assert.equal(topicArt({title:'Domes sēde',primary_category:''}).scene,'pasvaldiba');
});
test('categories map to their scene',()=>{
 assert.equal(topicArt({title:'Koncerts',event_type:'concert',primary_category:'Koncerts'}).scene,'koncerts');
 assert.equal(topicArt({title:'Izstāde “Šaursliežu piederība”',event_type:'exhibition',primary_category:'Izstāde'}).scene,'izstade');
});
test('an unknown theme falls back to a calendar with the group name on the chip',()=>{
 const art=topicArt({title:'Kaut kas',primary_category:''});
 assert.equal(art.scene,'kalendars');assert.ok(art.label);
});
test('variant is stable per event and both appear',()=>{
 assert.equal(artVariant('abc'),artVariant('abc'));
 const seen=new Set(Array.from({length:20},(_,i)=>artVariant('event-'+i)));
 assert.deepEqual([...seen].sort(),['A','B']);
});

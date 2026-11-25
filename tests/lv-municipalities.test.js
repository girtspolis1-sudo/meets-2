import test from 'node:test';
import assert from 'node:assert/strict';
import {MUNICIPALITIES,REGIONS,TILE_COLUMNS,TILE_ROWS,municipalityByName,municipalityCounts,heatLevels,areaOf,areaGroups,parseMunicipalityParam,municipalityParam} from '../lib/lv-municipalities.js';

test('all 43 local governments, each once, each on its own tile inside the grid', ()=>{
 assert.equal(MUNICIPALITIES.length,43);
 assert.equal(MUNICIPALITIES.filter(m=>m.kind==='city').length,7);
 assert.equal(new Set(MUNICIPALITIES.map(m=>m.name)).size,43);
 assert.equal(new Set(MUNICIPALITIES.map(m=>m.slug)).size,43);
 assert.equal(new Set(MUNICIPALITIES.map(m=>m.col+','+m.row)).size,43);
 for(const m of MUNICIPALITIES){
  assert.ok(m.col>=0&&m.col<TILE_COLUMNS&&m.row>=0&&m.row<TILE_ROWS,m.name);
  assert.ok(REGIONS.some(r=>r.key===m.region),m.name);
 }
});

test('names match the municipality values that events carry', ()=>{
 // Seen in the public catalogue (November 2026).
 for(const name of ['Rīgas valstspilsēta','Siguldas novads','Jelgavas valstspilsēta','Smiltenes novads','Dienvidkurzemes novads','Augšdaugavas novads','Ādažu novads','Ķekavas novads','Līvānu novads','Mārupes novads'])
  assert.ok(municipalityByName(name),name);
 assert.equal(municipalityByName('Vairākas pašvaldības'),null);
 assert.equal(municipalityByName('Ārpus Latvijas (Igaunija)'),null);
});

test('counts skip unknown places', ()=>{
 const counts=municipalityCounts([{municipality:'Smiltenes novads'},{municipality:'Smiltenes novads'},{municipality:'Rīgas valstspilsēta'},{municipality:'Vairākas pašvaldības'},{municipality:null}]);
 assert.deepEqual([...counts.entries()],[['Smiltenes novads',2],['Rīgas valstspilsēta',1]]);
});

test('heat levels follow rank, not size', ()=>{
 const counts=new Map([['a',400],['b',10],['c',8],['d',5],['e',0]]);
 const levels=heatLevels(counts);
 assert.equal(levels.get('e'),0);
 assert.equal(levels.get('d'),1);
 assert.equal(levels.get('a'),4);
 assert.ok(levels.get('b')>levels.get('d'));
 assert.equal(heatLevels(new Map([['x',3]])).get('x'),4);
});

test('area of an event: settlement, parish or the town before the novads', ()=>{
 assert.equal(areaOf({settlement:'Smiltene',address_raw:'x'}),'Smiltene');
 assert.equal(areaOf({address_raw:'Trapenes kultūras nams, Ilzene — Līzespasts, Trapene, Trapenes pagasts, Smiltenes novads, LV-4348, Latvija'}),'Trapenes pagasts');
 assert.equal(areaOf({address_raw:'Elīnas Zālītes memoriālā māja, 24, Dzirnavu iela, Ape, Smiltenes novads, LV-4337, Latvija'}),'Ape');
 assert.equal(areaOf({address_raw:'Gaujas iela 1, Smiltene, Smiltenes nov., LV-4729'}),'Smiltene');
 assert.equal(areaOf({address_raw:'Smiltenes pilsētas (Tepera) stadions'}),'');
});

test('area groups: biggest first, unknown places last, with a centre point', ()=>{
 const groups=areaGroups([
  {settlement:'Smiltene',latitude:57.4,longitude:25.9},{settlement:'Smiltene',latitude:57.6,longitude:26.1},
  {address_raw:'x, Ape, Smiltenes novads',latitude:57.5,longitude:26.6},{address_raw:'',latitude:null,longitude:null}
 ]);
 assert.deepEqual(groups.map(g=>[g.name,g.count]),[['Smiltene',2],['Ape',1],['Citur',1]]);
 assert.ok(Math.abs(groups[0].lat-57.5)<1e-9);
 assert.equal(groups[2].lat,null);
});

test('municipality URL parameter keeps one or several names', ()=>{
 assert.deepEqual(parseMunicipalityParam('Smiltenes novads'),['Smiltenes novads']);
 assert.deepEqual(parseMunicipalityParam('Smiltenes novads, Cēsu novads,,Smiltenes novads'),['Smiltenes novads','Cēsu novads']);
 assert.deepEqual(parseMunicipalityParam(''),[]);
 assert.equal(municipalityParam(['Cēsu novads','Smiltenes novads']),'Cēsu novads,Smiltenes novads');
});

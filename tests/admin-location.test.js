import test from 'node:test';
import assert from 'node:assert/strict';
import {bestSuggestion,isAreaCandidate,groupCandidates,suggestionQuery} from '../lib/admin-location.js';

test('town-level results are never offered as an exact venue',()=>{
 assert.equal(isAreaCandidate({type:'town',category:'place'}),true);
 assert.equal(isAreaCandidate({type:'administrative',category:'boundary'}),true);
 assert.equal(isAreaCandidate({type:'school',category:'amenity'}),false);
 const town={type:'town',latitude:56.66,longitude:22.49,label:'Saldus'};
 assert.deepEqual(bestSuggestion([town]),{candidate:town,precise:false});
});
test('the first building-level result is preferred',()=>{
 const town={type:'town',latitude:56.9,longitude:24.1};
 const school={type:'school',category:'amenity',latitude:56.97,longitude:24.18};
 assert.deepEqual(bestSuggestion([town,school]),{candidate:school,precise:true});
 assert.equal(bestSuggestion([{type:'school'}]),null);
 assert.equal(bestSuggestion([]),null);
});
test('suggestions are shared by events of the same place',()=>{
 const list=[{label:'A',latitude:1,longitude:2}];
 assert.deepEqual(groupCandidates([{geocode_candidates:[]},{geocode_candidates:list}]),list);
 assert.deepEqual(groupCandidates([]),[]);
});
test('search query combines alias and municipality without repeating',()=>{
 assert.equal(suggestionQuery({alias:'Saldus',municipality:'Saldus'}),'Saldus');
 assert.equal(suggestionQuery({alias:'Imantas vsk.',municipality:'Rīga'}),'Imantas vsk., Rīga');
});

test('only strong, unambiguous suggestions can be approved in bulk',async()=>{
 const {confidentSuggestion}=await import('../lib/admin-location.js');
 const known={type:'meets_known',score:0.95,sameArea:true,latitude:57.38,longitude:21.57,label:'OC Ventspils'};
 assert.equal(confidentSuggestion({alias:'OC Ventspils',candidates:[known]}),known);
 assert.equal(confidentSuggestion({alias:'OC Ventspils',candidates:[{...known,score:0.7}]}),null);
 assert.equal(confidentSuggestion({alias:'OC Ventspils',candidates:[{...known,sameArea:false}]}),null);
 const hall={type:'sports_hall',label:'Jelgavas sporta halle',displayName:'Jelgavas sporta halle, Jelgava, Latvija',latitude:56.65,longitude:23.72};
 assert.equal(confidentSuggestion({alias:'Jelgavas sporta halle',municipality:'Jelgavas valstspilsēta',candidates:[hall]}),hall);
 assert.equal(confidentSuggestion({alias:'Jelgavas sporta halle',municipality:'Rīgas valstspilsēta',candidates:[hall]}),null,'other municipality');
 assert.equal(confidentSuggestion({alias:'Jelgavas sporta halle',candidates:[hall,{...hall,latitude:56.7}]}),null,'two exact results');
 assert.equal(confidentSuggestion({alias:'Jelgavas sporta halle',candidates:[{...hall,type:'town'}]}),null,'area only');
});

test('abbreviated league names still match the full place name',async()=>{
 const {confidentSuggestion,nameStems}=await import('../lib/admin-location.js');
 assert.deepEqual(nameStems('Rīgas Teikas vsk. 1.zale'),['riga','teik','vidussko']);
 assert.deepEqual(nameStems('Cēsu SK'),['cesu','spor','komplek']);
 const school={type:'school',category:'amenity',label:'Rīgas Teikas vidusskola',displayName:'Rīgas Teikas vidusskola, Rīga, Latvija',latitude:56.97,longitude:24.17};
 assert.equal(confidentSuggestion({alias:'Rīgas Teikas vsk. 1.zale',municipality:'Rīgas valstspilsēta',candidates:[school]}),school);
 assert.equal(confidentSuggestion({alias:'Imantas vsk.',municipality:'Rīgas valstspilsēta',candidates:[school]}),null,'other school');
});

test('known places must agree on numbers and kind of building',async()=>{
 const {confidentSuggestion,namesMatch}=await import('../lib/admin-location.js');
 assert.equal(namesMatch('Rīgas 47.vsk.','Rīgas 49.vsk. 65, Krišjāņa Valdemāra iela, Rīga'),false);
 assert.equal(namesMatch('Ķekavas vsk.','Ķekavas SK Sporta komplekss, Rīgas iela, Baldone'),false);
 assert.equal(namesMatch('Talsu SN','Talsu SN Talsu sporta halle, Talsi'),true);
 const saldus={type:'meets_known',score:1.03,sameArea:true,label:'Saldus SN',displayName:'Saldus sporta nams, Saldus',latitude:56.66,longitude:22.49};
 assert.equal(confidentSuggestion({alias:'Saldus',municipality:'Saldus novads',candidates:[saldus]}),null,'town name only');
 const talsi={type:'meets_known',score:1.25,sameArea:true,label:'Talsu SN',displayName:'Talsu sporta halle, Talsi',latitude:57.24,longitude:22.58};
 assert.equal(confidentSuggestion({alias:'Talsu SN',municipality:'Talsu novads',candidates:[talsi]}),talsi);
});

test('a single address register match is approved in bulk',async()=>{
 const {confidentSuggestion}=await import('../lib/admin-location.js');
 const address={type:'address',category:'building',unique:true,label:'Kalēju iela 9/11',displayName:'Kalēju iela 9/11, Rīga, LV-1050',latitude:56.946,longitude:24.108};
 const group={alias:'Rīgas Porcelāna muzejs, Kalēju iela 9/11, LV-1050',municipality:'Rīgas valstspilsēta',candidates:[address]};
 assert.equal(confidentSuggestion(group),address);
 assert.equal(confidentSuggestion({...group,candidates:[{...address,unique:false}]}),null,'several matches');
 assert.equal(confidentSuggestion({...group,municipality:'Talsu novads'}),null,'other municipality');
});

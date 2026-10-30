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
 assert.deepEqual(nameStems('Rīgas Teikas vsk. 1.zale'),['riga','teik']);
 assert.deepEqual(nameStems('Cēsu SK'),['cesu']);
 const school={type:'school',category:'amenity',label:'Rīgas Teikas vidusskola',displayName:'Rīgas Teikas vidusskola, Rīga, Latvija',latitude:56.97,longitude:24.17};
 assert.equal(confidentSuggestion({alias:'Rīgas Teikas vsk. 1.zale',municipality:'Rīgas valstspilsēta',candidates:[school]}),school);
 assert.equal(confidentSuggestion({alias:'Imantas vsk.',municipality:'Rīgas valstspilsēta',candidates:[school]}),null,'other school');
});

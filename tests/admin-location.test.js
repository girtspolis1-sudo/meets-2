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

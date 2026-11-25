import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestionAction} from '../lib/map-search.js';

test('an event suggestion searches for the event and never becomes the place', ()=>{
 const action=suggestionAction({label:'2026. gada lielākie notikumi Smiltenes novadā',eventTitle:'2026. gada lielākie notikumi Smiltenes novadā',latitude:57.42,longitude:25.9,local:true});
 assert.equal(action.kind,'event');
 assert.equal(action.search,'2026. gada lielākie notikumi Smiltenes novadā');
 assert.deepEqual(action.view,[57.42,25.9]);
 assert.equal(action.location,undefined);
});

test('a place suggestion becomes the place', ()=>{
 const action=suggestionAction({label:'Smiltene, Latvija',latitude:'57.42',longitude:'25.9',local:true});
 assert.deepEqual(action,{kind:'place',location:{lat:57.42,lon:25.9,label:'Smiltene, Latvija',source:'events'}});
 assert.equal(suggestionAction({displayName:'Cēsis',latitude:57.3,longitude:25.27}).location.source,'search');
});

test('a suggestion without coordinates does nothing', ()=>{
 assert.equal(suggestionAction({label:'Nekur'}).kind,'none');
 assert.equal(suggestionAction(null).kind,'none');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanRegistryFilters,filterRegistryEvents} from '../lib/registry-filters.js';
import {isManualCollection,eventInCollection,collectionEvents,MANUAL_COLLECTION_FILTER} from '../lib/personal-collections.js';
const a={id:'a',title:'A',date_from:'2026-11-04'};
const b={id:'b',title:'B',date_from:'2026-11-05'};
test('manual collections contain only selected events, never all events by default',()=>{
 assert.equal(cleanRegistryFilters(MANUAL_COLLECTION_FILTER).selection_mode,'manual');
 assert.deepEqual(filterRegistryEvents([a,b],MANUAL_COLLECTION_FILTER,[]),[]);
 assert.deepEqual(filterRegistryEvents([a,b],MANUAL_COLLECTION_FILTER,['b']),[b]);
});
test('manual collection addition and removal use explicit IDs',()=>{
 const item={organization_id:null,filters:MANUAL_COLLECTION_FILTER,included_event_ids:['b','b','a'],excluded_event_ids:['a']};
 assert.equal(isManualCollection(item),true);
 assert.equal(eventInCollection(item,'b'),true);
 assert.equal(eventInCollection(item,'a'),false);
 assert.deepEqual(collectionEvents([a,b],item),[b]);
});
test('legacy filtered and organization lists keep their behavior',()=>{
 assert.equal(isManualCollection({filters:{period:'month'}}),false);
 assert.equal(isManualCollection({organization_id:'org',filters:MANUAL_COLLECTION_FILTER}),false);
 assert.deepEqual(filterRegistryEvents([a,b],{period:'all'},[]),[a,b]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanRegistryFilters,cleanRegistryIds,filterRegistryEvents} from '../lib/registry-filters.js';

const today='2026-10-24';
const ids=[
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000003'
];
const rows=[
 {id:ids[0],title:'Ģimenes svētki',description:'Mārupē',date_from:'2026-10-24',municipality:'Mārupes novads',country_code:'LV',price_status:'free',event_type:'Tirdziņš',venue_name:'Parks'},
 {id:ids[1],title:'Koncerts',date_from:'2026-10-27',municipality:'Rīga',country_code:'LV',price_status:'paid',event_type:'Koncerts',venue_name:'Klubs'},
 {id:ids[2],title:'Sporta sacensības',date_from:'2026-11-01',municipality:'Tallina',country_code:'EE',price_status:'free',event_type:'Sacensības',venue_name:'Arēna'}
];
test('filter by municipality, period, price and country',()=>{
 const f={municipality:'Mārupes novads',period:'today',price:'free',country:'LV'};
 assert.deepEqual(filterRegistryEvents(rows,f,[],[],today).map(x=>x.id),[ids[0]]);
 assert.deepEqual(filterRegistryEvents(rows,{country:'EE'},[],[],today).map(x=>x.id),[ids[2]]);
});
test('manual inclusions override filters and exclusion wins',()=>{
 const results=filterRegistryEvents(rows,{country:'LV'},[ids[2]],[ids[0]],today);
 assert.deepEqual(results.map(x=>x.id),[ids[1],ids[2]]);
});
test('invalid optional filters are normalized safely',()=>{
 const f=cleanRegistryFilters({radius:999,latitude:0,longitude:0,period:'anything',category:'a',price:'a',country:'xx'});
 assert.equal(f.radius,0);
 assert.equal(f.period,'all');
 assert.equal(f.country,'');
 assert.equal(f.category,'');
});
test('manual choices reject invalid or excessive identifiers',()=>{
 assert.deepEqual(cleanRegistryIds([ids[0],ids[0]]),[ids[0]]);
 assert.throws(()=>cleanRegistryIds(['invalid']));
 assert.throws(()=>cleanRegistryIds(Array.from({length:101},(_,i)=>i.toString())));
});
test('custom date range includes spanning events',()=>{
 const events=[{...rows[0],date_from:'2026-10-01',date_to:'2026-11-01'}];
 assert.equal(filterRegistryEvents(events,{period:'custom',from:'2026-10-23',to:'2026-10-30'},[],[],today).length,1);
});

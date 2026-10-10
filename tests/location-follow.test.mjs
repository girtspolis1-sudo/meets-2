import test from 'node:test';
import assert from 'node:assert/strict';
import {placeFromEvent,placesFromEvents,eventsAtPlace} from '../lib/location-follow.js';

test('names the venue, never the map fallback or municipality alone',()=>{
 const e={id:'1',venue_name:'Garkalnes bibliotēka',municipality:'Ropažu novads',country_code:'LV',location_precision:'municipality_center'};
 const p=placeFromEvent(e);
 assert.ok(p);
 assert.equal(p.name,'Garkalnes bibliotēka');
 assert.equal(placeFromEvent({municipality:'Rīga',venue_name:'Rīga'}),null);
 assert.equal(placeFromEvent({municipality:'Rīga'}),null);
});

test('same Latvian location names match across imported events',()=>{
 const a={id:'1',venue_name:'Garkalnes bibliotēka',municipality:'Ropažu novads',country_code:'LV'};
 const b={id:'2',venue_name:'Garkalnes bibliotēka',municipality:'Ropažu novads',country_code:'LV'};
 const c={id:'3',venue_name:'Garkalnes bibliotēka',municipality:'Mārupes novads',country_code:'LV'};
 const venues=placesFromEvents([a,b,c]);
 assert.equal(venues.length,2);
 assert.equal(venues.find(x=>x.key===placeFromEvent(a).key).count,2);
 assert.deepEqual(eventsAtPlace([a,b,c],placeFromEvent(a).key).map(x=>x.id),['1','2']);
});

test('fallback to a real street address when named venue missing',()=>{
 const place=placeFromEvent({address_raw:'Brīvības iela 1, Rīga',municipality:'Rīga',country_code:'LV'});
 assert.equal(place?.name,'Brīvības iela 1, Rīga');
});

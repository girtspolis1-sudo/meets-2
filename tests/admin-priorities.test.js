import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPriorities,upcomingWithoutPlace} from '../lib/admin-priorities.js';

test('late organizer submissions come first and are marked urgent',()=>{
 const list=adminPriorities({submissionQueue:{count:2,oldestDays:3},publishedNeedsReview:[{}],readyToPublish:[{}],mappingGroups:[]});
 assert.deepEqual(list.map(x=>x.key),['submissions','published','ready']);
 assert.equal(list[0].tone,'bad');
 assert.equal(adminPriorities({submissionQueue:{count:1,oldestDays:0}})[0].tone,'warn');
});

test('upcoming events without a place are limited to the next 7 days',()=>{
 const events=[
  {title:'Rīt',status:'pending_review',date_from:'2026-10-31'},
  {title:'Pēc mēneša',status:'pending_review',date_from:'2026-12-01'},
  {title:'Publicēts',status:'published',date_from:'2026-10-31'}
 ];
 assert.deepEqual(upcomingWithoutPlace(events,()=>true,'2026-10-30').map(e=>e.title),['Rīt']);
});

test('mapping priority says how many places already have a suggestion',()=>{
 const [item]=adminPriorities({mappingGroups:[{candidates:[{}]},{candidates:[]}]});
 assert.match(item.detail,/^1 vietai jau ir ieteikums/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingSubmissions,waitingDays,submissionExpired} from '../lib/admin-submissions.js';

const now=Date.parse('2026-10-30T12:00:00Z');
test('pending submissions are counted oldest first with waiting time',()=>{
 const summary=pendingSubmissions([
  {id:'b',status:'pending_review',created_at:'2026-10-24T08:00:00Z',date_from:'2026-10-24'},
  {id:'a',status:'pending_review',created_at:'2026-10-11T08:00:00Z',date_from:'2026-11-17'},
  {id:'c',status:'published',created_at:'2026-10-01T08:00:00Z',date_from:'2026-10-05'}
 ],'2026-10-30',now);
 assert.deepEqual(summary.items.map(x=>x.id),['a','b']);
 assert.equal(summary.count,2);
 assert.equal(summary.oldestDays,19);
 assert.equal(summary.expired,1);
});
test('waiting days and expiry handle missing data',()=>{
 assert.equal(waitingDays({},now),0);
 assert.equal(submissionExpired({date_from:'2026-10-29'},'2026-10-30'),true);
 assert.equal(submissionExpired({date_from:'2026-10-29',date_to:'2026-10-31'},'2026-10-30'),false);
 assert.equal(submissionExpired({},'2026-10-30'),false);
});

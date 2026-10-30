import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedDraftKey,resolveOrganizationId,canWriteOrganization,recurrenceEditScope,submissionDateLabel,organizerTodo} from '../lib/organizer-workspace.js';

test('draft keys are isolated by user and organization',()=>{
 assert.notEqual(scopedDraftKey('user-a','org-1'),scopedDraftKey('user-b','org-1'));
 assert.notEqual(scopedDraftKey('user-a','org-1'),scopedDraftKey('user-a','org-2'));
 assert.equal(scopedDraftKey(null,null),'meets_event_draft_v3:guest:unassigned');
});
test('requested organization context is preserved when accessible',()=>{
 const orgs=[{id:'a'},{id:'b'}];
 assert.equal(resolveOrganizationId(orgs,'b'),'b');
 assert.equal(resolveOrganizationId(orgs,'missing'),'');
 assert.equal(resolveOrganizationId([{id:'only'}],'missing'),'only');
});
test('viewer cannot write while editor roles can',()=>{
 assert.equal(canWriteOrganization('viewer'),false);
 for(const role of ['owner','admin','editor'])assert.equal(canWriteOrganization(role),true);
});
test('recurring edits are explicitly series-scoped',()=>{
 assert.equal(recurrenceEditScope({schedule_kind:'recurring'}),'series');
 assert.equal(recurrenceEditScope({schedule_kind:'once'}),'event');
});
test('organizer dates are readable Latvian dates',()=>{
 const one=submissionDateLabel({date_from:'2026-11-03'});
 assert.match(one,/2026/);assert.match(one,/nov/);assert.doesNotMatch(one,/2026-11-03/);
 assert.equal(submissionDateLabel({date_from:'2026-11-03',date_to:'2026-11-05'}),one+' – '+submissionDateLabel({date_from:'2026-11-05'}));
 assert.equal(submissionDateLabel({date_from:'2026-11-03',date_to:'2026-11-03'}),one);
 assert.equal(submissionDateLabel({}),'Datums nav norādīts');
});
test('organizer to-do groups returned, draft and in-review submissions',()=>{
 const todo=organizerTodo([{status:'rejected'},{status:'draft'},{status:'draft'},{status:'published'},{status:'pending_review'}]);
 assert.equal(todo.rejected.length,1);assert.equal(todo.drafts.length,2);assert.equal(todo.review.length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedDraftKey,resolveOrganizationId,canWriteOrganization,recurrenceEditScope} from '../lib/organizer-workspace.js';

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

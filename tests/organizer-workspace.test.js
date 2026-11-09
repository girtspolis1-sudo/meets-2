import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedDraftKey,resolveOrganizationId,canWriteOrganization,recurrenceEditScope,submissionDateLabel,organizerTodo,eventReach,eventFormat} from '../lib/organizer-workspace.js';

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

test('an event started in the organizer area opens the editor with its name and date',async()=>{
 const {quickEventHref}=await import('../lib/organizer-workspace.js');
 assert.equal(quickEventHref(),'/registre-pasakumu/vienkarsi');
 assert.equal(quickEventHref({orgId:'o1',title:'  Rudens koncerts ',date:'2026-11-20',visibility:'private'}),
  '/registre-pasakumu/vienkarsi?org=o1&title=Rudens+koncerts&start=2026-11-20&private=1');
 assert.equal(quickEventHref({title:'',date:'20.11.2026'}),'/registre-pasakumu/vienkarsi');
});

test('event marks: green ready, yellow on its way, red needs the organizer',async()=>{
 const {eventStatusMark}=await import('../lib/organizer-workspace.js');
 const base={title:'Koncerts',date_from:'2099-01-01',category:'Cits',price_status:'free',venue_name:'Zāle',address:'Iela 1',attendance_mode:'in_person',visibility:'public'};
 const tone=item=>eventStatusMark(item).tone;
 assert.equal(tone({...base,status:'published'}),'green');
 assert.deepEqual([eventStatusMark({...base,status:'private',visibility:'private'}).tone,eventStatusMark({...base,status:'private',visibility:'private'}).visibility],['green','Priv.']);
 assert.equal(eventStatusMark({...base,status:'published'}).visibility,'Publ.');
 assert.equal(tone({...base,status:'pending_review'}),'yellow');
 assert.equal(tone({...base,status:'draft'}),'yellow');
 assert.equal(tone({...base,status:'draft',venue_name:''}),'red');
 assert.equal(eventStatusMark({...base,status:'draft',title:''}).label,'Jāpapildina');
 // A private online draft needs no place.
 assert.equal(tone({...base,status:'draft',visibility:'private',attendance_mode:'online',venue_name:'',address:''}),'yellow');
 assert.equal(tone({...base,status:'rejected'}),'red');
 assert.equal(tone({...base,status:'declined'}),'red');
 assert.equal(tone({...base,status:'cancelled'}),'gray');
 assert.equal(eventStatusMark({...base,status:'published'},{archived:true}).label,'Arhivēts');
});

test('event reach says where people can see an event',()=>{
 const today='2026-11-09',pub={is_public:true},hidden={is_public:false};
 const states=(item,org=pub)=>Object.fromEntries(eventReach(item,org,today).places.map(p=>[p.key,p.state]));
 assert.deepEqual(states({status:'draft',date_from:'2026-12-01'}),{map:'off',profile:'off',link:'off'});
 assert.equal(eventReach({status:'draft'},pub,today).who,'Redz tikai rīkotāja komanda');
 assert.deepEqual(states({status:'private',share_token:'t',date_from:'2026-12-01'}),{map:'off',profile:'off',link:'on'});
 assert.deepEqual(states({status:'pending_review',share_token:'t',date_from:'2026-12-01'}),{map:'wait',profile:'off',link:'on'});
 // A published event being changed stays on the map.
 assert.deepEqual(states({status:'pending_review',event_id:'e',share_token:'t',date_from:'2026-12-01'}),{map:'on',profile:'on',link:'on'});
 assert.deepEqual(states({status:'published',event_id:'e',share_token:'t',date_from:'2026-12-01'}),{map:'on',profile:'on',link:'on'});
 assert.deepEqual(states({status:'published',event_id:'e',share_token:'t',date_from:'2026-12-01'},hidden),{map:'on',profile:'off',link:'on'});
 assert.equal(eventReach({status:'published',event_id:'e',date_from:'2026-12-01'},hidden,today).places[1].hint,'Rīkotāja profils nav publisks');
 assert.deepEqual(states({status:'published',event_id:'e',share_token:'t',date_from:'2026-11-01'}),{map:'off',profile:'off',link:'on'});
 assert.deepEqual(states({status:'cancelled',share_token:'t',date_from:'2026-12-01'}),{map:'off',profile:'off',link:'off'});
 assert.equal(eventReach({status:'rejected'},pub,today).who,'Nav redzams — MEETS lūdz precizēt');
});
test('event format names visibility and schedule',()=>{
 assert.equal(eventFormat({visibility:'public'}),'Publisks');
 assert.equal(eventFormat({visibility:'private',schedule_kind:'recurring'}),'Privāts · Atkārtojas');
 assert.equal(eventFormat({schedule_kind:'dated'}),'Publisks · Vairāki datumi');
});

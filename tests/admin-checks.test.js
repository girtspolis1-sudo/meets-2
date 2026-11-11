import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEvents,bucketOf,contentIssues,locationIssues,nextInQueue,reasonList,toCsv} from '../lib/admin-checks.js';

const good={id:'a',title:'Koncerts Rīgā',description:'Vakara koncerts ar orķestri un solistiem.',date_from:'2026-11-05',
 venue_name:'Lielā ģilde',latitude:56.95,longitude:24.11,location_quality:'verified_exact',sources:[{source:'x.lv',url:'https://x.lv/1'}]};

test('location checks: missing place, point, area and unverified point',()=>{
 assert.deepEqual(locationIssues(good),[]);
 assert.deepEqual(locationIssues({...good,venue_name:'',address_raw:''}),['no_place']);
 assert.deepEqual(locationIssues({...good,latitude:null}),['no_point']);
 assert.deepEqual(locationIssues({...good,location_quality:'fallback_center'}),['area_only']);
 // Automatic points from an official source are not admin work.
 assert.deepEqual(locationIssues({...good,location_quality:'source_exact',location_auto:'address_register'}),[]);
 assert.deepEqual(locationIssues({...good,location_quality:'source_exact',location_auto:'culture_institution'}),[]);
 assert.deepEqual(locationIssues({...good,location_quality:'fallback_center',location_auto:'settlement_center'}),[]);
 assert.deepEqual(locationIssues({...good,location_quality:'source_exact',location_auto:'source_page_address'}),['location_unverified']);
 assert.deepEqual(locationIssues({...good,location_quality:'source_exact'}),['location_unverified']);
 assert.deepEqual(locationIssues({...good,location_quality:'venue_unverified'}),['location_unverified']);
 assert.deepEqual(locationIssues({attendance_mode:'online'}),[],'online events need no place');
});

test('content checks',()=>{
 assert.deepEqual(contentIssues(good),[]);
 assert.ok(contentIssues({...good,date_to:'2026-11-01'}).includes('bad_dates'));
 assert.ok(contentIssues({...good,description:'Teksts&nbsp;ar <b>tagiem</b> un vēl daudz teksta'}).includes('html_residue'));
 assert.ok(contentIssues({...good,title:'LIELAIS KONCERTS'}).includes('caps_title'));
 assert.ok(!contentIssues({...good,title:'LFF kauss'}).includes('caps_title'),'short abbreviations are fine');
 assert.ok(contentIssues({...good,description:''}).includes('no_description'));
 assert.ok(contentIssues({...good,date_to:'2027-08-01'}).includes('very_long'));
 assert.ok(contentIssues({...good,sources:[]}).includes('no_source'));
});

test('events fall into the four blocks',()=>{
 assert.equal(bucketOf({status:'pending_review'},['no_point']),'critical');
 assert.equal(bucketOf({status:'pending_review'},['no_description']),'ready','warnings do not block');
 assert.equal(bucketOf({status:'published'},['no_point']),'review');
 assert.equal(bucketOf({status:'published'},[]),'ok');
 assert.equal(bucketOf({status:'published'},['no_description']),'ok','a missing description is only a note');
 assert.equal(bucketOf({status:'cancelled'},[]),'other');
});

test('audit counts blocks and reasons, and finds duplicates',()=>{
 const {rows,counts,reasons}=auditEvents([
  {...good,status:'published'},
  {...good,id:'b',status:'published'},
  {...good,id:'c',status:'pending_review',title:'Cits',latitude:null},
  {...good,id:'d',status:'pending_review',title:'Vēl cits'}
 ]);
 assert.deepEqual(rows.map(r=>r.bucket),['review','review','critical','ready']);
 assert.deepEqual(counts,{critical:1,ready:1,review:2,ok:0,other:0});
 assert.equal(reasons.review.duplicate,2);
 assert.deepEqual(reasonList({no_description:3,no_point:1}).map(r=>r.code),['no_point','no_description'],'blocking reasons first');
});

test('work queue moves to the next open item and wraps around',()=>{
 assert.equal(nextInQueue(['a','b','c'],'a'),'b');
 assert.equal(nextInQueue(['a','b','c'],'a',id=>id==='b'),'c');
 assert.equal(nextInQueue(['a','b','c'],'c'),'a');
 assert.equal(nextInQueue(['a'],'a'),null);
});

test('CSV uses semicolons and quotes when needed',()=>{
 assert.equal(toCsv(['a','b'],[['x;y','"q"']]),'a;b\n"x;y";"""q"""');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewProblem,submissionChecks,reasonLabel,reasonTemplate,historyLabel,inLatvia} from '../lib/submission-review.js';

test('a decision other than publishing needs a reason, and "other" needs a comment',()=>{
 assert.equal(reviewProblem('publish','',''),'');
 assert.match(reviewProblem('request_changes','',''),/Izvēlies/);
 assert.match(reviewProblem('decline','other',' '),/komentāru/);
 assert.equal(reviewProblem('decline','duplicate',''),'');
});

test('checks flag past events, duplicates and missing places with a matching reason',()=>{
 const checks=submissionChecks({date_from:'2026-10-01',possible_duplicates:[{id:'x'}],description:'',price_status:'free'},'2026-10-30');
 const byReason=Object.fromEntries(checks.map(c=>[c.reason,c]));
 assert.equal(byReason.past.level,'block');
 assert.equal(byReason.duplicate.action,'decline');
 assert.equal(byReason.location.action,'request_changes');
 assert.equal(submissionChecks({date_from:'2026-11-05',time_from:'18:00',latitude:56.95,longitude:24.1,venue_name:'Zāle',description:'x'.repeat(50),price_status:'free'},'2026-10-30').length,0);
});

test('labels and templates follow the reason codes',()=>{
 assert.equal(reasonLabel('past'),'Pasākums jau ir noticis');
 assert.match(reasonTemplate('request_changes','location'),/adresi/);
 assert.equal(historyLabel({action:'changes_requested',reason:'price'}),'Lūgts precizēt · Jāprecizē cena vai biļešu informācija');
 assert.equal(inLatvia('',''),false);
 assert.equal(inLatvia(56.9,24.1),true);
});

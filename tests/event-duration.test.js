import test from 'node:test';
import assert from 'node:assert/strict';
import {durationKind,isBackgroundLong,isLastDays,isOpeningDay,runningLabel,spanDays,untilBadge} from '../lib/event-duration.js';

const today='2026-11-03';
test('events fall into short, medium and long by how many days they cover',()=>{
 assert.equal(spanDays({date_from:today}),1);
 assert.equal(durationKind({date_from:'2026-11-06',date_to:'2026-11-08'}),'short');
 assert.equal(durationKind({date_from:'2026-11-01',date_to:'2026-11-10'}),'medium');
 assert.equal(durationKind({date_from:'2026-11-01',date_to:'2026-11-14'}),'medium','14 days is still medium');
 assert.equal(durationKind({date_from:'2026-09-01',date_to:'2027-01-07'}),'long');
});
test('a long exhibition is background while it runs, foreground on opening and in its last week',()=>{
 const running={date_from:'2026-09-01',date_to:'2027-01-07'};
 assert.equal(isBackgroundLong(running,today),true);
 assert.equal(isOpeningDay({date_from:today,date_to:'2027-01-07'},today),true);
 assert.equal(isBackgroundLong({date_from:today,date_to:'2027-01-07'},today),false,'opening day');
 const ending={date_from:'2026-09-01',date_to:'2026-11-07'};
 assert.equal(isLastDays(ending,today),true);
 assert.equal(isBackgroundLong(ending,today),false);
});
test('running labels and pin badge',()=>{
 assert.equal(runningLabel({date_from:'2026-11-02',date_to:'2026-11-04'},today),'Notiek šodien · 2. diena no 3');
 assert.equal(runningLabel({date_from:'2026-11-01',date_to:'2026-11-10'},today),'Notiek līdz 10. nov. · vēl 7 dienas');
 assert.equal(runningLabel({date_from:'2026-09-01',date_to:'2027-01-07'},today),'Apskatāms līdz 7. janv.');
 assert.equal(runningLabel({date_from:'2026-09-01',date_to:today},today),'Pēdējā diena!');
 assert.equal(runningLabel({date_from:today},today),'','not running yet');
 assert.equal(untilBadge({date_from:'2026-09-01',date_to:'2027-01-07'}),'līdz 7.01.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCounts,rangeIndexes,rangeLabel,daysBetween} from '../lib/day-histogram.js';

const today='2026-11-26';
test('bars count events by start day, running events on today', ()=>{
 const bars=dailyCounts([
  {date_from:'2026-11-26'},{date_from:'2026-11-28'},{date_from:'2026-11-28'},
  {date_from:'2026-11-01',date_to:'2026-12-31'},{date_from:'2026-11-01',date_to:'2026-11-20'},{date_from:'2027-02-01'}
 ],today);
 assert.equal(bars.length,30);
 assert.equal(bars[0].count,2);
 assert.equal(bars[2].count,2);
 assert.equal(bars.reduce((s,b)=>s+b.count,0),4);
 assert.ok(bars[2].weekend);
 assert.ok(!bars[0].weekend);
});
test('the chart stops at the end of the catalogue window', ()=>{
 assert.equal(dailyCounts([],today,30,'2026-12-05').length,10);
});
test('chosen dates become bar positions, clamped to the chart', ()=>{
 const bars=dailyCounts([],today);
 assert.deepEqual(rangeIndexes(bars,'2026-11-26','2026-12-02'),{a:0,b:6});
 assert.deepEqual(rangeIndexes(bars,'2026-11-01','2027-03-01'),{a:0,b:29});
 assert.deepEqual(rangeIndexes(bars,'',''),{a:0,b:29});
});
test('range label', ()=>{
 assert.equal(rangeLabel('2026-11-26','2026-12-02'),'26. nov. – 2. dec. · 7 dienas');
 assert.equal(rangeLabel('2026-11-28','2026-11-28'),'28. nov. · 1 diena');
 assert.equal(daysBetween('2026-11-26','2026-12-26'),30);
});

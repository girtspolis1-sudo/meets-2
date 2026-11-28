import test from 'node:test';
import assert from 'node:assert/strict';
import {fullDateLine} from '../lib/event-seo.js';

test('one day: weekday, day and month in the sentence form, and the time',()=>{
 assert.equal(fullDateLine({date_from:'2026-12-01',date_to:'2026-12-01',time_from:'18:00:00'},'2026-11-28'),'otrdien, 1. decembrī · 18:00');
 assert.equal(fullDateLine({date_from:'2026-11-28',time_from:'19:00:00',time_to:'21:30:00'},'2026-11-28'),'sestdien, 28. novembrī · 19:00–21:30');
 assert.equal(fullDateLine({date_from:'2026-11-28',time_type:'all_day'},'2026-11-28'),'sestdien, 28. novembrī · visu dienu');
});
test('several days and another year',()=>{
 assert.equal(fullDateLine({date_from:'2026-11-28',date_to:'2026-12-01'},'2026-11-28'),'28. nov. – 1. dec.');
 assert.equal(fullDateLine({date_from:'2027-01-09',date_to:'2027-01-09'},'2026-11-28'),'sestdien, 9. janvārī 2027.');
 assert.equal(fullDateLine({},'2026-11-28'),'');
});

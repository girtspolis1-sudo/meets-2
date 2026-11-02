import test from 'node:test';
import assert from 'node:assert/strict';
import {daysBadge,daysUntil,eventTerm,termLabel,termTone} from '../lib/event-term.js';
import {categoryIconName,categoryIconSvg} from '../lib/category-icons.js';

const today='2026-11-02';

test('days until start; running events count as today',()=>{
 assert.equal(daysUntil({date_from:'2026-11-02'},today),0);
 assert.equal(daysUntil({date_from:'2026-10-30',date_to:'2026-11-05'},today),0);
 assert.equal(daysUntil({date_from:'2026-11-03'},today),1);
 assert.equal(daysUntil({date_from:'2026-11-09'},today),7);
 assert.equal(daysUntil({date_from:'2026-12-10'},today),38);
 assert.equal(daysUntil({date_from:''},today),null);
});

test('C3 tones: 0 = today, 1 = tomorrow, 2+ = later',()=>{
 assert.equal(termTone(0),'today');
 assert.equal(termTone(1),'tomorrow');
 assert.equal(termTone(2),'later');
 assert.equal(termTone(45),'later');
});

test('badge shows days up to 29 and 30+ beyond',()=>{
 assert.equal(daysBadge(0),'0d');
 assert.equal(daysBadge(7),'7d');
 assert.equal(daysBadge(29),'29d');
 assert.equal(daysBadge(30),'30+');
 assert.equal(daysBadge(120),'30+');
});

test('term labels read naturally',()=>{
 assert.equal(termLabel(0),'Šodien (0 d)');
 assert.equal(termLabel(1),'Rīt (1 d)');
 assert.equal(termLabel(3),'Vēlāk (3 d)');
 assert.equal(termLabel(40),'Vēlāk (30+ d)');
});

test('an event that ended earlier today is marked ended',()=>{
 const now=new Date('2026-11-02T20:00:00Z'); // 22:00 in Riga
 const term=eventTerm({date_from:today,time_from:'10:00',time_to:'12:00'},today,now);
 assert.equal(term.tone,'ended');
 assert.equal(eventTerm({date_from:'2026-11-05'},today,now).badge,'3d');
});

test('unknown groups fall back to the generic event icon',()=>{
 assert.equal(categoryIconName('sport'),'sport');
 assert.equal(categoryIconName(''),'event');
 assert.match(categoryIconSvg('music'),/^<svg[^>]+stroke="currentColor"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {channelLabel,kindTone,seenText,sortMunicipalities,sourceLabel} from '../lib/admin-sources.js';

test('channels read the same way everywhere',()=>{
 assert.equal(channelLabel(['html','rss']),'RSS + HTML');
 assert.equal(channelLabel(['ics']),'ICS');
 assert.equal(channelLabel(['page','html','html']),'HTML + Lapa');
 assert.equal(channelLabel(['custom']),'custom');
 assert.equal(channelLabel(null),'');
 assert.equal(sourceLabel({source:'ropazi.lv',via:['rss','html']}),'ropazi.lv · RSS + HTML');
 assert.equal(sourceLabel({source:'lff.lv'}),'lff.lv');
});

test('last seen days per channel, newest first',()=>{
 assert.equal(seenText({html:'2026-11-18',rss:'2026-11-21'}),'RSS 21.11., HTML 18.11.');
 assert.equal(seenText({}),'');
 assert.equal(seenText(null),'');
});

test('municipality overview: problems first, missing sources last',()=>{
 const rows=[{name:'Tukuma novads',source_kind:'RSS + HTML'},{name:'Alūksnes novads',source_kind:'Nav avota'},
  {name:'Rīgas valstspilsēta',source_kind:'RSS + HTML',problem:'RSS: HTTP 500'},{name:'Ādažu novads',source_kind:'RSS + HTML'}];
 assert.deepEqual(sortMunicipalities(rows).map(r=>r.name),['Rīgas valstspilsēta','Ādažu novads','Tukuma novads','Alūksnes novads']);
 assert.equal(kindTone('Nav avota'),'bad');
 assert.equal(kindTone('RSS + HTML'),'ok');
});

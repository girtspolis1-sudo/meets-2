import test from 'node:test';
import assert from 'node:assert/strict';
import {changedUrls,indexNowBody,validIndexNowKey} from '../lib/indexnow.js';

test('IndexNow key, changed addresses and request body',()=>{
 assert.equal(validIndexNowKey('a1b2c3d4'),true);
 assert.equal(validIndexNowKey('short'),false);
 assert.equal(validIndexNowKey('bad key!'),false);
 const events=[{id:'1',updated_at:'2026-11-21T10:00:00Z'},{id:'2',updated_at:'2026-11-19T10:00:00Z'},{id:'3',updated_at:null}];
 assert.deepEqual(changedUrls(events,'2026-11-20T00:00:00Z',e=>'https://meets.lv/pasakumi/'+e.id),['https://meets.lv/pasakumi/1']);
 assert.deepEqual(indexNowBody({host:'meets.lv',key:'k'.repeat(8),keyLocation:'https://meets.lv/indexnow-key/kkkkkkkk.txt',urls:['u']}),
  {host:'meets.lv',key:'kkkkkkkk',keyLocation:'https://meets.lv/indexnow-key/kkkkkkkk.txt',urlList:['u']});
});

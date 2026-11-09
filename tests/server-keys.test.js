import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogHeaders} from '../lib/server-keys.js';

test('catalogue is read with the secret key when it is set',()=>{
 assert.deepEqual(catalogHeaders({SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x'}),{apikey:'sb_publishable_x','Content-Type':'application/json'});
 assert.deepEqual(catalogHeaders({SUPABASE_PUBLISHABLE_KEY:'p',SUPABASE_SECRET_KEY:' sb_secret_abc '}),{apikey:'sb_secret_abc','Content-Type':'application/json'});
 assert.deepEqual(catalogHeaders({SUPABASE_PUBLISHABLE_KEY:'p',SUPABASE_SECRET_KEY:'eyJlegacy'}),{apikey:'eyJlegacy',Authorization:'Bearer eyJlegacy','Content-Type':'application/json'});
});

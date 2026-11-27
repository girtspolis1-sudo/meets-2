import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://ci.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='ci-test';
const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
const BUILT=['2026-11-27T10:00:00.123456+00:00','2026-11-27T10:05:00.654321+00:00'];

// A fresh copy of the module (its shared catalogue starts empty) and a fake Supabase:
// `version()` answers meets_public_catalog_version, `catalog(n)` the n-th full read.
async function setup(name,{version,catalog=n=>({fetchedAt:BUILT[0],events:[{id:'e'+n,title:'T',date_from:day,status:'published'}]})}){
 const original=globalThis.fetch,realNow=Date.now;
 const calls={full:0,version:0};
 let now=realNow();
 globalThis.fetch=async url=>{
  if(String(url).endsWith('/rpc/meets_public_catalog_version')){calls.version++;return version();}
  calls.full++;
  return Response.json(catalog(calls.full));
 };
 Date.now=()=>now;
 const mod=await import('../lib/events-server.js?case='+name);
 return {
  mod,calls,
  later(ms){now+=ms;},
  restore(){globalThis.fetch=original;Date.now=realNow;}
 };
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

test('the public catalogue is read once a minute and served stale while refreshing',async()=>{
 const t=await setup('changed',{
  version:()=>Response.json(BUILT[1]),
  catalog:n=>({fetchedAt:BUILT[n===1?0:1],events:[{id:'e'+n,title:'T',date_from:day,status:'published'}]})
 });
 try{
  assert.equal((await t.mod.readEventsCached()).events[0].id,'e1');
  assert.equal((await t.mod.readEventsCached()).events[0].id,'e1');
  assert.equal(t.calls.full,1);
  assert.equal(t.calls.version,0,'the first read loads the catalogue directly');
  t.later(61*1000);
  assert.equal((await t.mod.readEventsCached()).events[0].id,'e1','stale copy while the refresh runs');
  await settle();await settle();
  assert.equal(t.calls.version,1);
  assert.equal(t.calls.full,2,'a new build time loads the whole catalogue');
  assert.equal((await t.mod.readEventsCached()).events[0].id,'e2');
 }finally{t.restore();}
});

test('an unchanged build time keeps the copy without loading the catalogue',async()=>{
 // Same instant as BUILT[0], written differently: compared as time, not as text.
 const t=await setup('unchanged',{version:()=>Response.json('2026-11-27T10:00:00.123+00:00')});
 try{
  await t.mod.readEventsCached();
  t.later(61*1000);
  assert.equal((await t.mod.readEventsCached()).events[0].id,'e1');
  await settle();await settle();
  assert.equal(t.calls.version,1);
  assert.equal(t.calls.full,1,'no second full read');
  // The copy counts as fresh again for a minute: no further calls.
  t.later(30*1000);
  await t.mod.readEventsCached();
  await settle();
  assert.equal(t.calls.version,1);
  assert.equal(t.calls.full,1);
 }finally{t.restore();}
});

test('when the build time cannot be read, the whole catalogue is loaded',async()=>{
 const t=await setup('version-error',{version:()=>new Response('{"message":"not found"}',{status:404})});
 try{
  await t.mod.readEventsCached();
  t.later(61*1000);
  await t.mod.readEventsCached();
  await settle();await settle();
  assert.equal(t.calls.version,1);
  assert.equal(t.calls.full,2);
 }finally{t.restore();}
});

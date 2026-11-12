import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20261112101556_event_claims.sql',import.meta.url),'utf8');
const functions=[...sql.matchAll(/create or replace function ([\w.]+)\(/gi)].map(m=>m[1]);

test('event claim functions are SECURITY DEFINER with an empty search_path',()=>{
 assert.ok(functions.length>=5);
 for(const name of functions){
  const start=sql.search(new RegExp('create or replace function '+name.replace('.','\\.')+'\\(','i'));
  const head=sql.slice(start,start+400);
  assert.match(head,/security definer/i,name);
  assert.match(head,/set search_path (to|=) ''/i,name);
 }
});

test('anon cannot run the claim functions and the table is closed',()=>{
 for(const name of ['meets_claim_event','meets_org_event_claims','meets_admin_event_claims','meets_admin_decide_event_claim'])
  assert.match(sql,new RegExp('revoke execute on function public\\.'+name+'\\([^)]*\\) from public, ?anon','i'),name);
 assert.match(sql,/alter table public\.meets_event_claims enable row level security/i);
 assert.match(sql,/revoke all on public\.meets_event_claims from public, ?anon, ?authenticated/i);
});

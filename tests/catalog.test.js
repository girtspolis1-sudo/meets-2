import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents,initialFilters,publicEvent,safeUrl} from '../lib/catalog.js';
import {createWorkbook} from '../lib/excel.js';
import {readEvents} from '../lib/events-server.js';
import ExcelJS from 'exceljs';
test('all dates and statuses included; intervals overlap; Latvian search; invalid date range',()=>{
 const rows=[{id:'1',title:'Mārupes koncerts',date_from:'2020-01-01',date_to:'2020-01-05',status:'pending_review'},{id:'2',title:'Nākamais',date_from:'2030-01-01',status:'cancelled'}];
 assert.equal(filterEvents(rows,initialFilters).length,2);
 assert.equal(filterEvents(rows,{...initialFilters,search:'marupes'}).length,1);
 assert.equal(filterEvents(rows,{...initialFilters,from:'2020-01-03',to:'2020-01-03'}).length,1);
 assert.equal(filterEvents(rows,{...initialFilters,from:'2030-01-01',to:'2020-01-01'}).length,0);
});
test('public projection excludes administrative data and unsafe URLs',()=>{
 const e=publicEvent({title:'A',comment:'private',notes:'private',import_key:'x',last_change_summary:'private',sources:[{url:'javascript:alert(1)',token:'secret'}]});
 assert(!('comment' in e));assert(!('notes' in e));assert(!('import_key' in e));assert(!('last_change_summary' in e));assert(!('token' in e.sources[0]));assert.equal(e.sources[0].url,'');assert.equal(safeUrl('https://example.com'),'https://example.com/');
});
test('live Supabase data and Excel round trip include every row; no formulas',async()=>{
 const data=await readEvents(); assert(data.events.every(e=>e.status==='published'));assert.equal(new Set(data.events.map(e=>e.id)).size,data.total);
 const buf=await createWorkbook([...data.events,{id:'test',title:'=HYPERLINK("https://example.com")',sources:[],tags:[],date_from:'2026-09-28'}],data.fetchedAt);
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const sheet=wb.getWorksheet('Pasākumi');
 assert.equal(sheet.rowCount,data.total+2);assert.equal(sheet.getCell(`D${data.total+2}`).value,'=HYPERLINK("https://example.com")');assert.equal(sheet.getCell(`D${data.total+2}`).type,ExcelJS.ValueType.String);assert(sheet.getCell(`A${data.total+2}`).value instanceof Date);
 const denied=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_public_catalog',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:'invalid'})});assert.equal(denied.status,401);
 const table=await fetch(process.env.SUPABASE_URL+'/rest/v1/events?select=id&limit=1',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});assert(!table.ok);
 console.log(`Verified ${data.total} live rows, full XLSX export, invalid-token rejection and no direct anonymous table access.`);
});

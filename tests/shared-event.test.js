import test from 'node:test';
import assert from 'node:assert/strict';
import {coverImageUrl,dateRangeLabel,excerpt,flyerPath,flyerTextLines,isShareToken,placeLines,priceLine,rigaOffsetLabel,scheduleLines,sharedStatusNote,sharePath} from '../lib/shared-event.js';

const TOKEN='9847198c-66d5-4bd1-8f2e-3b2f3a86bb51';

test('share and flyer paths take only a UUID token',()=>{
 assert.equal(isShareToken(TOKEN),true);
 assert.equal(isShareToken('../admin'),false);
 assert.equal(isShareToken(''),false);
 assert.equal(sharePath(TOKEN),'/ielugums/'+TOKEN);
 assert.equal(flyerPath(TOKEN),'/sludinajums/'+TOKEN);
});

test('cover images come only from the event image bucket',()=>{
 const path='a1b2c3d4-0000-4000-8000-000000000001/b1b2c3d4-0000-4000-8000-000000000002/c1b2c3d4-0000-4000-8000-000000000003.webp';
 assert.equal(coverImageUrl('https://x.supabase.co',path),'https://x.supabase.co/storage/v1/object/public/meets-event-images/'+path);
 assert.equal(coverImageUrl('https://x.supabase.co','../../secret.png'),'');
 assert.equal(coverImageUrl('',path),'');
});

test('Riga offset follows summer time',()=>{
 assert.equal(rigaOffsetLabel('2026-11-07'),'GMT+02:00');
 assert.equal(rigaOffsetLabel('2026-07-15'),'GMT+03:00');
});

test('one-day event: weekday, date and time',()=>{
 assert.deepEqual(scheduleLines({date_from:'2026-11-07',time_from:'12:00:00',time_to:'13:00:00',schedule_kind:'once'}),['Sestdiena, 7. novembris, 12:00–13:00']);
 assert.deepEqual(scheduleLines({date_from:'2026-11-07',schedule_kind:'once'}),['Sestdiena, 7. novembris']);
 assert.deepEqual(scheduleLines({}),['Datums nav norādīts']);
});

test('multi-day event: range and daily time',()=>{
 assert.equal(dateRangeLabel('2026-11-07','2026-11-09'),'7.–9. novembris');
 assert.equal(dateRangeLabel('2026-10-30','2026-11-02'),'30. oktobris – 2. novembris');
 assert.deepEqual(scheduleLines({date_from:'2026-11-07',date_to:'2026-11-09',time_from:'10:00',time_to:'18:00',schedule_kind:'ongoing'}),['7.–9. novembris','Katru dienu 10:00–18:00']);
});

test('weekly schedule lists weekdays and the period',()=>{
 const lines=scheduleLines({schedule_kind:'recurring',date_from:'2026-11-10',date_to:'2026-12-15',recurrence_slots:[{weekday:2,start:'18:00',end:'19:30'},{weekday:4,start:'18:00',end:'19:30'}]});
 assert.deepEqual(lines,['Otrdienās 18:00–19:30','Ceturtdienās 18:00–19:30','10. nov. – 15. dec.']);
});

test('per-day times are listed and long lists are shortened',()=>{
 const slots=Array.from({length:9},(_,i)=>({date:'2026-11-'+String(10+i),start:i?'11:00':'10:00',end:'12:00'}));
 const lines=scheduleLines({schedule_kind:'dated',date_from:'2026-11-10',date_to:'2026-11-18',recurrence_slots:slots});
 assert.equal(lines.length,6);
 assert.equal(lines[0],'Ot, 10. nov. 10:00–12:00');
 assert.equal(lines.at(-1),'un vēl 4 dienas');
 const same=slots.map(slot=>({...slot,start:'10:00'}));
 assert.deepEqual(scheduleLines({schedule_kind:'dated',date_from:'2026-11-10',date_to:'2026-11-18',recurrence_slots:same}),['10.–18. novembris','Katru dienu 10:00–12:00']);
});

test('place lines for in-person, online and hybrid events',()=>{
 assert.deepEqual(placeLines({venue_name:'Sporta halle',address:'Sporta iela 1, Rīga'}),['Sporta halle','Sporta iela 1, Rīga']);
 assert.deepEqual(placeLines({venue_name:'Sporta halle',address:'Sporta halle'}),['Sporta halle']);
 assert.deepEqual(placeLines({attendance_mode:'online',venue_name:'Birojs'}),['Tiešsaistē']);
 assert.deepEqual(placeLines({attendance_mode:'hybrid',venue_name:'Zāle'}),['Zāle','Arī tiešsaistē']);
 assert.deepEqual(placeLines({}),['Vieta nav norādīta']);
});

test('price line and excerpt',()=>{
 assert.equal(priceLine({price_status:'free'}),'Bezmaksas');
 assert.equal(priceLine({price_status:'paid',price_min:5,price_max:10}),'5–10 €');
 assert.equal(priceLine({price_status:'paid'}),'Maksas');
 assert.equal(priceLine({price_status:'unknown'}),'');
 const long='vārds '.repeat(200);
 const short=excerpt(long,100);
 assert.ok(short.length<=100&&short.endsWith('…'));
 assert.equal(excerpt('<p>Īss  teksts</p>'),'Īss teksts');
});

test('flyer description gets the lines left under the other blocks',()=>{
 const short=flyerTextLines({title:'Koncerts',when:['Sestdiena, 12. decembris, 18:00'],where:['Zāle','Iela 1'],price:'Bezmaksas'});
 const long=flyerTextLines({title:'Ļoti garš pasākuma nosaukums, kas aizņem trīs rindas plakātā',when:['Otrdienās','Ceturtdienās','10. nov. – 15. dec.'],where:['Zāle','Iela 1','Arī tiešsaistē'],price:'5–8 €'});
 assert.ok(short>long,`short ${short} > long ${long}`);
 assert.ok(short<=8&&long>=0);
 assert.equal(flyerTextLines({title:'x'.repeat(200),when:Array(6).fill('d'),where:Array(3).fill('p'),price:'1 €'}),0);
});

test('status note explains private and waiting events',()=>{
 assert.match(sharedStatusNote({visibility:'private',status:'private'}),/Privāts/);
 assert.match(sharedStatusNote({visibility:'public',status:'pending_review'}),/gaida MEETS pārbaudi/);
 assert.match(sharedStatusNote({visibility:'public',status:'published',event_id:TOKEN}),/^Publisks pasākums — redzams MEETS kartē/);
});

test('flyer date mark shows weekdays, chosen days or a run of days',async()=>{
 const {flyerDateBadge,scheduleLines}=await import('../lib/shared-event.js');
 assert.deepEqual(flyerDateBadge({date_from:'2026-11-08'}),{kind:'day',main:'8',sub:'NOV'});
 assert.deepEqual(flyerDateBadge({date_from:'2026-11-08',date_to:'2026-11-10'}),{kind:'range',main:'8–10',sub:'NOV'});
 assert.deepEqual(flyerDateBadge({date_from:'2026-11-08',date_to:'2026-11-30',schedule_kind:'recurring',recurrence_slots:[{weekday:6},{weekday:3}]}),{kind:'weekly',main:'TR · SE',sub:'8.–30. NOV'});
 const dated={date_from:'2026-11-08',date_to:'2026-12-02',schedule_kind:'dated',recurrence_slots:['2026-11-08','2026-11-15','2026-12-02'].map(date=>({date,start:'17:00',end:'18:30'}))};
 assert.deepEqual(flyerDateBadge(dated),{kind:'dates',main:'8 · 15 · 2',sub:'NOV – DEC'});
 assert.deepEqual(scheduleLines(dated),['8., 15. nov.; 2. dec.','17:00–18:30']);
});

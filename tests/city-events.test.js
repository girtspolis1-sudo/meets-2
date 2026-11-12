import test from 'node:test';
import assert from 'node:assert/strict';
import {dayMonth,splitPlace,parseDaugavpils,parseJelgava,parseValmiera,parseCesis,uniqueItems} from '../supabase/functions/_shared/city-events.js';

test('dayMonth picks the year nearest after today',()=>{
 assert.equal(dayMonth('12','Nov','2026-11-12'),'2026-11-12');
 assert.equal(dayMonth('3','Jan','2026-11-12'),'2027-01-03');
 assert.equal(dayMonth('20','Okt','2026-11-12'),'2026-10-20');
 assert.equal(dayMonth('5','Xyz','2026-11-12'),null);
});

test('splitPlace keeps the venue name and the full address',()=>{
 assert.deepEqual(splitPlace('Kultūras nams, Lielā zāle, Kr. Barona iela 6, Jelgava'),{venue:'Kultūras nams',address:'Kultūras nams, Lielā zāle, Kr. Barona iela 6, Jelgava'});
 assert.deepEqual(splitPlace('18. novembra iela 8, Daugavpils'),{venue:'18. novembra iela 8, Daugavpils',address:'18. novembra iela 8, Daugavpils'});
 assert.deepEqual(splitPlace(''),{venue:null,address:null});
});

test('Daugavpils cards',()=>{
 const html='<div class="col-xs-6 col-sm-4 col-md-4 col-lg-3"> <a href="https://www.daugavpils.lv/afisa/koncerts-1" title="x"> <div class="event-date pink"> <span class="date">14</span> <span class="month">Nov</span> <span class="time">19:00</span> </div> <div class="event-text"> <h3>Koncerts &#8220;Rudens&#8221;</h3> <p class="place">Vienības nams, Rīgas iela 22a, Daugavpils</p> </div> </a> </div>'
  +'<div class="col-xs-6 col-sm-4 col-md-4 col-lg-3"> <a href="https://www.daugavpils.lv/afisa/bez-datuma"><h3>Bez datuma</h3></a></div>';
 const [e,...rest]=parseDaugavpils(html,'2026-11-12');
 assert.equal(rest.length,0,'a card without a date is skipped');
 assert.equal(e.title,'Koncerts “Rudens”');
 assert.equal(e.dateFrom,'2026-11-14');
 assert.equal(e.timeFrom,'19:00');
 assert.equal(e.venue,'Vienības nams');
 assert.equal(e.address,'Vienības nams, Rīgas iela 22a, Daugavpils');
 assert.equal(e.key,'/afisa/koncerts-1');
});

test('Jelgava cards, with the "changed" prefix removed and a date range',()=>{
 const html='<div class="events-wrap col-24"> <div class="events-dates"> <i></i> 13.11.2026 - 15.11.2026 </div> <div class="events-times"> <i></i> 12:00 - 14:30 </div>'
  +'<div class="events-title"> <a href="https://www.jelgava.lv/pasakumi/dzeja/"> MAINĪTS PASĀKUMA NORISES LAIKS! Dzejas konkurss</a> </div>'
  +'<div class="events-places"> <i></i> Muzejs, Akadēmijas iela 10, Jelgava </div> <div class="events-price"> Bez maksas </div></div>';
 const [e]=parseJelgava(html);
 assert.equal(e.title,'Dzejas konkurss');
 assert.equal(e.dateFrom,'2026-11-13');
 assert.equal(e.dateTo,'2026-11-15');
 assert.equal(e.timeFrom,'12:00');
 assert.equal(e.timeTo,'14:30');
 assert.equal(e.venue,'Muzejs');
 assert.equal(e.price_status,'free');
});

test('Valmiera JSON',()=>{
 const items=parseValmiera([
  {summary:'Grupas koncerts',content:'<p><strong>14. novembrī</strong> koncerts.</p>',startDate:'2026-11-14',endDate:'2026-11-14',
   link:'https://www.valmierasnovads.lv/events/koncerts/',timeFrom:'19:00',place:'Valmieras Kultūras centrā'},
  {summary:'Svešs',startDate:'2026-11-14',link:'https://example.lv/x'},
  {summary:'Bez datuma',link:'https://www.valmierasnovads.lv/events/y/'}]);
 assert.equal(items.length,1);
 assert.equal(items[0].venue,'Valmieras Kultūras centrā');
 assert.equal(items[0].description,'14. novembrī koncerts.');
 assert.equal(items[0].key,'/events/koncerts');
});

test('Cēsis rows with price',()=>{
 const html='<div class="row results-event"> <span class="date">12.11.2026</span> <span class="time">18:00</span> <a class="title" href="https://pasakumi.cesis.lv/pasakums/filma/">Filma</a> <span class="location">Jaunpiebalgas Kultūras centrs</span> <span class="price">3€</span></div>'
  +'<div class="row results-event"> <span class="date">12.11.2026</span> <span class="time"></span> <a class="title" href="https://pasakumi.cesis.lv/pasakums/stunda/">Stunda</a> <span class="location">Bibliotēka</span> <span class="price">Bez maksas</span></div>';
 const [a,b]=parseCesis(html);
 assert.equal(a.price_status,'paid');
 assert.equal(a.timeFrom,'18:00');
 assert.equal(b.timeFrom,null);
 assert.equal(b.price_status,'free');
});

test('uniqueItems drops a repeated key and date',()=>{
 const a={key:'/x',dateFrom:'2026-11-12'};
 assert.equal(uniqueItems([a,{...a},{key:'/x',dateFrom:'2026-11-13'}]).length,2);
});

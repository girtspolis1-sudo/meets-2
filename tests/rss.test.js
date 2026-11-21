import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEntities,detectClock,elementText,isRss,isSkipped,itemBlocks,parseRss,rigaTime,rssOccurrences,tvpUrlKey}
 from '../supabase/functions/sync-calendar-feeds/rss.js';

const item=fields=>'<item>\n'+Object.entries(fields).map(([k,v])=>`  <${k}>${v}</${k}>`).join('\n')+'\n</item>';
const feed=items=>`<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xcal="urn:ietf:params:xml:ns:xcal" version="2.0" xml:base="https://www.ropazi.lv/lv">
 <channel><title>Notikumi</title>
${items.join('\n')}
 </channel>
</rss>`;

// Real items from ropazi.lv and riga.lv (21.11.2026), dates as TVP writes them.
const market=item({category:'Pasākums',title:'Ziemassvētku tirdziņš',
 description:'Ropažu Kultūras centrā no plkst. 10.00 līdz 14.00 notiks &quot;Ziemassvētku tirdziņš 2026&quot;…',
 pubDate:'Mon, 09 Nov 2026 21:24:09 +0200',link:'https://www.ropazi.lv/lv/notikums/ziemassvetku-tirdzins',
 'guid isPermaLink="false"':'https://www.ropazi.lv/lv/notikums/ziemassvetku-tirdzins','dc:type':'Mājražotāju tirdziņš',
 'xcal:location':'Ropažu Kultūras centrs','xcal:dtstart':'2026-12-13T08:00:00+02:00','xcal:dtend':'2026-12-13T12:00:00+02:00'})
 .replace('</guid isPermaLink="false">','</guid>');
const bookDay=item({title:'"Es tā negribēju" – grāmatas atklāšana',pubDate:'Mon, 09 Nov 2026 20:41:21 +0200',
 link:'https://www.ropazi.lv/lv/notikums/es-ta-negribeju','dc:type':'Tikšanās','xcal:location':'Zaķumuižas bibliotēka',
 'xcal:dtstart':'2026-11-25T22:00:00+02:00','xcal:dtend':'2026-11-26T21:59:59+02:00'});
const exhibition=item({title:'Gleznu izstāde <![CDATA["Mājup" & draugi]]>',description:'&lt;p&gt;Pirmā rinda&lt;br&gt;Otrā &amp;amp; trešā&lt;/p&gt;',
 pubDate:'Wed, 11 Nov 2026 14:17:05 +0200',link:'https://www.tukums.lv/lv/notikums/gleznu-izstade-majup/','dc:type':'Izstādes',
 'xcal:location':'Tukuma muzejs','xcal:dtstart':'2026-11-08T22:00:00+02:00','xcal:dtend':'2027-01-04T21:59:59+02:00'});
const council=item({title:'Ropažu novada pašvaldības domes sēde',pubDate:'Thu, 12 Nov 2026 09:00:00 +0200',
 link:'https://www.ropazi.lv/lv/notikums/domes-sede-25','dc:type':'Domes sēde','xcal:location':'Ropažu pašvaldība',
 'xcal:dtstart':'2026-11-25T08:00:00+02:00','xcal:dtend':'2026-11-25T08:00:00+02:00'});
const committee=item({title:'Finanšu un administrācijas lietu komitejas sēde',pubDate:'Thu, 12 Nov 2026 09:00:00 +0200',
 link:'https://www.ropazi.lv/lv/notikums/komiteja-17','dc:type':'Pasākums','xcal:location':'Ropaži',
 'xcal:dtstart':'2026-12-17T08:00:00+02:00','xcal:dtend':'2026-12-17T08:00:00+02:00'});
const startOnly=item({title:'Adventes vainagu darbnīca',pubDate:'Mon, 16 Nov 2026 14:34:11 +0200',
 link:'https://www.adazunovads.lv/lv/notikums/adventes-darbnica','dc:type':'Darbnīca','xcal:location':'Ādažu Kultūras centrs',
 'dc:description':'Pieteikšanās līdz 25.11.2026.','xcal:dtstart':'2026-11-28T09:00:00+02:00','xcal:dtend':'2026-11-28T09:00:00+02:00'});
const overnight=item({title:'Jaunā gada svinības Tukumā',description:'Salūts un balle',pubDate:'Fri, 20 Nov 2026 15:18:31 +0200',
 link:'https://www.tukums.lv/lv/notikums/jauna-gada-svinibas','dc:type':'Pasākumi','xcal:location':'Tukuma laukums',
 'xcal:dtstart':'2026-12-31T21:00:00+02:00','xcal:dtend':'2027-01-01T00:00:00+02:00'});
const past=item({title:'Lāčplēša diena',pubDate:'Mon, 19 Oct 2026 13:56:11 +0300',link:'https://www.jelgavasnovads.lv/lv/notikums/lacplesa-diena',
 'dc:type':'Lāčplēša diena','xcal:location':'Jelgavas novads','xcal:dtstart':'2026-11-10T22:00:00+02:00','xcal:dtend':'2026-11-11T21:59:59+02:00'});

const SKIP=['domes sēde','komitejas sēde','komiteju sēde','ārkārtas sēde'];

test('feed format is recognised and items are found',()=>{
 const xml=feed([market,bookDay]);
 assert.equal(isRss(xml),true);
 assert.equal(isRss('BEGIN:VCALENDAR'),false);
 assert.equal(itemBlocks(xml).length,2);
});

test('entities, CDATA and escaped HTML become plain text',()=>{
 assert.equal(decodeEntities('a &amp; b &quot;c&quot; &#257; &#x16B; &nbsp;x &unknown;'),'a & b "c" ā ū  x &unknown;');
 assert.equal(elementText('<![CDATA[<b>Kalēju</b> & co]]> &amp; vēl'),'Kalēju & co & vēl');
 const [ex]=parseRss(feed([exhibition])).items;
 assert.equal(ex.title,'Gleznu izstāde "Mājup" & draugi');
 assert.equal(ex.description,'Pirmā rinda\nOtrā & trešā');
 const [m]=parseRss(feed([market])).items;
 assert.match(m.description,/"Ziemassvētku tirdziņš 2026"/);
});

test('TVP times are UTC clock times: shown in Riga',()=>{
 assert.equal(detectClock(itemBlocks(feed([market,bookDay]))),'utc');
 assert.deepEqual(rigaTime('2026-12-13T08:00:00+02:00'),{date:'2026-12-13',time:'10:00',seconds:'10:00:00'});
 assert.deepEqual(rigaTime('2026-07-01T08:00:00+03:00'),{date:'2026-07-01',time:'11:00',seconds:'11:00:00'},'summer +3');
 assert.deepEqual(rigaTime('2026-12-13T10:00:00+02:00','offset'),{date:'2026-12-13',time:'10:00',seconds:'10:00:00'});
 assert.deepEqual(rigaTime('2026-12-13T08:00:00Z','offset'),{date:'2026-12-13',time:'10:00',seconds:'10:00:00'});
 const [m]=parseRss(feed([market])).items;
 assert.deepEqual([m.dateFrom,m.dateTo,m.timeFrom,m.timeTo],['2026-12-13','2026-12-13','10:00','14:00']);
});

test('fixed offsets are used once TVP writes all-day events in local time',()=>{
 const fixed=bookDay.replace('2026-11-25T22:00:00','2026-11-26T00:00:00').replace('2026-11-26T21:59:59','2026-11-26T23:59:59');
 const fixedMarket=market.replace('T08:00','T10:00').replace('T12:00','T14:00');
 const {items,clock}=parseRss(feed([fixedMarket,fixed]));
 assert.equal(clock,'offset');
 assert.deepEqual(items.map(i=>[i.dateFrom,i.timeFrom,i.timeTo,i.allDay]),[['2026-12-13','10:00','14:00',false],['2026-11-26',null,null,true]]);
});

test('all-day, start-only, multi-day and overnight items',()=>{
 const items=parseRss(feed([bookDay,startOnly,exhibition,overnight])).items;
 const byTitle=Object.fromEntries(items.map(i=>[i.title,i]));
 const book=byTitle['"Es tā negribēju" – grāmatas atklāšana'];
 assert.deepEqual([book.dateFrom,book.dateTo,book.timeFrom,book.timeTo,book.allDay],['2026-11-26','2026-11-26',null,null,true]);
 const workshop=byTitle['Adventes vainagu darbnīca'];
 assert.deepEqual([workshop.timeFrom,workshop.timeTo],['11:00',null],'dtend = dtstart means no end time');
 assert.equal(workshop.description,'Pieteikšanās līdz 25.11.2026.','dc:description is used when description is missing');
 const ex=byTitle['Gleznu izstāde "Mājup" & draugi'];
 assert.deepEqual([ex.dateFrom,ex.dateTo,ex.timeFrom,ex.timeTo],['2026-11-09','2027-01-04',null,null]);
 const ny=byTitle['Jaunā gada svinības Tukumā'];
 assert.deepEqual([ny.dateFrom,ny.dateTo,ny.timeFrom,ny.timeTo],['2026-12-31','2027-01-01','23:00','02:00']);
});

test('item key and link are the normalised event page address',()=>{
 assert.equal(tvpUrlKey('https://www.ropazi.lv/lv/notikums/ziemassvetku-tirdzins?date=0'),'ropazi.lv/lv/notikums/ziemassvetku-tirdzins');
 assert.equal(tvpUrlKey('HTTP://Tukums.lv/lv/notikums/gleznu-izstade-majup/#top'),'tukums.lv/lv/notikums/gleznu-izstade-majup');
 assert.equal(tvpUrlKey(''),'');
 const [m]=parseRss(feed([market])).items;
 assert.equal(m.key,'ropazi.lv/lv/notikums/ziemassvetku-tirdzins');
 assert.equal(m.url,'https://www.ropazi.lv/lv/notikums/ziemassvetku-tirdzins');
 assert.deepEqual(m.categories,['Mājražotāju tirdziņš']);
 assert.equal(m.location,'Ropažu Kultūras centrs');
 assert.equal(m.pubDate,'2026-11-09T19:24:09.000Z');
});

test('council and committee sittings are skipped by type or title',()=>{
 assert.equal(isSkipped({title:'Koncerts',categories:['Domes un komiteju sēdes']},SKIP),true);
 assert.equal(isSkipped({title:'Domes ārkārtas sēde, 04.11.2026.',categories:['Pasākums']},SKIP),true);
 assert.equal(isSkipped({title:'Koncerts senioriem',categories:['Koncerts']},SKIP),false);
 assert.equal(isSkipped({title:'Domes sēde',categories:[]},[]),false,'nothing is skipped without a list');
 const r=rssOccurrences(feed([market,council,committee,startOnly]),{from:'2026-11-21',to:'2027-02-21',skipTypes:SKIP});
 assert.deepEqual(r.items.map(i=>i.title),['Adventes vainagu darbnīca','Ziemassvētku tirdziņš']);
 assert.equal(r.skipped,2);
});

test('window keeps running and coming items, drops past ones; oldest pubDate is reported',()=>{
 const r=rssOccurrences(feed([past,exhibition,overnight,market]),{from:'2026-11-21',to:'2026-12-31',skipTypes:SKIP});
 assert.deepEqual(r.items.map(i=>i.title),['Gleznu izstāde "Mājup" & draugi','Ziemassvētku tirdziņš','Jaunā gada svinības Tukumā']);
 assert.equal(r.count,4);
 assert.equal(r.oldestPub,'2026-10-19T10:56:11.000Z');
 const later=rssOccurrences(feed([overnight]),{from:'2026-11-21',to:'2026-12-30'});
 assert.equal(later.items.length,0,'starts after the window');
});

test('items without title or start are ignored',()=>{
 const broken=item({title:'Bez datuma',link:'https://www.preili.lv/lv/notikums/x'});
 const noTitle=item({link:'https://www.preili.lv/lv/notikums/y','xcal:dtstart':'2026-12-02T08:00:00+02:00'});
 assert.equal(parseRss(feed([broken,noTitle])).items.length,0);
});

test('Riga wall-clock times become UTC instants for occurrences',async()=>{
 const {rigaInstant}=await import('../supabase/functions/sync-calendar-feeds/rss.js');
 assert.equal(rigaInstant('2026-12-13','10:00'),'2026-12-13T08:00:00.000Z');
 assert.equal(rigaInstant('2026-07-01','11:00'),'2026-07-01T08:00:00.000Z');
 assert.equal(rigaInstant('2026-12-13',null),null);
});

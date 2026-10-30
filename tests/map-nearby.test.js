import test from 'node:test';
import assert from 'node:assert/strict';
import {periodKey,periodRange,weekendRange,dayGroup,whenLabel,nearbyGroups,distanceLabel,countLabel,priceLabel,widerOptions,periodPhrase} from '../lib/map-nearby.js';

// 2026-10-28 is a Wednesday, 2026-10-30 a Friday, 2026-11-01 a Sunday.
test('periods are rolling windows; old link names still work',()=>{
 assert.deepEqual(periodRange('7days','2026-10-30'),{from:'2026-10-30',to:'2026-11-05'});
 assert.deepEqual(periodRange('30days','2026-10-30','2026-11-15'),{from:'2026-10-30',to:'2026-11-15'});
 assert.deepEqual(periodRange('tomorrow','2026-10-30'),{from:'2026-10-31',to:'2026-10-31'});
 assert.equal(periodKey('week'),'7days');
 assert.equal(periodKey('month'),'30days');
 assert.equal(periodKey('nonsense'),'7days');
});

test('weekend is Friday to Sunday and starts today from Friday on',()=>{
 assert.deepEqual(weekendRange('2026-10-28'),{from:'2026-10-30',to:'2026-11-01'});
 assert.deepEqual(weekendRange('2026-10-30'),{from:'2026-10-30',to:'2026-11-01'});
 assert.deepEqual(weekendRange('2026-11-01'),{from:'2026-11-01',to:'2026-11-01'});
});

test('events are grouped by day, ongoing ones count as today',()=>{
 const today='2026-10-28';
 assert.equal(dayGroup({date_from:'2026-10-28'},today),'today');
 assert.equal(dayGroup({date_from:'2026-10-20',date_to:'2026-11-02'},today),'today');
 assert.equal(dayGroup({date_from:'2026-10-29'},today),'tomorrow');
 assert.equal(dayGroup({date_from:'2026-10-31'},today),'weekend');
 assert.equal(dayGroup({date_from:'2026-11-03'},today),'later');
 assert.equal(whenLabel({date_from:'2026-10-28',time_from:'18:00:00'},today),'Šodien 18:00');
 assert.equal(whenLabel({date_from:'2026-10-31',time_from:'14:00:00'},today),'S 31.10. 14:00');
 assert.equal(whenLabel({date_from:'2026-10-20',date_to:'2026-11-02',time_from:'10:00:00'},today),'Notiek šodien');
});

test('within a day the nearest event comes first',()=>{
 const origin={lat:56.95,lon:24.1};
 const groups=nearbyGroups([
  {title:'Tālu',date_from:'2026-10-28',latitude:57.5,longitude:25.4},
  {title:'Tuvu',date_from:'2026-10-28',latitude:56.96,longitude:24.11},
  {title:'Rīt',date_from:'2026-10-29',latitude:56.95,longitude:24.1}
 ],'2026-10-28',origin);
 assert.deepEqual(groups.map(g=>g.key),['today','tomorrow']);
 assert.deepEqual(groups[0].items.map(i=>i.event.title),['Tuvu','Tālu']);
 assert.equal(distanceLabel(groups[0].items[0].km),'1,3 km');
});

test('labels read naturally in Latvian',()=>{
 assert.equal(countLabel(1),'1 pasākums');
 assert.equal(countLabel(21),'21 pasākums');
 assert.equal(countLabel(11),'11 pasākumi');
 assert.equal(distanceLabel(0.4),'< 1 km');
 assert.equal(distanceLabel(42.4),'42 km');
 assert.equal(priceLabel({price_status:'free'}),'Bezmaksas');
 assert.equal(priceLabel({price_status:'paid',price_min:5,price_max:15}),'no 5 €');
 assert.equal(periodPhrase('weekend'),'šajā nedēļas nogalē');
 assert.deepEqual(widerOptions(30,'7days').map(o=>o.label),['Paplašināt līdz 50 km','Visa Latvija','Rādīt 30 dienas']);
});

test('live badges only for today, by the Riga clock',async()=>{
 const {liveBadge,isApproximatePlace}=await import('../lib/map-nearby.js');
 const today='2026-10-28';
 const event={date_from:today,time_from:'18:00:00',time_to:'20:00:00'};
 assert.equal(liveBadge(event,today,18*60+30),'now');
 assert.equal(liveBadge(event,today,16*60+30),'soon');
 assert.equal(liveBadge(event,today,12*60),'');
 assert.equal(liveBadge({...event,date_from:'2026-10-29'},today,18*60+30),'');
 assert.equal(isApproximatePlace({location_precision:'municipality_center'}),true);
 assert.equal(isApproximatePlace({location_precision:'venue'}),false);
});

test('day headings for date-sorted lists',async()=>{
 const {dayHeading}=await import('../lib/map-nearby.js');
 assert.equal(dayHeading({date_from:'2026-10-28'},'2026-10-28'),'Šodien');
 assert.equal(dayHeading({date_from:'2026-10-29'},'2026-10-28'),'Rīt');
 assert.equal(dayHeading({date_from:'2026-10-31'},'2026-10-28'),'Sestdiena, 31. oktobris');
});

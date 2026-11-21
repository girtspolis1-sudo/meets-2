import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDescription,eventJsonLd,eventTitle,isoWithZone,jsonLdScript,looksLikeTable,rigaOffset,shortDate} from '../lib/event-seo.js';

const base={id:'bbbc0627-fd81-489e-9fbc-909b74d32322',title:'Ziemassvētku koncerts novada senioriem',date_from:'2026-12-14',date_to:'2026-12-14',
 time_from:'13:00:00',time_to:'15:00:00',venue_name:'Kultūras centrs "Ulbrokas Pērle"',address_raw:'Kultūras centrs "Ulbrokas Pērle"',
 settlement:'Ulbroka',municipality:'Ropažu novads',country_code:'LV',latitude:56.94,longitude:24.29,primary_category:'Koncerts',
 status:'published',attendance_mode:'in_person',description:'Ieeja ar ielūgumiem.'};

test('times carry Riga offset; a date alone stays a date',()=>{
 assert.equal(rigaOffset('2026-12-14','13:00'),'+02:00');
 assert.equal(rigaOffset('2026-07-01','13:00'),'+03:00');
 assert.equal(isoWithZone('2026-12-14','13:00:00'),'2026-12-14T13:00:00+02:00');
 assert.equal(isoWithZone('2026-07-01','09:30'),'2026-07-01T09:30:00+03:00');
 assert.equal(isoWithZone('2026-12-14',null),'2026-12-14','no midnight placeholder');
 assert.equal(isoWithZone('',null),undefined);
});

test('schema.org Event: address, geo, offers, organizer',()=>{
 const d=eventJsonLd({...base,price_status:'free',organizer_name:'Ropažu KC',organization_id:'11111111-1111-4111-8111-111111111111'});
 assert.equal(d['@type'],'Event');
 assert.equal(d.startDate,'2026-12-14T13:00:00+02:00');
 assert.equal(d.endDate,'2026-12-14T15:00:00+02:00');
 assert.deepEqual(d.location.address,{'@type':'PostalAddress',addressCountry:'LV',addressLocality:'Ulbroka',addressRegion:'Ropažu novads'});
 assert.equal(d.location.geo.latitude,56.94);
 assert.deepEqual(d.offers,{'@type':'Offer',price:0,priceCurrency:'EUR',url:d.url});
 assert.equal(d.isAccessibleForFree,true);
 assert.equal(d.organizer.name,'Ropažu KC');
 assert.match(d.url,/\/pasakumi\/ziemassvetku-koncerts-novada-senioriem-ulbroka-bbbc0627$/);
 const street=eventJsonLd({...base,address_raw:'Institūta iela 1a, Ulbroka'});
 assert.equal(street.location.address.streetAddress,'Institūta iela 1a');
 const city=eventJsonLd({...base,settlement:null,municipality:'Rīgas valstspilsēta'});
 assert.equal(city.location.address.addressLocality,'Rīga');
 assert.equal(eventJsonLd({...base,price_min:12,price_status:'paid'}).offers.price,12);
 assert.equal(eventJsonLd(base).offers,undefined,'no price, no offer');
 assert.equal(eventJsonLd({...base,status:'cancelled'}).eventStatus,'https://schema.org/EventCancelled');
});

test('sports matches are SportsEvent with teams',()=>{
 const d=eventJsonLd({...base,title:'BK Ogre – VEF Rīga',home_team:'BK Ogre',away_team:'VEF Rīga',competition_name:'Optibet LBL',primary_category:'Basketbols'});
 assert.equal(d['@type'],'SportsEvent');
 assert.equal(d.homeTeam.name,'BK Ogre');
 assert.equal(d.awayTeam.name,'VEF Rīga');
 assert.equal(d.superEvent.name,'Optibet LBL');
});

test('titles add date and place within ~60 characters',()=>{
 assert.equal(shortDate('2026-12-13'),'13. dec.');
 assert.equal(eventTitle({title:'Ziemassvētku tirdziņš',date_from:'2026-12-13',settlement:'Ropaži'}),'Ziemassvētku tirdziņš, 13. dec., Ropaži');
 assert.equal(eventTitle({title:'Koncerts',date_from:'2026-12-13',municipality:'Rīgas valstspilsēta'}),'Koncerts, 13. dec., Rīga');
 const long=eventTitle({title:'Ļoti garš pasākuma nosaukums, kas aizņem gandrīz visu vietu virsrakstā',date_from:'2026-12-13',settlement:'Ropaži'});
 assert.ok(long.length<=62,long);
});

test('descriptions: table text and short text are replaced by the facts',()=>{
 const table='Vārds, uzvārds Mēneša diena (Princips) Laiks Nov Dec Jānis Tutins (Domes priekšsēdētājs) 1. otrdiena 12.30 – 15.30 3 1';
 assert.equal(looksLikeTable(table),true);
 assert.equal(looksLikeTable('Eiropas autoru dienas ietvaros radošas aktivitātes un tikšanās ar ilustratori un autori Marinu Heniņu.'),false);
 assert.equal(eventDescription({...base,description:table}),'Koncerts 14. decembrī plkst. 13:00, Kultūras centrs "Ulbrokas Pērle", Ulbroka.');
 assert.equal(eventDescription(base),'Koncerts 14. decembrī plkst. 13:00, Kultūras centrs "Ulbrokas Pērle", Ulbroka. Ieeja ar ielūgumiem.');
 const own='Eiropas autoru dienas ietvaros radošas aktivitātes un tikšanās ar ilustratori un autori Marinu Heniņu Zaķumuižā.';
 assert.equal(eventDescription({...base,description:own}),own);
 assert.ok(eventDescription({...base,description:own.repeat(4)}).length<=160);
 assert.equal(eventDescription({...base,description:'',home_team:'BK Ogre',away_team:'VEF Rīga',primary_category:'Basketbols'}),
  'BK Ogre – VEF Rīga. Spēle 14. decembrī plkst. 13:00, Kultūras centrs "Ulbrokas Pērle", Ulbroka.');
});

test('JSON for the script element cannot close it',()=>{
 assert.equal(jsonLdScript({name:'</script><b>'}),'{"name":"\\u003c/script>\\u003cb>"}');
});

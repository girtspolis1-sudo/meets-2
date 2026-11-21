import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryKeyFromSlug,eventPath,eventSlug,indexingAllowed,municipalityLocative,municipalitySlug,pageRobots,parseEventParam,siteRobots,slugify} from '../lib/seo.js';
import robots from '../app/robots.js';

const ID='bbbc0627-fd81-489e-9fbc-909b74d32322';

test('indexing is on only with NEXT_PUBLIC_ALLOW_INDEXING=true',()=>{
 assert.equal(indexingAllowed({NEXT_PUBLIC_ALLOW_INDEXING:'true'}),true);
 assert.equal(indexingAllowed({NEXT_PUBLIC_ALLOW_INDEXING:'TRUE '}),true);
 assert.equal(indexingAllowed({}),false);
 assert.equal(indexingAllowed({NEXT_PUBLIC_ALLOW_INDEXING:'1'}),false);
 assert.deepEqual(siteRobots({}),{index:false,follow:false});
 assert.deepEqual(siteRobots({NEXT_PUBLIC_ALLOW_INDEXING:'true'}),{index:true,follow:true});
 assert.deepEqual(pageRobots(false,{NEXT_PUBLIC_ALLOW_INDEXING:'true'}),{index:false,follow:true},'thin page: links still followed');
 assert.deepEqual(pageRobots(true,{}),{index:false,follow:false},'never indexed while the switch is off');
});

test('robots.txt blocks everything without the switch and points to the sitemap with it',()=>{
 const before=process.env.NEXT_PUBLIC_ALLOW_INDEXING;
 try{
  delete process.env.NEXT_PUBLIC_ALLOW_INDEXING;
  assert.deepEqual(robots(),{rules:[{userAgent:'*',disallow:'/'}]});
  process.env.NEXT_PUBLIC_ALLOW_INDEXING='true';
  const on=robots();
  assert.equal(on.rules[0].allow,'/');
  assert.deepEqual(on.rules[0].disallow,['/api/','/admin']);
  assert.match(on.sitemap,/\/sitemap\.xml$/);
 }finally{
  if(before===undefined)delete process.env.NEXT_PUBLIC_ALLOW_INDEXING;else process.env.NEXT_PUBLIC_ALLOW_INDEXING=before;
 }
});

test('slugs drop Latvian diacritics and punctuation',()=>{
 assert.equal(slugify('Ziemassvētku tirdziņš!'),'ziemassvetku-tirdzins');
 assert.equal(slugify('ĀČĒĢĪĶĻŅŠŪŽ Koncerts "Ulbrokas Pērle"'),'acegiklnsuz-koncerts-ulbrokas-perle');
 assert.equal(slugify('  '),'');
 assert.equal(slugify('a'.repeat(30)+' '+'b'.repeat(40),60),'a'.repeat(30),'cut at a word boundary');
});

test('event address: name, place and the id prefix; old ids are recognised',()=>{
 const event={id:ID,title:'Ziemassvētku tirdziņš',settlement:'Ropaži',municipality:'Ropažu novads'};
 assert.equal(eventSlug(event),'ziemassvetku-tirdzins-ropazi');
 assert.equal(eventPath(event),'/pasakumi/ziemassvetku-tirdzins-ropazi-bbbc0627');
 assert.equal(eventPath({...event,title:'Tirdziņš Ropažos',settlement:'Ropaži'}),'/pasakumi/tirdzins-ropazos-ropazi-bbbc0627');
 assert.equal(eventPath({...event,title:'Koncerts Ropaži'}),'/pasakumi/koncerts-ropazi-bbbc0627','place already in the name');
 assert.equal(eventPath({id:'nope'}),'/pasakumi');
 assert.deepEqual(parseEventParam(ID),{kind:'uuid',id:ID});
 assert.deepEqual(parseEventParam('ziemassvetku-tirdzins-ropazi-bbbc0627'),{kind:'key',prefix:'bbbc0627',slug:'ziemassvetku-tirdzins-ropazi'});
 assert.deepEqual(parseEventParam('riga'),{kind:'other',value:'riga'});
 assert.deepEqual(parseEventParam('adazu-novads'),{kind:'other',value:'adazu-novads'});
});

test('municipality addresses and words',()=>{
 assert.equal(municipalitySlug('Rīgas valstspilsēta'),'riga');
 assert.equal(municipalitySlug('Jelgavas valstspilsēta'),'jelgava');
 assert.equal(municipalitySlug('Jelgavas novads'),'jelgavas-novads');
 assert.equal(municipalitySlug('Ādažu novads'),'adazu-novads');
 assert.equal(municipalitySlug('Vairākas pašvaldības'),'');
 assert.equal(municipalityLocative('Rīgas valstspilsēta'),'Rīgā');
 assert.equal(municipalityLocative('Daugavpils valstspilsēta'),'Daugavpilī');
 assert.equal(municipalityLocative('Ādažu novads'),'Ādažu novadā');
 assert.equal(categoryKeyFromSlug('muzika'),'music');
 assert.equal(categoryKeyFromSlug('nav'),'');
});

test('the 42 municipality addresses are unique',()=>{
 const names=['Ādažu novads','Aizkraukles novads','Alūksnes novads','Augšdaugavas novads','Balvu novads','Bauskas novads','Cēsu novads',
  'Daugavpils valstspilsēta','Dienvidkurzemes novads','Dobeles novads','Gulbenes novads','Jēkabpils novads','Jelgavas novads',
  'Jelgavas valstspilsēta','Jūrmalas valstspilsēta','Ķekavas novads','Krāslavas novads','Kuldīgas novads','Liepājas valstspilsēta',
  'Limbažu novads','Līvānu novads','Ludzas novads','Madonas novads','Mārupes novads','Ogres novads','Olaines novads','Preiļu novads',
  'Rēzeknes novads','Rēzeknes valstspilsēta','Rīgas valstspilsēta','Ropažu novads','Salaspils novads','Saldus novads','Saulkrastu novads',
  'Siguldas novads','Smiltenes novads','Talsu novads','Tukuma novads','Valkas novads','Valmieras novads','Ventspils novads','Ventspils valstspilsēta'];
 const slugs=names.map(municipalitySlug);
 assert.equal(slugs.length,42);
 assert.equal(new Set(slugs).size,42);
 assert.ok(slugs.every(s=>/^[a-z0-9-]+$/.test(s)&&parseEventParam(s).kind==='other'));
});

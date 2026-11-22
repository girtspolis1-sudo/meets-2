import test from 'node:test';
import assert from 'node:assert/strict';
import {breadcrumbJsonLd,eventCrumbs,listingCrumbs} from '../lib/breadcrumbs.js';
import {SITE_URL} from '../lib/seo.js';

const event={id:'bbbc0627-fd81-489e-9fbc-909b74d32322',title:'Ziemassvētku tirdziņš',municipality:'Rīgas valstspilsēta',settlement:'Rīga'};
const riga={name:'Rīgas valstspilsēta',slug:'riga'};

test('event trail: home, events, municipality, event',()=>{
 const items=eventCrumbs(event);
 assert.deepEqual(items.map(i=>i.name),['Sākums','Pasākumi','Rīga','Ziemassvētku tirdziņš']);
 assert.equal(items[2].path,'/pasakumi/riga');
 assert.match(items[3].path,/^\/pasakumi\/ziemassvetku-tirdzins-.*bbbc0627$/);
 assert.deepEqual(eventCrumbs({...event,municipality:null}).map(i=>i.name),['Sākums','Pasākumi','Ziemassvētku tirdziņš'],'no municipality step');
});

test('listing trails',()=>{
 const names=x=>listingCrumbs(x).map(i=>i.name);
 assert.deepEqual(names({municipality:riga,heading:'Pasākumi Rīgā',path:'/pasakumi/riga'}),['Sākums','Pasākumi','Pasākumi Rīgā']);
 assert.deepEqual(names({municipality:riga,time:'rit',heading:'Pasākumi Rīgā rīt',path:'/pasakumi/riga/rit'}),['Sākums','Pasākumi','Rīga','Pasākumi Rīgā rīt']);
 assert.deepEqual(names({municipality:riga,category:'music',heading:'Mūzika un dejas Rīgā',path:'/pasakumi/k/muzika/riga'}),['Sākums','Pasākumi','Mūzika un dejas','Mūzika un dejas Rīgā']);
 assert.equal(listingCrumbs({municipality:riga,category:'music',heading:'x',path:'/x'})[2].path,'/pasakumi/k/muzika');
 assert.deepEqual(names({category:'sport',league:{slug:'optibet-lbl',name:'Optibet LBL'},heading:'Optibet LBL spēles',path:'/pasakumi/sports/optibet-lbl'}),['Sākums','Pasākumi','Sports','Optibet LBL spēles']);
});

test('BreadcrumbList with absolute addresses',()=>{
 const data=breadcrumbJsonLd(eventCrumbs(event));
 assert.equal(data['@type'],'BreadcrumbList');
 assert.deepEqual(data.itemListElement.map(i=>i.position),[1,2,3,4]);
 assert.equal(data.itemListElement[0].item,SITE_URL+'/');
 assert.ok(data.itemListElement.every(i=>i.item.startsWith(SITE_URL)));
});

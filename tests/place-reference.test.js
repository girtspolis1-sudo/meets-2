import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,csvObjects,centroidRow,institutionRow,chunks} from '../supabase/functions/_shared/place-reference.js';

test('parseCsv reads quoted commas, doubled quotes and line breaks',()=>{
 const rows=parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi"""\n2,"two\nlines",\n');
 assert.deepEqual(rows,[['a','b','c'],['1','x, y','say "hi"'],['2','two\nlines','']]);
});

test('csvObjects keys rows by the header',()=>{
 assert.deepEqual(csvObjects('KODS,STD\n"1","Pope, Popes pag., Ventspils nov."'),[{KODS:'1',STD:'Pope, Popes pag., Ventspils nov.'}]);
});

test('centroidRow keeps towns, parishes and villages with coordinates in Latvia',()=>{
 const base={KODS:'100101111',TIPS_CD:'106',NOSAUKUMS:'Gricgale',STD:'Gricgale, Pilskalnes pag., Aizkraukles nov.',DD_N:'56.222156',DD_E:'25.109515'};
 assert.deepEqual(centroidRow(base),['100101111','106','Gricgale','Gricgale, Pilskalnes pag., Aizkraukles nov.',56.222156,25.109515]);
 assert.equal(centroidRow({...base,TIPS_CD:'113'}),null,'a municipality is not a place');
 assert.equal(centroidRow({...base,DD_N:''}),null);
 assert.equal(centroidRow({...base,DD_N:'54.9',DD_E:'23.9'}),null,'outside Latvia');
});

test('institutionRow keeps venues and drops collectives, awards and rows without a point',()=>{
 const kn={Nozare:'Kultūras centri','Objekta veids':'Tautas nams','Objekta nosaukums':' Ābeļu  Tautas nams ','ISIL kods':'LV-KN-1',
  Adrese:'Aldaunes iela 13, Brodi, Ābeļu pag., Jēkabpils nov., LV-5212',LAT:'56.4712',LON:'25.9001','Objekta URL':'https://kulturasdati.lv/lv/x'};
 assert.deepEqual(institutionRow(kn),['LV-KN-1','Kultūras centri','Tautas nams','Ābeļu Tautas nams',
  'Aldaunes iela 13, Brodi, Ābeļu pag., Jēkabpils nov., LV-5212',56.4712,25.9001,'https://kulturasdati.lv/lv/x']);
 assert.equal(institutionRow({...kn,Nozare:'Mākslinieciskie kolektīvi'}),null);
 assert.equal(institutionRow({...kn,Nozare:'Arhitektūras gada balva'}),null);
 assert.equal(institutionRow({...kn,LAT:'',LON:''}),null);
 assert.equal(institutionRow({...kn,LAT:'0',LON:'0'}),null);
 assert.ok(institutionRow({...kn,Nozare:'Kultūrvēsturiskās vietas','Objekta veids':'Baznīca, kulta vieta'}));
 assert.equal(institutionRow({...kn,Nozare:'Kultūrvēsturiskās vietas','Objekta veids':'Arheoloģija'}),null);
 assert.equal(institutionRow({...kn,'Objekta URL':'javascript:alert(1)'})[7],'');
});

test('chunks splits a list',()=>{
 assert.deepEqual(chunks([1,2,3,4,5],2),[[1,2],[3,4],[5]]);
});

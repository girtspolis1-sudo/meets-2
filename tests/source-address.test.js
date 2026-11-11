import test from 'node:test';
import assert from 'node:assert/strict';
import {pageText,extractAddresses,fetchableUrl} from '../supabase/functions/_shared/source-address.js';

test('pageText drops scripts, navigation and footers and decodes entities',()=>{
 const html='<header>Rātslaukums 1, Bauska</header><nav>Izvēlne</nav><script>var a="Liepu iela 3";</script>'
  +'<p>Koncerts&nbsp;&amp; balle</p><div>Kalna iela&#32;18, Iecava</div><footer>Uzvaras iela 1, Bauska</footer>';
 assert.equal(pageText(html),'Koncerts & balle\nKalna iela 18, Iecava');
});

test('extractAddresses finds street addresses with the town that follows',()=>{
 const html='<p>Norises vieta: Iecavas kultūras nams, Rīgas iela 18, Iecava, Bauskas novads. Ieeja brīva.</p>'
  +'<p>Pieteikšanās: Skolas ielā 4A, Vecumnieki</p><p>Brīvības bulvāris 12-3</p>';
 assert.deepEqual(extractAddresses(html),['Rīgas iela 18, Iecava','Skolas ielā 4A, Vecumnieki','Brīvības bulvāris 12-3']);
});

test('extractAddresses does not glue a following word to the house number',()=>{
 assert.deepEqual(extractAddresses('<p>Lielā iela 5 Bauskā notiks tirgus</p>'),['Lielā iela 5']);
 assert.deepEqual(extractAddresses('<p>Lielā iela 5 B, Bauska</p>'),['Lielā iela 5 B, Bauska']);
});

test('extractAddresses repeats nothing, ignores text without a house number and stops at the limit',()=>{
 assert.deepEqual(extractAddresses('<p>Svētki Rīgas ielā un parkā</p>'),[]);
 assert.deepEqual(extractAddresses('<p>Parka iela 2, Ogre</p><p>Parka iela 2, Ogre</p>'),['Parka iela 2, Ogre']);
 const many=Array.from({length:12},(_,i)=>'<p>Dārza iela '+(i+1)+'</p>').join('');
 assert.equal(extractAddresses(many,5).length,5);
});

test('fetchableUrl allows public web pages only',()=>{
 assert.equal(fetchableUrl('https://www.bauskasnovads.lv/lv/pasakumi/x'),'https://www.bauskasnovads.lv/lv/pasakumi/x');
 for(const bad of ['ftp://example.lv/x','http://localhost/x','http://127.0.0.1/x','http://[::1]/x','https://user:pw@example.lv/','https://example.lv:8443/','file:///etc/passwd','nav adrese','http://intranet/x']){
  assert.equal(fetchableUrl(bad),null,bad);
 }
});

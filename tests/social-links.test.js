import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSocialLinks,normalizeSocialLink} from '../lib/social-links.js';

test('handles and links become clean https links',()=>{
 assert.equal(normalizeSocialLink('instagram','@marupes_kn'),'https://instagram.com/marupes_kn');
 assert.equal(normalizeSocialLink('tiktok','marupes'),'https://tiktok.com/@marupes');
 assert.equal(normalizeSocialLink('facebook','www.facebook.com/MarupesKN/'),'https://www.facebook.com/MarupesKN');
 assert.equal(normalizeSocialLink('youtube','http://youtube.com/@kanals'),'https://youtube.com/@kanals');
 assert.equal(normalizeSocialLink('x','https://twitter.com/meets'),'https://twitter.com/meets');
});

test('links to another site or odd text are dropped',()=>{
 assert.equal(normalizeSocialLink('instagram','https://evil.example/instagram'),'');
 assert.equal(normalizeSocialLink('facebook','mana lapa'),'');
 assert.equal(normalizeSocialLink('unknown','@x'),'');
});

test('only filled networks are kept, in a fixed order',()=>{
 assert.deepEqual(cleanSocialLinks({tiktok:'@a',facebook:'',instagram:'@b'}).map(x=>x.network),['instagram','tiktok']);
 assert.deepEqual(cleanSocialLinks([{network:'x',url:'@m'}]),[{network:'x',url:'https://x.com/m'}]);
});

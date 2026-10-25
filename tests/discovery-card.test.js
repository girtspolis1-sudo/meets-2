import test from 'node:test';
import assert from 'node:assert/strict';
import {cardCategory,cardDate,cardDescription,cardImage,cardLocation,cardPrice} from '../lib/discovery-card.js';

test('card keeps real event title, category and location',()=>{
 const event={title:'Pasākums Rīgā',event_type:'concert',venue_name:'Kultūras pils',date_from:'2026-11-02',time_from:'19:00'};
 assert.match(cardCategory(event),/Mūzika/);
 assert.equal(cardLocation(event),'Kultūras pils');
 assert.match(cardDate(event),/2026/);
 assert.match(cardDate(event),/19:00/);
});
test('price labels are grounded and do not invent price',()=>{
 assert.equal(cardPrice({price_status:'free'}),'Bezmaksas');
 assert.equal(cardPrice({price_status:'paid',price_min:8,price_max:15}),'8–15 €');
 assert.equal(cardPrice({price_status:'paid',price_min:12,price_max:12}),'No 12 €');
 assert.equal(cardPrice({price_status:'unknown'}),null);
});
test('missing image returns empty and content is condensed',()=>{
 assert.equal(cardImage({}), '');
 assert.equal(cardImage({cover_image_url:'javascript:alert(1)'}),'');
 assert.equal(cardImage({cover_image_url:'https://example.com/event.jpg'}),'https://example.com/event.jpg');
 assert.equal(cardDescription({description:'Pirmais  <strong>otrais</strong>   trešais'}),'Pirmais otrais trešais');
});

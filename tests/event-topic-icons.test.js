import test from 'node:test';
import assert from 'node:assert/strict';
import {eventTopicIcon,TOPIC_FALLBACK} from '../lib/event-map-icons.js';
import {isPaidEvent} from '../lib/discovery-card.js';

const icon=e=>eventTopicIcon(e).glyph;
test('card icon names the topic',()=>{
 assert.equal(icon({primary_category:'Pašvaldības darba kalendārs',title:'Transporta jautājumu komitejas sēde'}),'🏛️');
 assert.equal(icon({primary_category:'Dažādi',title:'Mazuļu tikšanās'}),'👶');
 assert.equal(icon({primary_category:'Seniori',title:'Datorapmācības senioriem'}),'🧓');
 assert.equal(icon({primary_category:'Kopienās',title:'Izstādes Aizkraukles novadā'}),'🖼️','a loose category gives way to the title');
 assert.equal(icon({primary_category:'Kino',title:'Kino seanss'}),'🎬');
 assert.equal(icon({primary_category:'Basketbols',event_type:'sports_match',title:'A – B',sport_format:'basketball'}),'🏀');
 assert.equal(icon({title:'Nezināms'}),TOPIC_FALLBACK.glyph);
});
test('paid events get the € mark',()=>{
 assert.equal(isPaidEvent({price_status:'paid'}),true);
 assert.equal(isPaidEvent({price_status:'free',price_min:5}),false);
 assert.equal(isPaidEvent({price_min:'3'}),true);
 assert.equal(isPaidEvent({}),false);
});

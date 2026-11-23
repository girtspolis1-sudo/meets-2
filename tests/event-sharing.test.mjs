import test from 'node:test';
import assert from 'node:assert/strict';
import {eventSharePath,eventShareUrl,eventShareTargets,nearbyMapPath,officialEventUrl} from '../lib/event-sharing.js';
const event={id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',title:'MEETS koncerts & draugi'};
test('individual share links are safe and do not expose account or location parameters',()=>{
 // Name plus the first 8 characters of the id; nothing else from the page or account.
 assert.equal(eventSharePath(event),'/pasakumi/meets-koncerts-draugi-9847198c');
 assert.equal(eventShareUrl(event,'https://meets.lv'), 'https://meets.lv/pasakumi/meets-koncerts-draugi-9847198c');
 assert.equal(eventSharePath({id:'invalid'}),'/pasakumi');
});
test('social links use properly encoded public event URL',()=>{
 const url=eventShareUrl(event);
 const targets=eventShareTargets(event,url);
 assert.equal(new URL(targets.whatsapp).searchParams.get('text'),'MEETS koncerts & draugi '+url);
 assert.equal(new URL(targets.telegram).searchParams.get('url'),url);
 assert.equal(new URL(targets.facebook).searchParams.get('u'),url);
 assert.equal(new URL(targets.x).searchParams.get('url'),url);
 assert.ok(targets.messenger.startsWith('fb-messenger://share/'));
});
test('official link only accepts HTTP(S)',()=>{
 assert.equal(officialEventUrl({sources:[{url:'javascript:alert(1)'},{url:'https://example.org/event'}]}),'https://example.org/event');
 assert.equal(officialEventUrl({sources:[]}),null);
});
test('nearby map link centres on the event place with a 20 km circle',()=>{
 assert.equal(nearbyMapPath({latitude:56.65123456,longitude:23.72,attendance_mode:'offline'}),'/karte?lat=56.65123&lon=23.72000&radius=20');
 assert.equal(nearbyMapPath({latitude:null,longitude:23.7}),null);
 assert.equal(nearbyMapPath({latitude:56.6,longitude:23.7,attendance_mode:'online'}),null);
});

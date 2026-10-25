import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:3000';
await mkdir('ux-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[320,390];
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const mockEvent={
 id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',
 title:'MEETS pārbaudes koncerts',description:'Aktuāls testa pasākums ar detalizētu aprakstu mobilā paneļa pārbaudei.',
 date_from:today,date_to:today,time_from:'16:00:00',time_to:'19:00:00',
 event_type:'concert',primary_category:'Koncerts',price_status:'free',status:'published',
 venue_name:'Rīgas centrs',address_raw:'Rīga, Latvija',
 municipality:'Rīga',settlement:'Rīga',country_code:'LV',
 latitude:56.9496,longitude:24.1052,location_precision:'verified',
 sources:[{source:'test.example',url:'https://example.com/events/test'}],tags:[]
};
const mockedCatalog={events:[mockEvent],window:{from:today,to:today},fetchedAt:new Date().toISOString(),competitions:[]};
let fails=0;
async function assertLayout(page,name,width){
 const metrics=await page.evaluate(()=>({
  viewport:window.innerWidth,
  body:document.body.scrollWidth,
  doc:document.documentElement.scrollWidth,
  height:window.innerHeight
 }));
 if(metrics.doc>metrics.viewport+2){
  fails++; console.error('Horizontal overflow',name,width,metrics);
 }else console.log('PASS viewport',name,width,metrics);
}
for(const width of cases){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
 await page.route('**/api/events*',route=>{console.log('Mock event request:',route.request().url());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockedCatalog)});});
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.home-landing').waitFor({timeout:30000});
  if(await page.locator('.meets-location-overlay').count())throw Error('Forced location dialog on homepage');
  try{await page.locator('.home-nearby-card').first().waitFor({timeout:9000});}
  catch{
   fails++;
   console.error('Missing home event cards',width,{
    hero:await page.locator('.home-landing').count(),
    nearby:await page.locator('.home-nearby').count(),
    body:(await page.locator('body').innerText()).slice(0,1400),
    errors:errors.slice(0,3)
   });
  }
  await assertLayout(page,'home',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-home.png',fullPage:true});
  await page.goto(base+'/karte?period=week',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.map-controls-overlay').waitFor({timeout:30000});
  const button=page.getByRole('button',{name:'Paplašinātie filtri'});
  await button.click();
  await page.locator('.map-advanced-panel').waitFor();
  const panelBounds=await page.locator('.map-advanced-panel').boundingBox();
  if(!panelBounds||panelBounds.x<-3||panelBounds.x+panelBounds.width>width+3){fails++;console.error('Filter panel clips viewport',width,panelBounds);}
  await page.getByRole('button',{name:'Aizvērt filtrus'}).click();
  const marker=page.locator('.event-drop-marker-wrap').first();
  await marker.waitFor({timeout:15000});
  await marker.click({force:true});
  await page.locator('.meets-mobile-event-sheet').waitFor({timeout:10000});
  const sheet=await page.locator('.meets-mobile-event-sheet').boundingBox();
  if(!sheet||sheet.x<0||sheet.x+sheet.width>width+2||sheet.y+sheet.height>844+2){
   fails++;console.error('Mobile event sheet outside viewport',width,sheet);
  }
  const actions=page.locator('.meets-mobile-sheet-event').first().locator('.meets-event-action-grid');
  await actions.waitFor();
  const layout=await actions.evaluate(el=>{
   const tiles=[...el.children],rects=tiles.map(x=>x.getBoundingClientRect());
   const wrap=el.getBoundingClientRect();
   return {count:rects.length,widths:rects.map(r=>r.width),heights:rects.map(r=>r.height),
    tops:rects.map(r=>r.top),right:Math.max(...rects.map(r=>r.right)),
    parentRight:wrap.right,icons:tiles.map(x=>x.querySelector('svg')?.getBoundingClientRect().width)};
  });
  if(layout.count!==5||Math.max(...layout.widths)-Math.min(...layout.widths)>1||
   Math.max(...layout.heights)-Math.min(...layout.heights)>1||
   Math.max(...layout.tops)-Math.min(...layout.tops)>1||
   layout.right>layout.parentRight+1||layout.icons.some(size=>size!==20)){
   fails++;console.error('Five circular actions do not fit a single row',width,layout);
  }else console.log('PASS five circular event actions',width,layout.widths);
  await actions.getByRole('button',{name:'Maršruts'}).click();
  const navigationChoices=await page.locator('.meets-mobile-sheet-event').first().locator('.meets-circle-options a').allTextContents();
  if(!navigationChoices.some(x=>x.includes('Google Maps'))||!navigationChoices.some(x=>x.includes('Waze'))){
   fails++;console.error('Missing route links',width,navigationChoices);
  }
  await actions.getByRole('button',{name:'Maršruts'}).click();
  await actions.getByRole('button',{name:'Dalīties ar pasākumu'}).click();
  const sharing=page.locator('.meets-mobile-sheet-event').first().locator('.meets-circle-options');
  await sharing.waitFor();
  const names=await sharing.locator('a').allTextContents();
  if(!['WhatsApp','Messenger','Telegram','Facebook','X'].every(n=>names.includes(n))||
   !(await sharing.getByRole('button',{name:/Kopēt saiti/}).count())){
   fails++;console.error('Missing social sharing targets',width,names);
  }
  const whatsapp=await sharing.getByRole('link',{name:'WhatsApp'}).getAttribute('href');
  if(!whatsapp?.includes(encodeURIComponent(mockEvent.id))){
   fails++;console.error('Share URL missing event ID',width,whatsapp);
  }
  await actions.getByRole('button',{name:'Dalīties ar pasākumu'}).click();
  await actions.getByRole('button',{name:'Saglabāt pasākumu'}).click();
  if((await actions.getByRole('button',{name:'Noņemt no saglabātajiem'}).count())!==1){
   fails++;console.error('Favorite save state not reflected',width);
  }
  await page.getByRole('button',{name:'Aizvērt pasākumu informāciju'}).click();
  await assertLayout(page,'map',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-map.png',fullPage:true});
  await page.goto(base+'/pasakumi',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.catalog-view-switch').waitFor({timeout:30000});
  if(!(await page.getByRole('button',{name:/Kartītes/}).getAttribute('aria-pressed'))?.includes('true')){fails++;console.error('Card view is not active by default');}
  const catalogCircles=page.locator('.catalog-event-card .meets-circle-actions').first();
  await catalogCircles.waitFor();
  if(await catalogCircles.locator(':scope > *').count()!==5){
   fails++;console.error('Catalog lacks five circular actions',width);
  }
  await page.goto(base+'/pasakumi?event='+mockEvent.id,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.event-dialog[open]').waitFor({timeout:20000});
  if(!(await page.locator('.event-dialog .meets-circle-actions').count())){
   fails++;console.error('Shareable catalog deep link lacks event actions',width);
  }
  await page.getByRole('button',{name:'Aizvērt ✕'}).click();
  await assertLayout(page,'catalog',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-catalog.png',fullPage:true});
  // Exercise account location following without touching real user records or production data.
  let followed=[];
  await page.route('**/api/account',async route=>{
   const body=route.request().postDataJSON()||{};
   if(body.action==='locationFollows')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({locations:followed})});
   if(body.action==='followLocation'){
    if(body.enabled)followed=[{location_key:body.locationKey,location_name:body.locationName,municipality:body.municipality}];
    else followed=followed.filter(x=>x.location_key!==body.locationKey);
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
   }
   if(body.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({favorites:[mockEvent.id],plans:[],visits:[]})});
   if(body.action==='dashboard')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    interests:[],reminders:[],notices:[],follows:[],shared:null,
    directory:{organizations:[],venues:[],sources:[]},followedEvents:[],savedDetails:[],locationFollows:followed
   })});
   return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Unsupported test action"}'});
  });
  await page.evaluate(()=>localStorage.setItem('meets_user_session_v1',JSON.stringify({
   access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,
   expires_at:Date.now()+3600000,user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',email:'test@example.com'}
  })));
  await page.reload({waitUntil:'domcontentloaded'});
  const followButton=page.locator('.catalog-event-card .catalog-follow-place').first();
  await followButton.waitFor({timeout:15000});
  await followButton.click();
  await page.getByText('Tagad seko vietai', {exact:false}).waitFor({timeout:10000});
  if((await followButton.getAttribute('aria-pressed'))!=='true'){
   fails++;console.error('Catalog venue follow state was not updated',width);
  }
  const place=followed[0];
  if(!place?.location_key){fails++;console.error('Catalog venue follow did not persist',width);}
  else{
   await page.getByLabel('Filtrēt pēc norises vietas').selectOption(place.location_key);
   if(!(await page.locator('.catalog-event-card').count())){fails++;console.error('Place filtering hides its own events',width);}
  }
  await page.goto(base+'/mani-pasakumi?view=following',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.meets-account-page').waitFor({timeout:30000});
  await page.locator('.meets-followed-venue').first().waitFor({timeout:15000});
  const accountEvents=await page.locator('.meets-followed-venue').first().innerText();
  if(!accountEvents.includes('MEETS pārbaudes koncerts')){fails++;console.error('Followed venue misses upcoming event',width);}
  await page.getByRole('button',{name:'Pārskats'}).click();
  const accountActions=page.locator('.meets-personal-event .meets-circle-actions').first();
  if(await accountActions.count()){
   const stats=await accountActions.evaluate(element=>{
    const rects=[...element.children].map(child=>child.getBoundingClientRect());
    return {count:rects.length,widths:rects.map(r=>r.width),tops:rects.map(r=>r.top),right:Math.max(...rects.map(r=>r.right)),max:element.getBoundingClientRect().right};
   });
   if(stats.count!==5||Math.min(...stats.widths)<43.5||Math.max(...stats.widths)-Math.min(...stats.widths)>1||
     Math.max(...stats.tops)-Math.min(...stats.tops)>1||stats.right>stats.max+1){
    fails++;console.error('Personal event buttons not equal in one row',width,stats);
   }
  }
  await assertLayout(page,'personal',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-personal.png',fullPage:true});
  if(errors.length){fails++;console.error('Client errors',width,errors.slice(0,3));}
 }catch(error){fails++;console.error('Smoke test failed',width,error.message,errors.slice(0,3));try{console.error('Body:',(await page.locator('body').innerText()).slice(0,1000));await page.screenshot({path:'ux-screenshots/'+width+'-failure.png',fullPage:true});}catch{}}
 await page.close();
}
// Desktop Leaflet popups are generated as HTML, so test them separately from React panels.
const desktop=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
await desktop.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
await desktop.route('**/api/events*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockedCatalog)}));
try{
 await desktop.goto(base+'/karte?period=week',{waitUntil:'domcontentloaded',timeout:45000});
 const marker=desktop.locator('.event-drop-marker-wrap').first();
 await marker.waitFor({timeout:20000});
 await marker.click({force:true});
 const popup=desktop.locator('.leaflet-popup-content .meets-circle-actions').first();
 await popup.waitFor({timeout:15000});
 const count=await popup.locator(':scope > *').count();
 if(count!==5){fails++;console.error('Desktop popup requires five action icons, got',count);}
 const icons=await popup.locator('svg').count();
 if(icons!==5){fails++;console.error('Desktop popup requires five SVG icons, got',icons);}
 await popup.getByRole('button',{name:'Dalīties ar pasākumu'}).click();
 const panel=desktop.locator('.leaflet-popup-content .meets-popup-share-options').first();
 if(await panel.isHidden()){fails++;console.error('Desktop sharing fallback did not open');}
 const telegram=await panel.getByRole('link',{name:'Telegram'}).getAttribute('href');
 if(!telegram?.includes(encodeURIComponent(mockEvent.id))){fails++;console.error('Desktop sharing URL wrong',telegram);}
 await desktop.screenshot({path:'ux-screenshots/desktop-map-actions.png',fullPage:true});
 await assertLayout(desktop,'desktop-map',1280);
}catch(error){fails++;console.error('Desktop popup failed',error.message);}
await desktop.close();
// Organizer registration: search-first selection and map confirmation on compact phones.
for(const width of [320,390]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const orgId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb51';
 const venueId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb52';
 await page.addInitScript(()=>{
  localStorage.setItem('meets_user_session_v1',JSON.stringify({access_token:'organizer-test',user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51'}}));
 });
 await page.route('**/api/organizer',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   organizations:[{id:orgId,name:'MEETS Testa organizācija',kind:'organizer',owner_id:orgId}],
   venues:[{id:venueId,organization_id:orgId,name:'MEETS Sporta halle',address:'Sporta iela 1, Rīga',latitude:56.9496,longitude:24.1052,directions:'',description:''}],
   submissions:[]})});
  return route.fulfill({status:200,contentType:'application/json',body:'{"item":{}}'});
 });
 await page.route('**/api/venue-catalog*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
  locations:[{id:'public:1',name:'Rīgas koncertzāle',address:'Koncertu iela 2, Rīga',latitude:56.96,longitude:24.12}]})}));
 await page.route('**/api/geocode',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:'Rīga, Latvija',results:[]})}));
 try{
  await page.goto(base+'/organizators',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('button',{name:/Vietas/}).click();
  const picker=page.locator('.meets-location-picker').first();
  await picker.waitFor();
  if(await page.locator('.meets-organizer-location-details').count()){
   fails++;console.error('Venue details appeared before location selection',width);
  }
  await picker.getByRole('button',{name:/Izvēlēties punktu kartē/}).click();
  const dialog=page.locator('.meets-pin-dialog');
  await dialog.waitFor();
  if(!(await dialog.isVisible())||(await dialog.getByRole('button',{name:'Apstiprināt šo vietu'}).isEnabled())){
   fails++;console.error('Map picker should start without selected point',width);
  }
  await dialog.getByRole('button',{name:'Aizvērt karti'}).click();
  await picker.getByRole('searchbox',{name:'Meklē vietu vai adresi'}).fill('Rīgas koncertzāle');
  const match=picker.getByRole('button',{name:/Rīgas koncertzāle/}).first();
  await match.waitFor({timeout:15000});
  await match.click();
  await dialog.waitFor();
  await dialog.getByRole('button',{name:'Apstiprināt šo vietu'}).click();
  await page.locator('.meets-organizer-location-details').waitFor();
  if(!(await picker.getByRole('button',{name:/Mainīt atrašanās vietu/}).count())){
   fails++;console.error('Confirmed venue missing edit map control',width);
  }
  await assertLayout(page,'organizer-venue',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-organizer-venue.png',fullPage:true});
  await page.getByRole('button',{name:/Pasākumi \(/}).click();
  await page.getByRole('button',{name:/Jauns pasākums/}).click();
  await page.locator('.meets-wizard-step input[placeholder="Kā sauc pasākumu?"]').fill('MEETS testa koncerts');
  await page.getByRole('button',{name:'Turpināt →'}).click();
  await page.locator('.meets-wizard-step .meets-location-picker').waitFor();
  const eventPicker=page.locator('.meets-wizard-step .meets-location-picker');
  await eventPicker.getByRole('searchbox',{name:'Meklē vietu vai adresi'}).fill('MEETS Sporta halle');
  await eventPicker.getByRole('button',{name:/MEETS Sporta halle/}).click();
  await page.locator('.meets-pin-dialog').getByRole('button',{name:'Apstiprināt šo vietu'}).click();
  await page.locator('.meets-location-existing-info').waitFor();
  await assertLayout(page,'organizer-event',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-organizer-event.png',fullPage:true});
 }catch(error){
  fails++;console.error('Organizer UX smoke failed',width,error.message);
  try{await page.screenshot({path:'ux-screenshots/'+width+'-organizer-failure.png',fullPage:true});}catch{}
 }
 await page.close();
}

// First-time user: event form first, sign-in only after preview, without losing data.
for(const width of [320,390]){
 const p=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Riga'}).format(new Date(Date.now()+86400000));
 const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.route('**/api/venue-catalog*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"locations":[]}'}));
 try{
  await p.goto(base+'/registre-pasakumu',{waitUntil:'domcontentloaded'});
  if(!(await p.getByRole('link',{name:/Pievienot pasākumu/}).count())||!(await p.getByRole('link',{name:/Pievienot vietu/}).count())){
   fails++;console.error('Entry choice missing on phone',width);
  }
  await p.getByRole('link',{name:/Pievienot pasākumu/}).first().click();
  const form=p.locator('.quick-flow-card');
  await form.getByPlaceholder('Piemēram, Ģimenes sporta diena').fill('MEETS mobilais pasākums');
  await form.locator('input[type=date]').first().fill(day);
  await form.getByRole('button',{name:/Nevari atrast vietu/}).click();
  await form.getByRole('textbox',{name:'Adrese manuāli'}).fill('Sporta iela 1, Rīga');
  await form.getByRole('button',{name:'Turpināt ar šo adresi'}).click();
  await form.getByRole('textbox',{name:/Norises vietas nosaukums/}).fill('MEETS Sporta zāle');
  await form.getByRole('button',{name:/Priekšskatīt un turpināt/}).click();
  if(!(await p.getByText('MEETS mobilais pasākums').count())){fails++;console.error('Preview lost event title',width);}
  await p.getByRole('button',{name:/Iesniegt pārbaudei/}).click();
  if(!(await p.getByRole('heading',{name:'Pieslēgties un turpināt'}).count())){fails++;console.error('Anonymous event flow should request login at end',width);}
  const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('meets_event_draft_v2')||'{}'));
  if(stored.title!=='MEETS mobilais pasākums'||stored.venue_name!=='MEETS Sporta zāle'){fails++;console.error('Draft lost when requesting login',width);}
  await assertLayout(p,'quick-event',width);
  await p.screenshot({path:'ux-screenshots/'+width+'-quick-event.png',fullPage:true});
  if(width===390){
   let submitted=null;
   await p.route('**/api/account',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    access_token:'mock-user-session',refresh_token:'mock-refresh',expires_in:3600,
    user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',email:'test@example.com'}
   })}));
   await p.route('**/api/organizer',route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     organizations:[{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',name:'Testa organizators'}],
     venues:[],submissions:[]})});
    if(body.action==='saveEvent'){
     submitted=body;
     return route.fulfill({status:200,contentType:'application/json',body:'{"item":{"id":"9847198c-66d5-4bd1-8f2e-3b2f3a86bb51","status":"pending_review"}}'});
    }
    return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Unsupported mock"}'});
   });
   await p.getByRole('textbox',{name:'E-pasts'}).fill('test@example.com');
   await p.getByLabel('Parole',{exact:true}).fill('example-password');
   await p.getByRole('button',{name:'Pieslēgties →'}).click();
   await p.getByRole('button',{name:/Iesniegt pārbaudei/}).waitFor({timeout:12000});
   await p.getByRole('button',{name:/Iesniegt pārbaudei/}).click();
   await p.getByRole('heading',{name:'Pasākums nosūtīts pārbaudei!'}).waitFor({timeout:12000});
   if(submitted?.venue_name!=='MEETS Sporta zāle'||submitted?.status!=='pending_review'||submitted?.date_from!==day){
    fails++;console.error('New event submission lost data after in-place login',submitted);
   }
   // Recurrence + per-day time + EUR price should persist as one series to moderation.
   await p.getByRole('button',{name:/Pievienot nākamo pasākumu/}).click();
   const next=p.locator('.quick-flow-card');
   await next.getByPlaceholder('Piemēram, Ģimenes sporta diena').fill('Regulārās sporta nodarbības');
   await next.locator('select').first().selectOption('recurring');
   const end=new Date(day+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+15);
   await next.locator('input[type=date]').nth(0).fill(day);
   await next.locator('input[type=date]').nth(1).fill(end.toISOString().slice(0,10));
   await next.getByRole('button',{name:'+ Laiks'}).first().click();
   await next.locator('select').last().selectOption('paid');
   await next.locator('input[type=number]').nth(0).fill('9.50');
   await next.locator('input[type=number]').nth(1).fill('15.00');
   await next.getByRole('button',{name:/Nevari atrast vietu/}).click();
   await next.getByRole('textbox',{name:'Adrese manuāli'}).fill('Sporta iela 1, Rīga');
   await next.getByRole('button',{name:'Turpināt ar šo adresi'}).click();
   await next.getByRole('textbox',{name:/Norises vietas nosaukums/}).fill('MEETS Sporta zāle');
   await next.getByRole('button',{name:/Priekšskatīt un turpināt/}).click();
   await p.getByText('Norises reizes:',{exact:false}).waitFor({timeout:10000});
   await p.getByRole('button',{name:/Iesniegt pārbaudei/}).click();
   await p.getByRole('heading',{name:'Pasākums nosūtīts pārbaudei!'}).waitFor({timeout:10000});
   if(submitted?.schedule_kind!=='recurring'||submitted?.price_min!=='9.50'||
     submitted?.price_max!=='15.00'||submitted?.recurrence_slots?.length!==1){
     fails++;console.error('Recurring paid event payload is invalid',submitted);
   }
  }
  await p.goto(base+'/registre-vietu',{waitUntil:'domcontentloaded'});
  await p.locator('.meets-location-picker').waitFor({timeout:12000});
  await assertLayout(p,'quick-venue',width);
  await p.screenshot({path:'ux-screenshots/'+width+'-quick-venue.png',fullPage:true});
  if(errors.length){fails++;console.error('Quick entry JS errors',width,errors.slice(0,3));}
 }catch(e){fails++;console.error('Quick flow mobile smoke failed',width,e.message,errors.slice(0,3));}
 await p.close();
}

await browser.close();
if(fails){console.error('UX smoke failures:',fails);process.exit(1);}
console.log('PASS: mobile smoke checks at 320px and 390px');

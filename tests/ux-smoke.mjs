import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:3000';
await mkdir('ux-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[360,390];
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
  await page.locator('.meets-discovery-hero').waitFor({timeout:30000});
  if(await page.locator('.meets-location-overlay').count())throw Error('Forced location dialog on homepage');
  try{await page.locator('.meets-discovery-grid .meets-discovery-card').first().waitFor({timeout:9000});}
  catch{
   fails++;
   console.error('Missing home event cards',width,{
    hero:await page.locator('.meets-discovery-hero').count(),
    nearby:await page.locator('.meets-discovery-grid').count(),
    body:(await page.locator('body').innerText()).slice(0,1400),
    errors:errors.slice(0,3)
   });
  }
  const homeCard=page.locator('.meets-discovery-grid .meets-discovery-card').first();
  if(!await homeCard.getByRole('link',{name:/Skatīt vairāk/}).count()) {fails++;console.error('Home card CTA missing',width);}
  if(!await page.getByRole('navigation',{name:'Mobilā ātrā navigācija'}).isVisible()) {fails++;console.error('Mobile bottom navigation missing',width);}
  if(!await homeCard.getByRole('button',{name:'Saglabāt pasākumu'}).count()) {fails++;console.error('Card favorite missing',width);}
  if(!(await page.getByRole('link',{name:/Skatīt pasākumus/}).count())){fails++;console.error('Missing primary hero CTA',width);}
  if((await page.getByRole('navigation',{name:'MEETS iespējas'}).locator('a').count())!==4){fails++;console.error('Missing functional home benefit links',width);}
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
  const nearVenue=page.locator('.meets-mobile-sheet-title .meets-sheet-venue-follow');
  if(!(await nearVenue.getByRole('button',{name:/Sekot norises vietai/}).count())){
   fails++;console.error('Missing venue follow next to location title',width);
  }
  if(await page.locator('.meets-mobile-sheet-event .meets-place-favorite').count()){
   fails++;console.error('Venue follow duplicated under event actions',width);
  }
  if(!(await page.locator('.meets-mobile-sheet-event.is-highlighted').count())){
   fails++;console.error('Selected event is not visually highlighted',width);
  }
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
  if((await actions.locator('.meets-quiet-label').count())!==5){
   fails++;console.error('Quiet actions missing visible descriptions',width);
  }
  if(layout.count!==5||Math.max(...layout.widths)-Math.min(...layout.widths)>1||
   Math.max(...layout.heights)-Math.min(...layout.heights)>1||
   Math.max(...layout.tops)-Math.min(...layout.tops)>1||
   layout.right>layout.parentRight+1||layout.icons.some(size=>size!==18)||Math.min(...layout.widths)<44||Math.min(...layout.heights)<44){
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
  await page.locator('.catalog-event-card .meets-card-secondary-actions summary').first().click();
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
  const followButton=page.locator('.catalog-event-card .meets-place-favorite button').first();
  await followButton.waitFor({timeout:15000});
  await followButton.click();
  await page.getByText('Tagad seko šai norises vietai.', {exact:false}).waitFor({timeout:10000});
  if((await followButton.getAttribute('aria-pressed'))!=='true'){
   fails++;console.error('Catalog venue follow state was not updated',width);
  }
  const place=followed[0];
  if(!place?.location_key){fails++;console.error('Catalog venue follow did not persist',width);}
  else{
   await page.getByLabel('Filtrēt pēc norises vietas').selectOption(place.location_key);
   if(!(await page.locator('.catalog-event-card').count())){fails++;console.error('Place filtering hides its own events',width);}
  }
  // Followed places are listed on the following page linked from the catalogue.
  await page.getByRole('link',{name:/Manas sekotās vietas/}).click();
  await page.locator('.following-page').waitFor({timeout:30000});
  if(place?.location_name)await page.locator('.following-page .org-row strong',{hasText:place.location_name}).first().waitFor({timeout:15000});
  await page.goto(base+'/mani-pasakumi',{waitUntil:'domcontentloaded',timeout:45000});
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
const desktop=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await desktop.addInitScript(()=>{
 Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
 localStorage.setItem('meets_user_session_v1',JSON.stringify({access_token:'desktop-test-token',user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51'},expires_at:Date.now()+3600000}));
});
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
 if(await popup.locator('.popup-add-list').count()){fails++;console.error('Desktop popup still shows the removed list action');}
 await desktop.screenshot({path:'ux-screenshots/desktop-map-actions.png',fullPage:true});
 await assertLayout(desktop,'desktop-map',1440);
}catch(error){fails++;console.error('Desktop popup failed',error.message);}
await desktop.close();
// Organizer workspace and scoped venue/event editors on compact phones.
for(const width of [360,390]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const orgId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb51';
 const venueId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb52';
 await page.addInitScript(()=>localStorage.setItem('meets_user_session_v1',JSON.stringify({
  access_token:'organizer-test',refresh_token:'organizer-refresh',
  user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',email:'organizer@example.com'}
 })));
 await page.route('**/api/organizer',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   organizations:[{id:orgId,name:'MEETS Testa organizācija',kind:'organizer',owner_id:orgId,role:'owner',description:'Testa organizators',is_public:false}],
   venues:[{id:venueId,organization_id:orgId,name:'MEETS Sporta halle',address:'Sporta iela 1, Rīga',latitude:56.9496,longitude:24.1052,directions:'',description:'',is_public:true}],
   publicVenues:[],venueLinks:[{organization_id:orgId,venue_id:venueId,relation_type:'managed'}],submissions:[]
  })});
  if(body.action==='saveEvent')return route.fulfill({status:200,contentType:'application/json',body:'{"item":{"id":"9847198c-66d5-4bd1-8f2e-3b2f3a86bb59","status":"draft"}}'});
  return route.fulfill({status:200,contentType:'application/json',body:'{"item":{}}'});
 });
 await page.route('**/api/registries',route=>route.fulfill({status:200,contentType:'application/json',body:'{"registries":[],"profile":{"display_name":""}}'}));
 await page.route('**/api/venue-catalog*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
  locations:[{id:'public:1',name:'Rīgas koncertzāle',address:'Koncertu iela 2, Rīga',latitude:56.96,longitude:24.12}]})}));
 await page.route('**/api/geocode',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:'Rīga, Latvija',results:[]})}));
 try{
  await page.goto(base+'/organizators?org='+orgId+'&panel=venues',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('heading',{name:'MEETS Testa organizācija'}).waitFor({timeout:15000});
  await page.getByRole('link',{name:/Pievienot adresi/}).first().waitFor();
  await assertLayout(page,'organizer-venues',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-organizer-venues.png',fullPage:true});

  await page.goto(base+'/registre-vietu?org='+orgId,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.meets-location-picker').waitFor({timeout:15000});
  await page.locator('.venue-editor').getByText('MEETS Testa organizācija',{exact:false}).first().waitFor();
  await assertLayout(page,'venue-editor',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-venue-editor.png',fullPage:true});

  await page.goto(base+'/registre-pasakumu/vienkarsi?org='+orgId,{waitUntil:'domcontentloaded',timeout:45000});
  const editor=page.locator('.unified-event-editor');
  await editor.waitFor({timeout:15000});
  await editor.getByPlaceholder('Piemēram, Ģimenes sporta diena').fill('MEETS testa koncerts');
  await editor.getByText('MEETS Testa organizācija',{exact:false}).first().waitFor();
  await assertLayout(page,'event-editor',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-event-editor.png',fullPage:true});
 }catch(error){
  fails++;console.error('Organizer UX smoke failed',width,error.message);
  try{await page.screenshot({path:'ux-screenshots/'+width+'-organizer-failure.png',fullPage:true});}catch{}
 }
 await page.close();
}

// Organizer quick entry: a saved address is required, then preview and moderation.
for(const width of [360,390]){
 const p=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Riga'}).format(new Date(Date.now()+86400000));
 const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 const orgId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb51';
 const venueId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb52';
 let submitted=null;
 await p.addInitScript(()=>localStorage.setItem('meets_user_session_v1',JSON.stringify({
  access_token:'quick-flow-test',refresh_token:'quick-flow-refresh',expires_in:3600,expires_at:Date.now()+3600000,
  user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',email:'organizer@example.com'}
 })));
 await p.route('**/api/venue-catalog*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"locations":[]}'}));
 await p.route('**/api/organizer',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   organizations:[{id:orgId,name:'Testa organizators',kind:'organizer',owner_id:orgId,role:'owner',is_public:false}],
   venues:[{id:venueId,organization_id:orgId,name:'MEETS Sporta zāle',address:'Sporta iela 1, Rīga',latitude:56.9496,longitude:24.1052,is_public:false}],
   publicVenues:[],venueLinks:[{organization_id:orgId,venue_id:venueId,relation_type:'managed'}],submissions:[]})});
  if(body.action==='saveEvent'){
   submitted=body;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({item:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb59',status:body.status}})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:'{"item":{}}'});
 });
 try{
  await p.goto(base+'/registre-pasakumu',{waitUntil:'domcontentloaded'});
  if(!(await p.getByRole('link',{name:/Pievienot pasākumu/}).count())||!(await p.getByRole('link',{name:/Pievienot vietu/}).count())){
   fails++;console.error('Entry choice missing on phone',width);
  }
  await p.getByRole('link',{name:/Pievienot pasākumu/}).first().click();
  const form=p.locator('.quick-flow-card');
  await form.getByPlaceholder('Piemēram, Ģimenes sporta diena').fill('MEETS mobilais pasākums');
  await form.locator('input[type=date]').first().fill(day);
  await form.getByLabel('Pasākuma norises adrese').selectOption(venueId);
  await form.getByRole('button',{name:/Priekšskatīt/}).click();
  await p.getByText('MEETS mobilais pasākums').first().waitFor({timeout:10000});
  await assertLayout(p,'quick-event',width);
  await p.screenshot({path:'ux-screenshots/'+width+'-quick-event.png',fullPage:true});
  await p.getByRole('button',{name:/Iesniegt pārbaudei/}).click();
  await p.getByRole('heading',{name:'Pasākums nosūtīts pārbaudei'}).waitFor({timeout:12000});
  if(submitted?.venue_id!==venueId||submitted?.status!=='pending_review'||submitted?.date_from!==day){
   fails++;console.error('Event submission lost data',width,submitted);
  }
  if(width===390){
   // Recurrence + per-day time + EUR price should persist as one series to moderation.
   await p.getByRole('button',{name:/Pievienot nākamo pasākumu/}).click();
   const next=p.locator('.quick-flow-card');
   await next.getByPlaceholder('Piemēram, Ģimenes sporta diena').fill('Regulārās sporta nodarbības');
   await next.getByLabel('Norises veids').selectOption('recurring');
   const end=new Date(day+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+15);
   await next.locator('input[type=date]').nth(0).fill(day);
   await next.locator('input[type=date]').nth(1).fill(end.toISOString().slice(0,10));
   await next.getByRole('button',{name:'+ Laiks'}).first().click();
   await next.getByLabel('Dalības maksa').selectOption('paid');
   await next.locator('input[type=number]').nth(0).fill('9.50');
   await next.locator('input[type=number]').nth(1).fill('15.00');
   await next.getByLabel('Pasākuma norises adrese').selectOption(venueId);
   await next.getByRole('button',{name:/Priekšskatīt/}).click();
   await p.getByText('Norises reizes:',{exact:false}).waitFor({timeout:10000});
   await p.getByRole('button',{name:/Iesniegt pārbaudei/}).click();
   await p.getByRole('heading',{name:'Pasākums nosūtīts pārbaudei'}).waitFor({timeout:10000});
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
 }catch(e){fails++;console.error('Quick flow mobile smoke failed',width,e.message,errors.slice(0,3));try{await p.screenshot({path:'ux-screenshots/'+width+'-quick-failure.png',fullPage:true});}catch{}}
 await p.close();
}


// Unified logged-in profile, shared navigation and real data-backed dashboard.
for(const width of [360,390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<761,hasTouch:width<761});
 const faults=[];page.on('pageerror',error=>faults.push(error.message));
 const ownerId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb51';
 const venueId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb52';
 await page.addInitScript(()=>localStorage.setItem('meets_user_session_v1',JSON.stringify({
  access_token:'mock-profile-access',refresh_token:'mock-profile-refresh',
  user:{id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb51',email:'organizer@example.com'}
 })));
 await page.route('**/api/account',route=>{
  const b=route.request().postDataJSON()||{};
  if(b.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   favorites:[mockEvent.id],plans:[mockEvent.id],visits:[],email:'organizer@example.com'})});
  if(b.action==='dashboard')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   interests:[],reminders:[],notices:[],follows:[],locationFollows:[],shared:null,
   directory:{organizations:[],venues:[],sources:[]},followedEvents:[],savedDetails:[]})});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.route('**/api/organizer',route=>{
  const b=route.request().postDataJSON()||{};
  if(b.action==='list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   organizations:[{id:ownerId,name:'MEETS Testa komanda',owner_id:ownerId,kind:'organizer',role:'owner',description:'Testa organizators',is_public:false}],
   venues:[{id:venueId,name:'MEETS Sporta zāle',organization_id:ownerId,address:'Sporta iela 1, Rīga',is_public:true,latitude:56.9496,longitude:24.1052}],
   publicVenues:[],venueLinks:[{organization_id:ownerId,venue_id:venueId,relation_type:'managed'}],
   submissions:[{id:ownerId,title:'Ģimeņu sporta diena',organization_id:ownerId,venue_name:'MEETS Sporta zāle',date_from:today,status:'pending_review'}]})});
  return route.fulfill({status:200,contentType:'application/json',body:'{"item":{}}'});
 });
 const collectionId='9847198c-66d5-4bd1-8f2e-3b2f3a86bb57';
 let privateCollections=[{
   id:'9847198c-66d5-4bd1-8f2e-3b2f3a86bb53',title:'Ģimeņu pasākumi',
   description:'Atlasīti pasākumi',filters:{period:'month'},is_published:true,
   included_event_ids:[],excluded_event_ids:[],organization_id:null
 }];
 await page.route('**/api/registries',route=>{
  const b=route.request().postDataJSON()||{};
  const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(b.action==='list')return json({profile:{display_name:'Mārupes pasākumi'},registries:privateCollections});
  if(b.action==='profile')return json({profile:{display_name:b.display_name}});
  if(b.action==='save'){
   const item={...b,id:b.id||collectionId};
   privateCollections=[item,...privateCollections.filter(x=>x.id!==item.id)];
   return json({registry:item});
  }
  if(b.action==='toggleEvent'){
   const item=privateCollections.find(x=>x.id===b.id);
   if(!item)return json({error:'Missing list'},404);
   const included=new Set(item.included_event_ids||[]);
   b.enabled?included.add(b.event_id):included.delete(b.event_id);
   const next={...item,included_event_ids:[...included]};
   privateCollections=privateCollections.map(x=>x.id===item.id?next:x);
   return json({registry:next});
  }
  return json({error:'Unsupported'},400);
 });
 await page.route('**/api/events*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockedCatalog)}));
 try{
  await page.goto(base+'/profils',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('heading',{name:'Pārskats'}).waitFor({timeout:15000});
  const stats=page.locator('.meets-profile-summary-stats');
  await stats.waitFor({timeout:12000});
  if((await stats.locator('.meets-profile-stat').count())!==3){fails++;console.error('Profile stats count wrong',width);}
  if(width<768){
   if(!(await page.locator('.meets-profile-mobile-tabs').isVisible())){fails++;console.error('Mobile profile navigation not visible',width);}
  }else if(!(await page.locator('.meets-profile-aside').isVisible())){fails++;console.error('Desktop profile sidebar not visible',width);}
  if(width<761&&!await page.getByRole('button',{name:'Iziet no MEETS konta'}).isVisible()){
   fails++;console.error('Mobile logout action not visible',width);
  }
  await assertLayout(page,'signed-profile',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-signed-profile.png',fullPage:true});
  // Personal lists are hidden; saved events live on one page.
  await page.goto(base+'/mani-pasakumi',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('heading',{name:'Saglabātie pasākumi'}).waitFor({timeout:15000});
  await assertLayout(page,'saved-favorites',width);
  await page.goto(base+'/organizators?panel=venues',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('heading',{name:'MEETS Testa komanda'}).waitFor({timeout:12000});
  await assertLayout(page,'signed-organizer',width);
  if(faults.length){fails++;console.error('Profile JS errors',width,faults.slice(0,3));}
 }catch(error){
  fails++;console.error('Signed-in profile smoke failed',width,error.message,faults.slice(0,3));
  try{console.error('Profile HTML:',(await page.locator('body').innerText()).slice(0,1500));}catch{}
 }
 await page.close();
}

await browser.close();
if(fails){console.error('UX smoke failures:',fails);process.exit(1);}
console.log('PASS: responsive smoke checks include 360px, 390px, 768px and 1440px');

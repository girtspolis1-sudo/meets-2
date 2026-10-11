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
await browser.close();
if(fails){console.error('UX smoke failures:',fails);process.exit(1);}
console.log('PASS: mobile smoke checks at 320px and 390px');

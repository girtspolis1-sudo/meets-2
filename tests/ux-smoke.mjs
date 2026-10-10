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
  await page.getByRole('button',{name:/Saglabāt|Saglabāts/}).first().click();
  await page.getByRole('button',{name:'Aizvērt pasākumu informāciju'}).click();
  await assertLayout(page,'map',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-map.png',fullPage:true});
  await page.goto(base+'/pasakumi',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.catalog-view-switch').waitFor({timeout:30000});
  if(!(await page.getByRole('button',{name:/Kartītes/}).getAttribute('aria-pressed'))?.includes('true')){fails++;console.error('Card view is not active by default');}
  await assertLayout(page,'catalog',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-catalog.png',fullPage:true});
  await page.goto(base+'/mani-pasakumi',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.meets-account-page').waitFor({timeout:30000});
  await assertLayout(page,'personal',width);
  await page.screenshot({path:'ux-screenshots/'+width+'-personal.png',fullPage:true});
  if(errors.length){fails++;console.error('Client errors',width,errors.slice(0,3));}
 }catch(error){fails++;console.error('Smoke test failed',width,error.message,errors.slice(0,3));try{console.error('Body:',(await page.locator('body').innerText()).slice(0,1000));await page.screenshot({path:'ux-screenshots/'+width+'-failure.png',fullPage:true});}catch{}}
 await page.close();
}
await browser.close();
if(fails){console.error('UX smoke failures:',fails);process.exit(1);}
console.log('PASS: mobile smoke checks at 320px and 390px');

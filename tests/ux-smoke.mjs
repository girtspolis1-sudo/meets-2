import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:3000';
await mkdir('ux-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[320,390];
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
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.home-landing').waitFor({timeout:30000});
  if(await page.locator('.meets-location-overlay').count())throw Error('Forced location dialog on homepage');
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
 }catch(error){fails++;console.error('Smoke test failed',width,error.message);}
 await page.close();
}
await browser.close();
if(fails){console.error('UX smoke failures:',fails);process.exit(1);}
console.log('PASS: mobile smoke checks at 320px and 390px');

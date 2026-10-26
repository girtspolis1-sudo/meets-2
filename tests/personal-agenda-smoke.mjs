import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
await mkdir('ux-screenshots',{recursive:true});
const events=[
 {id:'a',title:'Rīgas rudens koncerts',date_from:'2026-10-27',time_from:'19:00',venue_name:'Kultūras centrs',price_status:'free'},
 {id:'b',title:'Ģimeņu sporta diena ar ļoti garu nosaukumu, kas pārbauda divu rindu izkārtojumu',date_from:'2026-10-27',time_from:'09:00',venue_name:'Ļoti garš sporta centra un norises vietas nosaukums Rīgā'},
 {id:'c',title:'Ilgstošā izstāde',date_from:'2023-10-26',date_to:'2026-11-08',venue_name:'Muzejs'},
 {id:'d',title:'Pagājušais pasākums',date_from:'2026-10-24'},
 {id:'e',title:'Atceltais koncerts',date_from:'2026-10-29',status:'cancelled'}
];
try{
 for(const width of [360,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00Z'));
  await page.addInitScript(()=>localStorage.setItem('meets_user_session_v1',JSON.stringify({access_token:'mock',refresh_token:'mock',expires_at:Date.now()+3600000,user:{id:'owner',email:'test@example.com'}})));
  let favorites=['a','b','c','d','e'],plans=['a'],failNext=false;
  const payload=()=>({favorites,plans,visits:[]});
  await page.route('**/api/events*',r=>r.fulfill({json:{events}}));
  await page.route('**/api/registries',r=>r.fulfill({json:{registries:[],profile:{display_name:'Ģirts'}}}));
  await page.route('**/api/organizer',r=>r.fulfill({json:{organizations:[]}}));
  await page.route('**/api/account',r=>{
   const {action,eventId}=r.request().postDataJSON();
   if(action==='list')return r.fulfill({json:payload()});
   if(action==='dashboard')return r.fulfill({json:{savedDetails:events}});
   if(failNext){failNext=false;return r.fulfill({status:500,json:{error:'Testa saglabāšanas kļūda'}});}
   if(action==='plan'){plans=[...new Set([...plans,eventId])];favorites=[...new Set([...favorites,eventId])];}
   if(action==='unplan')plans=plans.filter(id=>id!==eventId);
   if(action==='remove'){favorites=favorites.filter(id=>id!==eventId);plans=plans.filter(id=>id!==eventId);}
   return r.fulfill({json:{ok:true}});
  });
  for(const path of ['/profils','/mani-pasakumi']){
   await page.goto(base+path);await page.locator('.meets-agenda-event').first().waitFor();
   const agenda=page.locator('.meets-agenda');
   assert.deepEqual(await agenda.locator('.meets-agenda-title').allTextContents(),['Ilgstošā izstāde',events[1].title,events[0].title,events[4].title]);
   assert.equal(await agenda.getByRole('button',{name:'Plānoju apmeklēt: Atceltais koncerts',exact:true}).isDisabled(),true);
   await agenda.locator('.meets-agenda-status button').nth(1).click();
   assert.equal(await agenda.locator('.meets-agenda-event').count(),1);
   await agenda.locator('.meets-agenda-status button').first().click();
   if(width<=800)await agenda.getByRole('button',{name:'Rādīt kalendāru',exact:true}).click();
   await agenda.locator('.meets-agenda-month-grid button').filter({has:page.locator('span', {hasText:/^27$/})}).click();
   assert.equal(await agenda.locator('.meets-agenda-event').count(),3);
   await agenda.getByRole('button',{name:/Rādīt visus datumus/}).click();
   await page.screenshot({path:`ux-screenshots/${width}-${path.slice(1)}-agenda.png`,fullPage:true});
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
   if(width<=800)await agenda.getByRole('button',{name:'Paslēpt kalendāru',exact:true}).click();
   await agenda.getByRole('button',{name:'Atcelt plānu: Rīgas rudens koncerts',exact:true}).click();
   await agenda.getByRole('button',{name:'Plānoju apmeklēt: Rīgas rudens koncerts',exact:true}).waitFor();
   assert.ok(favorites.includes('a'));assert.ok(!plans.includes('a'));
   await agenda.getByRole('button',{name:'Plānoju apmeklēt: Rīgas rudens koncerts',exact:true}).click();
   await agenda.getByRole('button',{name:'Atcelt plānu: Rīgas rudens koncerts',exact:true}).waitFor();
   failNext=true;
   await agenda.getByRole('button',{name:'Atcelt plānu: Rīgas rudens koncerts',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Testa saglabāšanas kļūda'}).waitFor();
   assert.ok(plans.includes('a'));
   await agenda.getByRole('combobox',{name:'Pasākumu periods'}).selectOption('past');
   assert.deepEqual(await agenda.locator('.meets-agenda-title').allTextContents(),['Pagājušais pasākums']);
   await agenda.getByRole('combobox',{name:'Pasākumu periods'}).selectOption('upcoming');
   await agenda.getByRole('searchbox').fill('neeksistē');await agenda.getByRole('heading',{name:'Nav atbilstošu pasākumu'}).waitFor();
   await agenda.getByRole('searchbox').fill('');
  }
  await page.getByRole('button',{name:'Noņemt no saglabātajiem un plāna: Rīgas rudens koncerts',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.meets-agenda-title[href$="event=a"]'));
  assert.ok(!plans.includes('a')&&!favorites.includes('a'));
  await page.reload();await page.locator('.meets-agenda-event').first().waitFor();assert.equal(await page.locator('.meets-agenda-title[href$="event=a"]').count(),0);
  assert.deepEqual(faults,[]);await page.close();console.log('Agenda verified at',width);
 }
}finally{await browser.close();}

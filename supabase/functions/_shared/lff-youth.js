// Latvian Football Federation (lff.lv) youth competitions: section list and pure helpers
// shared by supabase/functions/sync-lff-youth-events and tests/lff-youth.test.js.
// Each section page has a competition select ("Izvēlies sacensības") whose options are
// the age groups and seasons (U-19 … U-8); a competition page lists its games as rows
// with a date block (weekday, day, month, time, year), both clubs and the ground.
// Results and players are never read.

export const SECTIONS=[
 {slug:'jauniesi/elites-grupa',name:'Jaunatnes čempionāts, Elites grupa',format:'football'},
 {slug:'jauniesi/meistaribas-grupa',name:'Jaunatnes čempionāts, Meistarības grupa',format:'football'},
 {slug:'jauniesi/attistibas-grupa',name:'Jaunatnes čempionāts, Attīstības grupa',format:'football'},
 {slug:'jauniesi/akademiju-cempionats',name:'Akadēmiju čempionāts',format:'football'},
 {slug:'jauniesi/jaunatnes-olimpiade',name:'Jaunatnes olimpiāde',format:'football'},
 {slug:'sievietes/meitenu-cempionats',name:'Meiteņu čempionāts',format:'football',girls:true},
 {slug:'telpu-futbols/jaunatnes-cempionati',name:'Jaunatnes čempionāts telpu futbolā',format:'futsal'},
 {slug:'sievietes/meitenu-telpu-futbola-cempionats',name:'Meiteņu čempionāts telpu futbolā',format:'futsal',girls:true}
].map(s=>({...s,url:'https://lff.lv/sacensibas/'+s.slug+'/'}));

const MONTHS={jan:'01',feb:'02',mar:'03',apr:'04',mai:'05',jūn:'06',jun:'06',jūl:'07',jul:'07',aug:'08',sep:'09',okt:'10',nov:'11',dec:'12'};
const text=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
 .replace(/&#0?39;|&apos;/g,"'").replace(/&ndash;|&#8211;/g,'–').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();

// The options of the competition select: {id, label, url}. The first option is the
// section page itself (id 'main').
export function competitionOptions(html,section){
 const sel=String(html||'').match(/<select class="pageParams">([\s\S]*?)<\/select>/)?.[1]||'';
 return [...sel.matchAll(/<option value="([^"]*)">([^<]*)</g)].map(m=>{
  const id=m[1].match(/[?&]p=(\d+)/)?.[1]||'main';
  return {id,label:text(m[2]),url:id==='main'?section.url:section.url+'?p='+id};
 });
}

// The newest year a label names: "2026/27" and "2026/2027" → 2027, "U16 grupa 2026" → 2026,
// no year → null (the section's current season).
export function labelYear(label){
 const s=String(label||'');
 const pair=s.match(/\b(20\d{2})\s*\/\s*(\d{2}|\d{4})\b/);
 if(pair)return Number(pair[2].length===2?pair[1].slice(0,2)+pair[2]:pair[2]);
 const ys=[...s.matchAll(/\b(20\d{2})\b/g)].map(m=>Number(m[1]));
 return ys.length?Math.max(...ys):null;
}
// Options of the current season: no year, a year not before today's, or a winter season
// ("2025/26") that ends this year while it is still the first half of the year.
export function currentOptions(options,today){
 const year=Number(String(today).slice(0,4)),spring=Number(String(today).slice(5,7))<7;
 return options.filter(o=>{
  const y=labelYear(o.label);
  if(y===null||y>year)return true;
  return y===year&&(spring||!/\b20\d{2}\s*\/\s*\d{2,4}\b/.test(o.label));
 })
  .filter(o=>!/izspēles kārtība|nolikum|reglament/i.test(o.label));
}

// "U-19 grupa" → "U19", girls' sections add "meitenes"; youth olympics finals by sex.
export function ageGroupOf(label,section){
 const s=String(label||'');
 const u=s.match(/\bU\s?-?\s?(\d{1,2})\b/i);
 const sex=section?.girls||/jauniet[eē]m|meiten/i.test(s)?'meitenes':/jaunieš|zēn/i.test(s)?'zēni':'';
 if(u)return 'U'+u[1]+(sex==='meitenes'?' meitenes':'');
 return sex?(sex==='meitenes'?'jaunietes':'jaunieši'):null;
}

export function competitionKey(section,option){
 return 'lff-youth-'+section.slug.split('/').pop()+'-'+option.id;
}
export function competitionName(section,option){
 const label=String(option.label||'').replace(/^Jaunatnes\s+/i,'');
 return section.name+': '+label;
}

// Game rows with a date block. Rows without a date (the "next games" strip) repeat games
// listed below and are skipped. Played games carry scores: those are ignored, and only
// coming games are kept by the caller.
export function parseGames(html,section,option){
 const out=[];
 const rows=String(html||'').split(/<div class="tr match[^"]*"/).slice(1);
 for(const raw of rows){
  const id=raw.match(/^\s*data-id="(\d+)"/)?.[1];
  const date=raw.match(/<div class="date">([\s\S]*?)<\/div><\/div>/)?.[1];
  if(!id||!date)continue;
  const day=text(date.match(/<h5>([\s\S]*?)<\/h5>/)?.[1]);
  const mon=MONTHS[text(date.match(/<h6>([\s\S]*?)<\/h6>/)?.[1]).toLowerCase().slice(0,3)];
  const year=date.match(/<div class="h8">\s*(\d{4})/)?.[1]||'';
  const time=text(date.match(/<div class="h7">([^<]*)</)?.[1]).match(/^\d{1,2}:\d{2}$/)?.[0]||null;
  if(!/^\d{1,2}$/.test(day)||!mon||!/^\d{4}$/.test(year))continue;
  const clubs=[...raw.matchAll(/<div class="club">\s*<div class="title">([\s\S]*?)<\/div>/g)].map(m=>text(m[1]));
  const venue=text(raw.match(/<div class="stadium">([\s\S]*?)<\/div>/)?.[1]);
  if(clubs.length<2||!clubs[0]||!clubs[1]||!venue)continue;
  const link=raw.match(/href="(\/speles\/[^"]+)"/)?.[1];
  out.push({id,date:year+'-'+mon+'-'+day.padStart(2,'0'),time:time?time.padStart(5,'0'):null,home:clubs[0],away:clubs[1],venue,
   competition_key:competitionKey(section,option),competition:competitionName(section,option),age_group:ageGroupOf(option.label,section),
   sport_format:section.format,url:link?'https://lff.lv'+link:option.url});
 }
 return out;
}

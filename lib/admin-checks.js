// Checks every current event the admin works with and puts it in one of four
// blocks, so the overview answers at a glance:
//   critical  — not published and something must be fixed first
//   ready     — not published, nothing blocks publishing
//   review    — published, but something should be clarified
//   ok        — published and meets the requirements
// Cancelled, archived and draft events are 'other' and stay out of the blocks.

export const BUCKETS={
 critical:{label:'Kritiski — jālabo, nav publicēts',short:'Kritiski',tone:'bad',
  hint:'Šie pasākumi nav redzami kartē, kamēr nav izlabots tas, kas bloķē publicēšanu.'},
 ready:{label:'Gatavi publicēšanai',short:'Gatavi',tone:'warn',
  hint:'Nekas nebloķē publicēšanu. Pārskati brīdinājumus, ja tādi ir, un publicē.'},
 review:{label:'Publicēti — jāprecizē',short:'Jāprecizē',tone:'attention',
  hint:'Apmeklētāji tos jau redz. Precizē vietu vai saturu, lai informācija būtu droša.'},
 ok:{label:'Kārtībā',short:'Kārtībā',tone:'ok',
  hint:'Publicēti un atbilst visām prasībām.'}
};
export const BUCKET_ORDER=['critical','ready','review','ok'];

// level 'block' stops publishing; 'warn' moves a published event to 'review';
// 'info' is only shown (many sources simply have no description).
export const CHECKS={
 no_title:{label:'Nav nosaukuma',level:'block',fix:'content'},
 bad_dates:{label:'Beigu datums pirms sākuma',level:'block',fix:'content'},
 no_place:{label:'Nav norises vietas vai adreses',level:'block',fix:'location'},
 no_point:{label:'Nav kartes punkta',level:'block',fix:'location'},
 area_only:{label:'Tikai pilsētas vai apdzīvotas vietas centrs',level:'block',fix:'location'},
 location_unverified:{label:'Kartes punkts nav verificēts',level:'block',fix:'location'},
 duplicate:{label:'Iespējams dublikāts',level:'warn',fix:'content'},
 html_residue:{label:'HTML atliekas tekstā',level:'warn',fix:'content'},
 caps_title:{label:'Nosaukums tikai ar lielajiem burtiem',level:'warn',fix:'content'},
 no_description:{label:'Nav apraksta',level:'info',fix:'content'},
 very_long:{label:'Ilgst vairāk nekā pusgadu',level:'warn',fix:'content'},
 no_source:{label:'Nav avota saites',level:'warn',fix:'content'}
};

const LONG_DAYS=183;
const LEVEL_RANK={block:0,warn:1,info:2};
const ISO=/^\d{4}-\d{2}-\d{2}$/;

function text(value){return String(value??'').trim();}
function norm(value){
 return text(value).toLocaleLowerCase('lv').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim();
}
function days(from,to){return Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/864e5);}
function hasPoint(event){
 return event?.latitude!=null&&event?.longitude!=null&&Number.isFinite(Number(event.latitude))&&Number.isFinite(Number(event.longitude));
}
export function isOnline(event){return event?.attendance_mode==='online';}

// Same title, start day and place (or municipality when there is no place).
export function duplicateKey(event){
 const title=norm(event?.title);
 if(!title||!text(event?.date_from))return '';
 return [title,event.date_from,String(event?.time_from||'').slice(0,5),norm(event?.venue_name||event?.address_raw||event?.municipality)].join('|');
}

export function locationIssues(event){
 if(isOnline(event))return [];
 if(!text(event?.venue_name||event?.address_raw))return ['no_place'];
 if(!hasPoint(event))return ['no_point'];
 const quality=String(event?.location_quality||'');
 if(quality==='verified_exact')return [];
 if(quality==='fallback_center'||quality==='settlement_center')return ['area_only'];
 return ['location_unverified'];
}

export function contentIssues(event,{duplicates=null}={}){
 const issues=[];
 const title=text(event?.title);
 if(!title)issues.push('no_title');
 const from=text(event?.date_from),to=text(event?.date_to);
 if(ISO.test(from)&&ISO.test(to)&&to<from)issues.push('bad_dates');
 if(duplicates&&duplicates.get(duplicateKey(event))>1)issues.push('duplicate');
 const body=title+' '+text(event?.description);
 if(/<\/?[a-z][^>]*>|&(?:nbsp|amp|quot|#\d+);/i.test(body))issues.push('html_residue');
 const letters=title.replace(/[^a-zA-ZĀ-žА-я]/g,'');
 if(letters.length>=8&&letters===letters.toLocaleUpperCase('lv')&&letters!==letters.toLocaleLowerCase('lv'))issues.push('caps_title');
 if(text(event?.description).length<20)issues.push('no_description');
 if(ISO.test(from)&&ISO.test(to)&&days(from,to)>LONG_DAYS)issues.push('very_long');
 if(!(event?.sources||[]).some(s=>text(s?.url)))issues.push('no_source');
 return issues;
}

export function bucketOf(event,issues){
 const blocked=issues.some(code=>CHECKS[code]?.level==='block');
 const needsWork=issues.some(code=>CHECKS[code]?.level!=='info');
 if(event?.status==='published')return needsWork?'review':'ok';
 if(event?.status==='pending_review')return blocked?'critical':'ready';
 return 'other';
}

// [{event,issues,bucket}] plus counts per block and per block and check.
export function auditEvents(events){
 const list=Array.isArray(events)?events:[];
 const duplicates=new Map();
 for(const event of list){const key=duplicateKey(event);if(key)duplicates.set(key,(duplicates.get(key)||0)+1);}
 const rows=list.map(event=>{
  const issues=[...locationIssues(event),...contentIssues(event,{duplicates})];
  return {event,issues,bucket:bucketOf(event,issues)};
 });
 const counts=Object.fromEntries([...BUCKET_ORDER,'other'].map(key=>[key,0]));
 const reasons=Object.fromEntries(BUCKET_ORDER.map(key=>[key,{}]));
 for(const row of rows){
  counts[row.bucket]++;
  if(!reasons[row.bucket])continue;
  for(const code of row.issues)reasons[row.bucket][code]=(reasons[row.bucket][code]||0)+1;
 }
 return {rows,counts,reasons};
}

// Reasons of one block, most frequent first: [{code,label,count,level}]
export function reasonList(reasons){
 return Object.entries(reasons||{}).map(([code,count])=>({code,count,label:CHECKS[code]?.label||code,level:CHECKS[code]?.level||'warn'}))
  .sort((a,b)=>LEVEL_RANK[a.level]-LEVEL_RANK[b.level]||b.count-a.count);
}

export function issueLabels(issues){return (issues||[]).map(code=>CHECKS[code]?.label||code);}

// The next item of a work queue after the current one, skipping ones already done.
export function nextInQueue(queue,currentId,isDone=()=>false){
 const ids=Array.isArray(queue)?queue:[];
 const start=ids.indexOf(currentId);
 for(let i=start+1;i<ids.length;i++)if(!isDone(ids[i]))return ids[i];
 for(let i=0;i<Math.max(0,start);i++)if(!isDone(ids[i]))return ids[i];
 return null;
}

export function csvCell(value){
 const s=String(value??'');
 return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function toCsv(header,rows){
 return [header,...rows].map(row=>row.map(csvCell).join(';')).join('\n');
}

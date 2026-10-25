// Calendar rules: ISO weekday 1=Mon ... 7=Sun. Store local Riga wall-clock times.
const HHMM=/^([01]\d|2[0-3]):[0-5]\d$/;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function dateOk(s){if(!ISO.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function cleanSlots(value){
 if(!Array.isArray(value)||value.length>14)throw Error('Maksimāli 14 norises laiki nedēļā.');
 const slots=value.map(s=>{
  const weekday=Number(s?.weekday),start=String(s?.start||''),end=String(s?.end||'');
  if(!Number.isInteger(weekday)||weekday<1||weekday>7||!HHMM.test(start)||!HHMM.test(end)||end<=start)
   throw Error('Pārbaudi izvēlēto dienu un sākuma/beigu laiku.');
  return {weekday,start,end};
 });
 const keys=new Set(slots.map(s=>s.weekday+'|'+s.start));
 if(keys.size!==slots.length)throw Error('Vienai dienai un sākuma laikam nevar būt divas norises.');
 return slots.sort((a,b)=>a.weekday-b.weekday||a.start.localeCompare(b.start));
}
export function countOccurrences(dateFrom,dateTo,slots){
 if(!dateOk(dateFrom)||!dateOk(dateTo)||dateTo<dateFrom)throw Error('Nepareizs grafika datumu periods.');
 const start=new Date(dateFrom+'T12:00:00Z'),end=new Date(dateTo+'T12:00:00Z');
 const days=Math.round((end-start)/86400000);
 if(days>120)throw Error('Atkārtošanās periods nedrīkst pārsniegt 120 dienas.');
 const clean=cleanSlots(slots);
 if(!clean.length)throw Error('Izvēlies vismaz vienu nedēļas dienu.');
 let n=0;
 for(let i=0;i<=days;i++){
  const weekday=((start.getUTCDay()+i+6)%7)+1;
  n+=clean.filter(s=>s.weekday===weekday).length;
 }
 if(n>180)throw Error('Vienā sērijā drīkst būt līdz 180 norises reizēm.');
 if(n===0)throw Error('Šajā periodā nav nevienas norises reizes.');
 return n;
}
export function cleanPrice(status,min,max){
 if(!['free','paid','mixed','unknown'].includes(status))throw Error('Nepareizs maksas statuss.');
 if(status==='free')return {price_min:0,price_max:0};
 if(status==='unknown')return {price_min:null,price_max:null};
 const minimum=min==null||min===''?NaN:Number(min),maximum=max==null||max===''?NaN:Number(max);
 if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<0||maximum<minimum||maximum>1000000||
    Math.round(minimum*100)!==minimum*100||Math.round(maximum*100)!==maximum*100)
   throw Error('Norādi cenu EUR no–līdz (maksimums nevar būt mazāks par minimumu).');
 return {price_min:minimum,price_max:maximum};
}

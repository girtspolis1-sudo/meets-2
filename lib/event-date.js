const MS_DAY=86400000;

export function rigaTodayIso(now=new Date()){
 return new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Europe/Riga',
  year:'numeric',
  month:'2-digit',
  day:'2-digit'
 }).format(now);
}

export function addIsoDays(iso,days){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return '';
 const d=new Date(iso+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}

export function eventDateState(event,today=rigaTodayIso()){
 const start=String(event?.date_from||'');
 const end=String(event?.date_to||start);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)){
  return {tone:'future',label:'Datums nav norādīts',badge:'—',days:null,isOpenToday:false};
 }

 if(start<=today&&end>=today){
  return {tone:'today',label:'Šodien',badge:'Šodien',days:0,isOpenToday:true};
 }

 const tomorrow=addIsoDays(today,1);
 if(start<=tomorrow&&end>=tomorrow){
  return {tone:'tomorrow',label:'Rīt',badge:'Rīt',days:1,isOpenToday:false};
 }

 const startMs=Date.parse(start+'T12:00:00Z');
 const todayMs=Date.parse(today+'T12:00:00Z');
 const days=Math.round((startMs-todayMs)/MS_DAY);

 if(days>1){
  return {tone:'future',label:days+' dienas līdz pasākumam',badge:days+'d',days,isOpenToday:false};
 }
 if(days<0){
  const ago=Math.abs(days);
  return {
   tone:'past',
   label:ago===1?'Pasākums beidzās vakar':'Pasākums beidzās pirms '+ago+' dienām',
   badge:'-'+ago+'d',
   days,
   isOpenToday:false
  };
 }
 return {tone:'future',label:'Pasākuma datums',badge:'0d',days,isOpenToday:false};
}

export function groupDateTone(events,today=rigaTodayIso()){
 const states=(Array.isArray(events)?events:[]).map(event=>eventDateState(event,today).tone);
 if(states.includes('today'))return 'today';
 if(states.includes('tomorrow'))return 'tomorrow';
 return '';
}

export function eventDateRangeLabel(event,formatDate){
 const start=String(event?.date_from||'');
 const end=String(event?.date_to||'');
 const format=typeof formatDate==='function'?formatDate:value=>value;
 if(start&&end&&end!==start)return format(start)+'–'+format(end);
 return start?format(start):'Datums nav norādīts';
}

export function hasEventEnded(event,today=rigaTodayIso()){
 const end=String(event?.date_to||event?.date_from||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(end)&&end<today;
}

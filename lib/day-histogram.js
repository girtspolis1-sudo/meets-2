// The "Kur" panel's day chart: how many events start on each of the next days, and the chosen
// stretch of days. Pure functions, tested in tests/day-histogram.test.js.

export function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);}

// One bar per day from today: events starting that day (an event already running counts on today).
// The chart ends at `windowTo` (the last day the catalogue covers) when it is earlier.
export function dailyCounts(events,today,days=30,windowTo=''){
 let n=days;
 if(/^\d{4}-\d{2}-\d{2}$/.test(windowTo))n=Math.max(1,Math.min(days,daysBetween(today,windowTo)+1));
 const bars=Array.from({length:n},(_,i)=>{const date=addDays(today,i);const dow=new Date(date+'T12:00:00Z').getUTCDay();return {date,count:0,weekend:dow===0||dow===6};});
 for(const e of events||[]){
  const start=String(e?.date_from||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))continue;
  const end=String(e?.date_to||start);
  if(end<today)continue;
  const i=start<=today?0:daysBetween(today,start);
  if(i<n)bars[i].count++;
 }
 return bars;
}

// The chosen days as bar positions; dates outside the chart are clamped to it.
export function rangeIndexes(bars,from,to){
 const last=bars.length-1;
 if(!bars.length)return {a:0,b:0};
 const today=bars[0].date;
 const at=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?Math.max(0,Math.min(last,daysBetween(today,d))):null;
 const a=at(from)??0,b=at(to)??last;
 return a<=b?{a,b}:{a:b,b:a};
}

const MONTHS=['janv.','febr.','marts','apr.','maijs','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
export function dayLabel(date){return Number(date.slice(8,10))+'. '+MONTHS[Number(date.slice(5,7))-1];}
// "26. nov. – 2. dec. · 7 dienas"
export function rangeLabel(from,to){
 const n=daysBetween(from,to)+1;
 return (from===to?dayLabel(from):dayLabel(from)+' – '+dayLabel(to))+' · '+n+(n%10===1&&n%100!==11?' diena':' dienas');
}

// Organizer submissions waiting for an admin decision, oldest first.
const DAY=24*60*60*1000;
// Counted from the latest (re)submission, so a corrected event starts fresh.
export function waitingDays(item,now=Date.now()){
 const created=Date.parse(item?.submitted_at||item?.created_at||'');
 return Number.isFinite(created)?Math.max(0,Math.floor((now-created)/DAY)):0;
}
export function submissionExpired(item,today){
 const end=String(item?.date_to||item?.date_from||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(end)&&end<today;
}
export function pendingSubmissions(items,today,now=Date.now()){
 const pending=(Array.isArray(items)?items:[]).filter(x=>x.status==='pending_review')
  .sort((a,b)=>String(a.submitted_at||a.created_at||'').localeCompare(String(b.submitted_at||b.created_at||'')));
 return {
  items:pending,
  count:pending.length,
  oldestDays:pending.length?waitingDays(pending[0],now):0,
  expired:pending.filter(x=>submissionExpired(x,today)).length
 };
}

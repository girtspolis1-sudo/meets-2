export const MANUAL_COLLECTION_FILTER={period:'all',selection_mode:'manual'};
export function isManualCollection(item){return !item?.organization_id&&item?.filters?.selection_mode==='manual';}
export function collectionIds(item){return [...new Set(Array.isArray(item?.included_event_ids)?item.included_event_ids:[])];}
export function eventInCollection(item,eventId){
 if(!eventId)return false;
 return collectionIds(item).includes(eventId)&&!(item?.excluded_event_ids||[]).includes(eventId);
}
export function collectionEvents(events,item){
 const ids=new Set(collectionIds(item)),excluded=new Set(item?.excluded_event_ids||[]);
 return (events||[]).filter(e=>ids.has(e.id)&&!excluded.has(e.id))
  .sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||'')));
}

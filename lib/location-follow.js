// A stable, human-readable key for a real event venue — not its fallback map coordinates.
function normalized(value){
 return String(value||'').trim().toLocaleLowerCase('lv').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();
}
export function placeFromEvent(event){
 if(!event)return null;
 const municipality=String(event.municipality||event.settlement||'').trim().slice(0,140);
 const country=String(event.country_code||'LV').toUpperCase().slice(0,2);
 let name=String(event.venue_name||'').trim();
 if(!name||normalized(name)===normalized(municipality))name=String(event.address_raw||'').trim();
 name=name.slice(0,160);
 const normalizedName=normalized(name),normalizedMunicipality=normalized(municipality);
 if(!normalizedName||normalizedName.length<3||['nav noradita','nav zinama','norises vieta','riga','latvija'].includes(normalizedName))return null;
 // No municipality/country-center subscriptions when the real place is unknown.
 if(!normalizedMunicipality||normalizedName===normalizedMunicipality)return null;
 const key=[normalized(country),normalizedMunicipality,normalizedName].join('|');
 if(key.length>450)return null;
 return {key,name,municipality,country};
}
export function placesFromEvents(events){
 const items=new Map();
 for(const event of events||[]){
  const place=placeFromEvent(event);
  if(!place)continue;
  const current=items.get(place.key);
  if(current)current.count++;
  else items.set(place.key,{...place,count:1});
 }
 return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'lv')||a.municipality.localeCompare(b.municipality,'lv'));
}
export function eventsAtPlace(events,key){
 return (events||[]).filter(event=>placeFromEvent(event)?.key===key);
}

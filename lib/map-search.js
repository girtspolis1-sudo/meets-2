// Map search helpers shared by the /karte search bar. Pure functions, tested in tests/map-search.test.js.

// What choosing a search suggestion does. An event suggestion only searches for that event and
// moves the map to it: it never becomes the place that distances and the radius are counted from.
export function suggestionAction(choice){
 const lat=Number(choice?.latitude),lon=Number(choice?.longitude);
 const point=Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;
 if(choice?.eventTitle)return {kind:'event',search:String(choice.eventTitle),view:point};
 if(!point)return {kind:'none'};
 return {kind:'place',location:{lat,lon,label:String(choice.label||choice.displayName||'Izvēlētā vieta'),source:choice.local?'events':'search'}};
}

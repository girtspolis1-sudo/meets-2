// Verified against the public catalogue and existing importers (2026-10-07).
// Source types are provenance, not categories; sport also includes municipal events.
export const HOME_CATEGORY_FILTERS = {
 music: {title:'Mūzika', icon:'♫', subtitle:'Koncerti, festivāli', eventTypes:['concert'], categories:['Koncerts'], sourceTypes:[]},
 sport: {title:'Sports', icon:'⚽', subtitle:'Sacensības, pārgājieni', eventTypes:['sports_match','sports_competition','sports'], categories:['Basketbols','Futbols','Vieglatlētika','Sporta sacensības','Sporta pasākumi','Sports','Velobrauciens'], sourceTypes:['lff','basketball','athletics']},
 // No verified family classification exists yet. Never infer child suitability from titles.
 family: {title:'Ģimenēm', icon:'☺', subtitle:'Bērniem un vecākiem', eventTypes:[], categories:[], sourceTypes:[], emptyMessage:'Pašlaik katalogā nav pasākumu ar pārbaudītu kategoriju “Ģimenēm”. Izvēlies citu kategoriju vai noņem filtru.'},
 culture: {title:'Kultūra', icon:'◇', subtitle:'Izstādes, teātris', eventTypes:['exhibition','performance','cinema','books'], categories:['Kultūra','Izstāde','Eiropas kultūras galvaspilsēta','PASĀKUMI BIBLIOTĒKĀS AR IZSTĀDĒM'], sourceTypes:[]}
};

export function homeCategoryKey(value){
 return Object.hasOwn(HOME_CATEGORY_FILTERS,value)?value:'';
}
export function matchesHomeCategory(event,key){
 const filter=HOME_CATEGORY_FILTERS[homeCategoryKey(key)];
 if(!filter)return true;
 return filter.eventTypes.includes(event.event_type)
  ||filter.categories.includes(event.primary_category)
  ||filter.sourceTypes.includes(sourceType(event));
}

export function sourceType(e){
 if(String(e.sport_format||'').toLowerCase()==='basketball'||String(e.governing_body||'').toUpperCase()==='LBS')return 'basketball';
 if(String(e.governing_body||'').toUpperCase()==='LFF')return 'lff';
 const sources=(e.sources||[]).map(s=>String(s.source||'').toLowerCase());
 if(sources.includes('estlatbl.com')||sources.includes('basket.lv'))return 'basketball';
 if(sources.includes('lff.lv'))return 'lff';
 if(sources.includes('athletics.lv'))return 'athletics';
 return 'municipality';
}

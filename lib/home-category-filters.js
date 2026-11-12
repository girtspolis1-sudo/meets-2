// Normalized discovery groups based on the verified source taxonomy (2026-10-08).
export const HOME_CATEGORY_FILTERS = {
 music:{title:'Mūzika un dejas',icon:'🎵',subtitle:'Koncerti, balles un deju vakari'},
 stage:{title:'Teātris un kino',icon:'🎭',subtitle:'Izrādes, kino un stāvizrādes'},
 culture:{title:'Izstādes un kultūra',icon:'🖼️',subtitle:'Māksla, muzeji un literatūra'},
 sport:{title:'Sports',icon:'⚽',subtitle:'Spēles un sacensības'},
 active:{title:'Aktīvā atpūta un labsajūta',icon:'🌿',subtitle:'Kustība, daba un veselība'},
 markets:{title:'Tirdziņi un svētki',icon:'🎉',subtitle:'Tirdziņi un kopīgi svētki'},
 learning:{title:'Darbnīcas un izziņa',icon:'💡',subtitle:'Meistarklases un jaunas prasmes'},
 community:{title:'Tikšanās un kopiena',icon:'🤝',subtitle:'Sarunas, klubi un kopienas dzīve'},
 // Retain existing family links as an audience shortcut, not a ninth event group.
 family:{title:'Ģimenēm',icon:'☺',subtitle:'Kopā ar bērniem',emptyMessage:'Pašlaik nav pasākumu ar pārbaudītu piemērotību ģimenēm. Izvēlies citu auditoriju.'},
 civic:{title:'Pašvaldības un līdzdalība',icon:'▤',subtitle:'Sēdes un sabiedrības līdzdalība'}
};
export const HOME_GROUP_KEYS=['music','stage','culture','sport','active','markets','learning','community'];
export const AUDIENCE_FILTERS={family:'Ģimenēm ar bērniem',adults:'Pieaugušajiem',seniors:'Senioriem'};
const normalized=value=>String(value||'').trim().toLocaleLowerCase('lv');
const oneOf=(value,options)=>options.some(x=>normalized(x)===normalized(value));
// Council, committee and commission meetings and deputies' office hours. Municipal
// calendars file them under ordinary labels ("Pašvaldība", "Tikšanās", "Sanāksme"),
// so the name decides here; it is the only label taken from the title.
const COUNCIL_MEETING=/(?:domes|komitejas|komisijas|padomes|komiteju)\s+(?:ārkārtas\s+)?sēd(?:e|es|ē)(?![a-zāčēģīķļņšūž])|deputāt[a-zāčēģīķļņšūž]*\s+pieņemšan/i;
export function isCouncilMeeting(title){return COUNCIL_MEETING.test(String(title||''));}
export function eventGroup(e){
 const type=e.event_type,category=e.primary_category;
 if(type==='government'||isCouncilMeeting(e.title)||oneOf(category,['Domes sēde','Domes sēdes','Komitejas sēde','Komiteju sēde','Domes un komiteju sēdes','konsultatīvās padomes sēde','Iedzīvotāju padome','Rīgas domes sēdes','Gulbenes novada pašvaldības domes sēde','Deputāts','Sēdes darba kārtība']))return 'civic';
 if(type==='sports_match'||type==='sports_competition')return 'sport';
 if(type==='exhibition')return 'culture';
 if(type==='concert')return 'music';
 if(['performance','cinema'].includes(type))return 'stage';
 if(['workshop','education'].includes(type))return 'learning';
 if(type==='market')return 'markets';
 if(type==='health')return 'active';
 if(type==='books')return 'culture';
 if(oneOf(category,['Velobrauciens','Ekskursija','Aktīvā atpūta','Atpūta pie dabas','Sports un aktīvā atpūta','Sporta aktivitātes','Sporta un veselību veicinošie pasākumi','Veselība','Veselības veicināšana un slimību profilakse','Meditācijas nodarbība','Izdzīvošanas pamati']))return 'active';
 if(type==='sports'||sourceType(e)!=='municipality'||oneOf(category,['Sports','Basketbols','Futbols','Vieglatlētika','Sporta sacensības','Sporta pasākumi','Handbols','Hokejs','Volejbols','Florbols']))return 'sport';
 if(oneOf(category,['Koncerts','Koncerti','Balle']))return 'music';
 if(oneOf(category,['Izrāde','Teātris','Stāvizrāde','Kino']))return 'stage';
 if(oneOf(category,['Izstāde','Izstādes','gleznu izstāde','Dzejas dienas','grāmatu klubiņš','Kultūra un māksla']))return 'culture';
 if(oneOf(category,['Tirgus','Svētki','Festivāls']))return 'markets';
 if(oneOf(category,['Radošā darbnīca / Meistarklase','Radošās darbnīcas','Meistarklase','Semināri un meistarklases','Seminārs','Lekcija','Apmācības','Izglītība','Erudīcijas spēle']))return 'learning';
 if(type==='community'||oneOf(category,['Reliģisks pasākums','Ceremonija','Tikšanās','Senioriem','Seniori','Kopienās','Iedzīvotājiem','Sabiedrība']))return 'community';
 return ''; // Unclear source labels stay unclassified, not guessed.
}
export function audienceKey(value){return Object.hasOwn(AUDIENCE_FILTERS,value)?value:'';}
export function matchesAudience(e,key){
 if(!audienceKey(key))return true;
 const labels=[e.primary_category,...(e.tags||[])];
 if(key==='seniors')return labels.some(x=>oneOf(x,['Senioriem','Seniori']));
 // No verified family/adult audience labels currently exist in the imported taxonomy.
 // Do not infer suitability from titles, venue, sport participant ages or lack of restrictions.
 return false;
}
export function homeCategoryKey(value){return Object.hasOwn(HOME_CATEGORY_FILTERS,value)?value:'';}
export function matchesHomeCategory(e,key){
 if(key==='family')return matchesAudience(e,'family');
 if(!homeCategoryKey(key))return eventGroup(e)!=='civic';
 return eventGroup(e)===key;
}
// Sports federations whose schedules are imported, by governing body and by source domain.
const SPORT_BODIES={LHF:'hockey',LVF:'volleyball',LFS:'floorball'};
const SPORT_DOMAINS={'handball.lv':'handball','lhf.lv':'hockey','volejbols.lv':'volleyball','floorball.lv':'floorball'};
export function sourceType(e){
 const body=String(e.governing_body||'').toUpperCase();
 if(String(e.sport_format||'').toLowerCase()==='basketball'||body==='LBS')return 'basketball';
 if(body==='LFF')return 'lff';
 if(SPORT_BODIES[body])return SPORT_BODIES[body];
 const sources=(e.sources||[]).map(s=>String(s.source||'').toLowerCase());
 if(sources.includes('estlatbl.com')||sources.includes('basket.lv'))return 'basketball';
 if(sources.includes('lff.lv'))return 'lff';
 if(sources.includes('athletics.lv'))return 'athletics';
 for(const [domain,type] of Object.entries(SPORT_DOMAINS))if(sources.includes(domain))return type;
 return 'municipality';
}
export const SOURCE_TYPES=['municipality','lff','basketball','hockey','volleyball','floorball','handball','athletics'];
// Governing body of each league filter, for the "Turnīrs" choice under one sport.
export const SOURCE_TYPE_BODY={lff:'LFF',hockey:'LHF',volleyball:'LVF',floorball:'LFS'};

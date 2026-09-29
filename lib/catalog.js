// Explicit public field allowlist: never return an upstream object directly.
export const PUBLIC_FIELDS = ['id','title','description','date_from','date_to','time_from','time_to','timezone','schedule_type','time_type','attendance_mode','record_type','event_type','primary_category','status','price_status','price_text','price_min','price_max','currency','terms','venue_name','address_raw','alternative_address','location_precision','location_note','municipality','settlement','country_code','latitude','longitude','updated_at','governing_body','competition_key','competition_name','competition_season','competition_type','sport_format','competition_stage','competition_group','age_group','home_team','away_team','source_match_id'];
export function publicEvent(row) {
  const event = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, row[key] ?? null]));
  event.tags = Array.isArray(row.tags) ? row.tags.filter(x => typeof x === 'string') : [];
  event.sources = (Array.isArray(row.sources) ? row.sources : []).map(s => ({source: String(s.source || ''), url: safeUrl(s.url)}));
  return event;
}
export function safeUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export const statuses = {pending_review:'Jāpārbauda',published:'Publicēts',cancelled:'Atcelts'};
export const prices = {free:'Bez maksas',paid:'Maksas',mixed:'Daļēji maksas',unknown:'Nav zināms'};
export function dateLabel(value) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : 'Nav norādīts'; }
export function timeLabel(e) { return e.time_type==='all_day' ? 'Visu dienu' : e.time_type==='end_only' && e.time_to ? `Līdz ${e.time_to.slice(0,5)}` : [e.time_from?.slice(0,5),e.time_to?.slice(0,5)].filter(Boolean).join('–') || 'Nav norādīts'; }
export function mapLabel(e) { return e.latitude==null || e.longitude==null ? 'Bez kartes punkta' : ['municipality_center','settlement_center'].includes(e.location_precision) ? 'Aptuvena lokācija' : 'Norises vietas punkts'; }
export const columns = [
 ['date_from','Datums no',14],['date_to','Datums līdz',14],['time','Laiks',20],['title','Pasākums',55],['competition_name','Turnīrs',30],['competition_stage','Posms / kārta',22],['age_group','Vecuma grupa',18],['municipality','Norises pašvaldība',26],['country_code','Valsts',14],['event_type','Tips',22],['tags','Kategorijas / birkas',30],['venue_name','Norises vieta',35],['address_raw','Adrese',35],['alternative_address','Alternatīvā adrese / kartes punkts',40],['price_status','Maksas statuss',20],['price_text','Dalības maksa',24],['status','Statuss',20],['map_status','Kartes punkts',24],['source','Avots',25],['source_url','Avota saite',50]
];
export const detailColumns = [['description','Apraksts',70],['competition_season','Turnīra sezona',18],['competition_group','Grupa / zona',24],['sport_format','Sporta formāts',20],['terms','Dalības nosacījumi',45],['primary_category','Pamatkategorija',25],['price_min','Minimālā cena',18],['price_max','Maksimālā cena',18],['currency','Valūta',12],['settlement','Apdzīvotā vieta',25],['country_code','Valsts',14],['latitude','Platums',18],['longitude','Garums',18],['location_note','Vietas precizējums',50],['timezone','Laika josla',22],['schedule_type','Norises grafiks',22],['time_type','Laika veids',22],['attendance_mode','Dalības veids',22],['record_type','Ieraksta veids',22],['updated_at','Dati laboti',28]];
const labels = {single_day:'Viena diena',date_range:'Datumu periods',continuous:'Datumu periods',selected_dates:'Atsevišķi datumi',collection:'Pasākumu apkopojums',recurring:'Atkārtojas',unknown:'Nav zināms',all_day:'Visu dienu',unspecified:'Nav norādīts',fixed_interval:'Laika intervāls',start_only:'Sākuma laiks',end_only:'Beigu laiks',in_person:'Klātienē',online:'Tiešsaistē',hybrid:'Klātienē un tiešsaistē',event:'Pasākums',needs_review:'Jāpārbauda',approved:'Pārbaudīts',rejected:'Noraidīts'};
export function display(e,key) {
 if(key==='time') return timeLabel(e);
 if(key==='map_status') return mapLabel(e);
 if(key==='tags') return (e.tags?.length ? e.tags : [e.primary_category]).filter(Boolean).join(', ');
 if(key==='source') return e.sources?.map(s=>s.source).filter(Boolean).join(', ') || '';
 if(key==='source_url') return e.sources?.map(s=>s.url).filter(Boolean).join('\n') || '';
 if(key==='status') return statuses[e.status] || e.status || 'Nav norādīts';
 if(key==='price_status') return prices[e.price_status] || e.price_status || 'Nav zināms';
 if(key==='country_code') return ({LV:'Latvija',EE:'Igaunija',LT:'Lietuva'})[e.country_code] || e.country_code || '';
 if(key==='sport_format') return ({football:'Futbols',futsal:'Futzāls',beach_football:'Pludmales futbols',basketball:'Basketbols'})[e.sport_format] || e.sport_format || '';
 if(key==='date_from'||key==='date_to') return dateLabel(e[key]);
 if(['schedule_type','time_type','attendance_mode','record_type'].includes(key)) return labels[e[key]] || e[key] || '';
 return e[key] == null ? '' : String(e[key]);
}
export const initialFilters = {search:'',municipality:'',category:'',status:'',price:'',from:'',to:''};
const normalize = v => String(v||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function filterEvents(rows, f) {
 if(f.from && f.to && f.from>f.to) return [];
 const q=normalize(f.search);
 return rows.filter(e=>(!q || normalize([e.title,e.description,e.venue_name,e.address_raw,e.municipality,e.primary_category,...(e.tags||[])].join(' ')).includes(q)) && (!f.municipality||e.municipality===f.municipality) && (!f.category||e.primary_category===f.category||e.tags?.includes(f.category)) && (!f.status||e.status===f.status) && (!f.price||e.price_status===f.price) && (!f.from||(e.date_to||e.date_from)>=f.from) && (!f.to||e.date_from&&e.date_from<=f.to));
}

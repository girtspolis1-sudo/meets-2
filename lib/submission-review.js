// Review of organizer submissions: reasons, ready-made comments and automatic checks.
// Reason codes must match meets_private.submission_reason_label in the database.

export const CHANGE_REASONS=[
 {code:'location',label:'Norises vieta vai adrese',organizer:'Jāprecizē norises vieta vai adrese',
  template:'Lūdzu, norādi precīzu norises vietas nosaukumu un adresi vai atzīmē vietu kartē.'},
 {code:'datetime',label:'Datums vai laiks',organizer:'Jāprecizē datums vai laiks',
  template:'Lūdzu, pārbaudi pasākuma datumu un sākuma laiku.'},
 {code:'description',label:'Apraksts',organizer:'Jāpapildina apraksts',
  template:'Lūdzu, papildini aprakstu: kas notiks, kam pasākums paredzēts un kas jāzina apmeklētājiem.'},
 {code:'price',label:'Cena vai biļetes',organizer:'Jāprecizē cena vai biļešu informācija',
  template:'Lūdzu, norādi cenu vai ieejas maksas diapazonu EUR.'},
 {code:'image',label:'Attēls',organizer:'Jānomaina attēls',
  template:'Lūdzu, nomaini attēlu: tam jābūt saistītam ar pasākumu un bez liela teksta apjoma.'},
 {code:'other',label:'Cits',organizer:'Cits iemesls',template:''}
];

export const DECLINE_REASONS=[
 {code:'duplicate',label:'Dublikāts',organizer:'Pasākums MEETS jau ir publicēts',
  template:'Šis pasākums MEETS jau ir publicēts, tāpēc otru ierakstu nepublicējam.'},
 {code:'past',label:'Jau noticis',organizer:'Pasākums jau ir noticis',
  template:'Pasākuma datums jau ir pagājis.'},
 {code:'not_public',label:'Nav publisks',organizer:'Pasākums nav publiski apmeklējams',
  template:'MEETS publicē tikai pasākumus, kurus var apmeklēt ikviens interesents.'},
 {code:'out_of_scope',label:'Neatbilst kritērijiem',organizer:'Neatbilst MEETS pasākumu kritērijiem',
  template:'Ieraksts neatbilst MEETS pasākumu kritērijiem.'},
 {code:'spam',label:'Reklāma / nekorekts saturs',organizer:'Reklāma vai nekorekts saturs',template:''},
 {code:'other',label:'Cits',organizer:'Cits iemesls',template:''}
];

const ALL=[...CHANGE_REASONS,...DECLINE_REASONS];
export function reasonLabel(code){return ALL.find(r=>r.code===code)?.organizer||'';}
export function reasonTemplate(action,code){
 return (action==='decline'?DECLINE_REASONS:CHANGE_REASONS).find(r=>r.code===code)?.template||'';
}
// "Cits" needs a comment; every non-publish decision needs a reason.
export function reviewProblem(action,reason,note){
 if(action==='publish')return '';
 if(!reason)return action==='decline'?'Izvēlies noraidīšanas iemeslu.':'Izvēlies, kas jāprecizē.';
 if(reason==='other'&&!String(note||'').trim())return 'Pie iemesla “Cits” uzraksti komentāru.';
 return '';
}

export function inLatvia(lat,lon){
 const a=Number(lat),b=Number(lon);
 return lat!==''&&lon!==''&&lat!=null&&lon!=null&&Number.isFinite(a)&&Number.isFinite(b)&&a>=55&&a<=59&&b>=20&&b<=29;
}

// Automatic checks shown on the review card; "block" items stop publishing,
// and each one suggests the matching reason so a reply takes one click.
export function submissionChecks(item,today){
 const checks=[];
 const end=String(item?.date_to||item?.date_from||'');
 if(end&&end<today)checks.push({level:'block',text:'Pasākums jau noticis',action:'decline',reason:'past'});
 if((item?.possible_duplicates||[]).length)checks.push({level:'warn',text:'Līdzīgs pasākums tajā pašā datumā jau ir MEETS',action:'decline',reason:'duplicate'});
 if(!inLatvia(item?.latitude,item?.longitude))checks.push({level:'warn',text:'Organizators nav atzīmējis vietu kartē',action:'request_changes',reason:'location'});
 if(!String(item?.venue_name||'').trim()&&!String(item?.address||'').trim())checks.push({level:'block',text:'Nav norādīta ne vieta, ne adrese',action:'request_changes',reason:'location'});
 if(String(item?.description||'').trim().length<40)checks.push({level:'warn',text:'Apraksts ir ļoti īss',action:'request_changes',reason:'description'});
 if(['paid','mixed'].includes(item?.price_status)&&(item?.price_min==null||item?.price_max==null))checks.push({level:'warn',text:'Maksas pasākumam nav norādīta cena',action:'request_changes',reason:'price'});
 if(!item?.time_from&&item?.schedule_kind!=='recurring')checks.push({level:'info',text:'Nav norādīts sākuma laiks',action:'request_changes',reason:'datetime'});
 return checks;
}

const HISTORY={submitted:'Iesniegts',resubmitted:'Iesniegts atkārtoti',updated:'Organizators laboja',
 published:'Publicēts',auto_published:'Publicēts automātiski',changes_requested:'Lūgts precizēt',declined:'Noraidīts'};
export function historyLabel(entry){
 const reason=reasonLabel(entry?.reason);
 return (HISTORY[entry?.action]||entry?.action||'')+(reason?' · '+reason:'');
}

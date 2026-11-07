// "What to do first" list for the admin overview, most urgent first.
const DAY=24*60*60*1000;
function addDays(iso,days){return new Date(Date.parse(iso+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);}

export function upcomingWithoutPlace(events,needsLocation,today,days=7){
 const until=addDays(today,days);
 return (Array.isArray(events)?events:[]).filter(e=>e?.status==='pending_review'&&needsLocation(e)&&String(e.date_from||'')<=until)
  .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));
}

export function adminPriorities({submissionQueue,publishedNeedsReview=[],upcoming=[],readyToPublish=[],mappingGroups=[],importProblems=0,duplicates=0}){
 const list=[];
 if(submissionQueue?.count){
  const late=submissionQueue.oldestDays>=2;
  list.push({key:'submissions',tone:late?'bad':'warn',count:submissionQueue.count,view:'userSubmissions',
   title:submissionQueue.count===1?'Rīkotāja pasākums gaida atbildi':'Rīkotāju pasākumi gaida atbildi',
   detail:(submissionQueue.oldestDays?'Vecākais gaida '+submissionQueue.oldestDays+' '+(submissionQueue.oldestDays===1?'dienu':'dienas'):'Iesniegts šodien')
    +'. Mērķis: atbildēt 2 darba dienu laikā.',action:'Izskatīt'});
 }
 if(publishedNeedsReview.length)list.push({key:'published',tone:'bad',count:publishedNeedsReview.length,view:'all',
  title:'Publicēti pasākumi, kas jāprecizē',detail:'Apmeklētāji tos jau redz. Atver sarakstu ar iemesliem.',action:'Labot',filter:{bucket:'review'}});
 if(upcoming.length)list.push({key:'upcoming',tone:'warn',count:upcoming.length,view:'mapping',
  title:'Tuvāko 7 dienu pasākumi bez precīzas vietas',detail:'Bez vietas tie netiks publicēti laikā. Pirmais: '+upcoming[0].title,action:'Sakārtot vietas'});
 if(readyToPublish.length)list.push({key:'ready',tone:'info',count:readyToPublish.length,view:'overview-ready',
  title:'Gatavi publicēšanai',detail:'Vieta pārbaudīta, atliek publicēt.',action:'Skatīt'});
 const suggested=mappingGroups.filter(g=>(g.candidates||[]).length).length;
 if(mappingGroups.length)list.push({key:'mapping',tone:'info',count:mappingGroups.length,view:'mapping',
  title:'Neatpazītas vietas',detail:suggested?(suggested===1?'1 vietai jau ir ieteikums':suggested+' vietām jau ir ieteikumi')+', ko apstiprināt ar vienu klikšķi.':'Palaid vietu meklēšanu, lai iegūtu ieteikumus.',action:'Vietas'});
 if(duplicates)list.push({key:'duplicates',tone:'warn',count:duplicates,view:'all',filter:{issue:'duplicate'},
  title:'Iespējami dublikāti',detail:'Tas pats nosaukums, diena un vieta. Atstāj vienu, pārējos arhivē.',action:'Pārskatīt'});
 if(importProblems)list.push({key:'imports',tone:'warn',count:importProblems,view:'overview-imports',
  title:'Datu avoti, kas jāpārbauda',detail:'Imports novecojis, neizdevās vai nav automatizēts.',action:'Skatīt'});
 return list;
}

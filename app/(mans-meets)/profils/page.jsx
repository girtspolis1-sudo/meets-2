'use client';
import Link from 'next/link';
import {useMemo} from 'react';
import {ProfileIcon} from '../../components/profile-shell.jsx';
import {useEvents} from '../../../lib/use-events.js';
import {rigaDate} from '../../../lib/meets-personal.js';
import {PersonalEventList} from '../../components/personal-event-row.jsx';
import {eventsAtPlace} from '../../../lib/location-follow.js';
import {useAccountData} from '../../../lib/account-store.js';

function Metric({number,label,icon,href}){return <Link href={href} className="meets-profile-stat"><ProfileIcon name={icon} size={19}/><strong className="meets-profile-stat-number">{number??'–'}</strong><span className="meets-profile-stat-label">{label}</span></Link>;}

export default function ProfilePage(){
 const {data:eventData}=useEvents();
 const list=useAccountData('list'),dash=useAccountData('dashboard');
 const personal=list.data||{},dashboard=dash.data||{};
 const events=eventData?.events||[];
 const byId=useMemo(()=>new Map([...(dashboard.savedDetails||[]).map(e=>[e.id,e]),...events.map(e=>[e.id,e])]),[events,dashboard.savedDetails]);
 const favoriteIds=new Set(personal.favorites||[]),planIds=new Set(personal.plans||[]);
 const followedIds=new Set([...(dashboard.followedEvents||[]),...(dashboard.locationFollows||[]).flatMap(place=>eventsAtPlace(events,place.location_key).map(e=>e.id))]);
 const isUpcoming=e=>e?.date_from&&String(e.date_to||e.date_from)>=rigaDate();
 const byDate=(a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'));
 const visibleIds=[...new Set([...favoriteIds,...planIds,...followedIds])];
 const allUpcoming=visibleIds.map(id=>byId.get(id)).filter(isUpcoming).sort(byDate).slice(0,12);
 const badgesFor=e=>[favoriteIds.has(e.id)?'Favorīts':null,planIds.has(e.id)?'Plānoju':null,followedIds.has(e.id)?'No sekošanas':null].filter(Boolean);
 const following=dash.data?(dashboard.locationFollows||[]).length+(dashboard.follows||[]).filter(x=>['organization','venue'].includes(x.target_kind)).length:null;
 const warning=list.error||dash.error?'Daļu informācijas šobrīd neizdevās ielādēt. Vari turpināt lietot kontu.':'';

 return <div className="meets-profile-overview">
  {warning&&<p className="meets-profile-hint" role="status">{warning} <button type="button" className="text-button" onClick={()=>{list.reload().catch(()=>{});dash.reload().catch(()=>{});}}>Mēģināt vēlreiz</button></p>}
  <section className="meets-profile-summary" aria-labelledby="profile-overview-heading">
    <div className="meets-profile-summary-heading"><div><p className="eyebrow">MANS MEETS</p><h1 id="profile-overview-heading">Pārskats</h1></div><Link href="/karte" className="meets-profile-summary-action"><ProfileIcon name="map"/> Atrast pasākumu</Link></div>
    <div className="meets-profile-summary-stats" aria-label="Tavs MEETS pārskats" aria-busy={list.loading||dash.loading}>
      <Metric icon="heart" number={personal.favorites?.length} label="Saglabāti" href="/mani-pasakumi"/>
      <Metric icon="calendar" number={personal.plans?.length} label="Plānoti" href="/mani-pasakumi"/>
      <Metric icon="pin" number={following} label="Sekoju" href="/sekosana"/>
    </div>
  </section>
  <section className="meets-profile-panel">
   <div className="meets-profile-panel-header"><h2>Mani tuvākie pasākumi</h2><Link href="/mani-pasakumi">Visi →</Link></div>
   {list.loading&&!list.data?<p className="meets-muted" role="status">Ielādē tavus pasākumus…</p>:
    <PersonalEventList events={allUpcoming} badgesFor={badgesFor} empty="Pagaidām nav gaidāmu saglabātu vai sekotu pasākumu."/>}
  </section>
 </div>;
}

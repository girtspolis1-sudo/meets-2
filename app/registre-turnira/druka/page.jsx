'use client';
import {Suspense,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {accountRequest,useAccountSession} from '../../../lib/account-store.js';
import {qrPath} from '../../../lib/qr-path.js';
import PrintToolbar from '../../turniri/print-toolbar.jsx';
import PrintFit from '../../turniri/print-fit.jsx';
import {PrintSheets,sheetChoices} from '../../turniri/print-sheets.jsx';

// The organizer's print view: also for a draft, and with coaches in the groups.
function OrganizerPrint(){
 const params=useSearchParams();
 const {session,ready}=useAccountSession();
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [choice,setChoice]=useState(params.get('lapa')||'visas');
 useEffect(()=>{
  if(!ready)return;
  if(!session){setError('Pieslēdzies MEETS kontam.');return;}
  accountRequest('/api/tournaments','get',{id:params.get('id')||''})
   .then(got=>setData({...got.tournament,settings:got.tournament.settings||{},teams:got.teams,games:got.games,scorers:got.scorers||[]}))
   .catch(e=>setError(e.message));
 },[ready,session]);
 const link=data?window.location.origin+'/turniri/'+data.share_token:'';
 const qr=useMemo(()=>link?qrPath(link):null,[link]);
 if(error)return <main className="tn-print-screen"><p className="meets-inline-error" role="alert">{error}</p></main>;
 if(!data)return <main className="tn-print-screen"><p role="status">Ielādē…</p></main>;
 return <div className="tn-print-screen">
  <PrintFit/>
  <PrintToolbar backHref={'/registre-turnira?id='+data.id} choices={sheetChoices(data)} choice={choice} onChoose={setChoice}/>
  {data.status!=='published'&&<p className="tn-print-note">Turnīrs vēl nav publicēts: QR kods sāks darboties pēc publicēšanas.</p>}
  {!data.scorers.length&&<p className="tn-print-note">Laukumu lapās nav sekretāru QR koda: izveido saites vednī sadaļā “Publicēšana un saites”.</p>}
  <PrintSheets data={data} link={link} qr={qr} choice={choice} showScores={true} scorers={Object.fromEntries(data.scorers.map(s=>[s.court,window.location.origin+'/rezultati/'+s.token]))}/>
 </div>;
}
export default function OrganizerPrintPage(){return <Suspense fallback={null}><OrganizerPrint/></Suspense>;}

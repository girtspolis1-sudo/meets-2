'use client';
import {useEffect,useRef,useState} from 'react';
import PersonalDashboard from './personal-dashboard.jsx';
import Link from 'next/link';
import {useEvents} from '../../../lib/use-events.js';
import {accountRequest,setAccountData,useAccountData,useAccountSession} from '../../../lib/account-store.js';

const LOCAL='meets_favorites_v1';
const FAVORITE_OWNER='meets_favorites_owner_v1';
function getLocal(){try{const ids=JSON.parse(localStorage.getItem(LOCAL)||'[]');return Array.isArray(ids)?ids:[];}catch{return [];}}
function storeLocal(ids,owner){try{if(owner)localStorage.setItem(FAVORITE_OWNER,owner);localStorage.setItem(LOCAL,JSON.stringify(ids));window.dispatchEvent(new Event('meets-favorites-changed'));}catch{}}

export default function MyEvents(){
 const {session}=useAccountSession();
 const {data:list,error:loadError,loading:listLoading,reload}=useAccountData('list');
 const {data,loading}=useEvents();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const merged=useRef('');
 const favorites=list?.favorites||[],plans=list?.plans||[],visits=list?.visits||[];

 // Favorites saved before signing in are added to the account once per user.
 useEffect(()=>{
  const userId=session?.user?.id;
  if(!list||!userId||merged.current===userId)return;
  merged.current=userId;
  const owner=localStorage.getItem(FAVORITE_OWNER);
  const pending=(owner&&owner!==userId?[]:getLocal()).filter(id=>!list.favorites?.includes(id));
  (async()=>{
   const added=[];
   for(const eventId of pending){try{await accountRequest('/api/account','add',{eventId});added.push(eventId);}catch{}}
   const next=[...new Set([...(list.favorites||[]),...added])];
   if(added.length)setAccountData('list',d=>({...d,favorites:next}));
   storeLocal(next,userId);
  })();
 },[list,session?.user?.id]);

 async function change(id,kind){
  setBusy(true);setError('');
  try{
   const field=kind==='plan'?'plans':kind==='visit'?'visits':'favorites';
   const current=list?.[field]||[],present=current.includes(id);
   const action=kind==='plan'?(present?'unplan':'plan'):kind==='visit'?(present?'unvisit':'visit'):(present?'remove':'add');
   await accountRequest('/api/account',action,{eventId:id});
   const next=present?current.filter(x=>x!==id):[...current,id];
   setAccountData('list',d=>({...d,[field]:next}));
   if(field==='favorites')storeLocal(next);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }

 return <section className="meets-account-page">
  <div className="meets-account-heading"><div><p className="eyebrow">Tavs MEETS</p><h1>Saglabātie pasākumi</h1><p className="meets-muted">Saglabā, plāno un atrodi pasākumus vienuviet.</p></div><Link href="/karte" className="button">Karte ↗</Link></div>
  {loadError&&<p className="meets-inline-error" role="alert">{loadError.message} <button type="button" className="text-button" onClick={()=>reload().catch(()=>{})}>Mēģināt vēlreiz</button></p>}
  {listLoading?<p className="meets-muted" role="status">Ielādē saglabātos pasākumus…</p>:
   <PersonalDashboard favorites={favorites} plans={plans} visits={visits} onToggle={change}
    busy={busy} events={data?.events||[]} loading={loading}/>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </section>;
}

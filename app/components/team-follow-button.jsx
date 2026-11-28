'use client';
import {useState} from 'react';
import Icon from './line-icon.jsx';
import {accountRequest,invalidateAccountData,setAccountData,useAccountData,useAccountSession} from '../../lib/account-store.js';
import {teamKey} from '../../lib/team-key.js';

// "Sekot komandai": a team is its name within a sport (lib/team-key.js). Following is
// kept in the account; without one the button leads to signing in. Nothing is sent
// to anyone: the followed team's games show on /sekosana and in the profile.
export default function TeamFollowButton({name,sport,className='button compact',label='Sekot komandai',followingLabel='Seko komandai'}){
 const {session}=useAccountSession();
 const dashboard=useAccountData('dashboard',{enabled:Boolean(session)});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const key=teamKey(name,sport);
 if(!key)return null;
 const following=(dashboard.data?.teamFollows||[]).some(f=>f.team_key===key);
 async function toggle(){
  if(!session){window.location.assign('/profils#pieslegties');return;}
  setBusy(true);setMessage('');
  try{
   await accountRequest('/api/account','followTeam',{teamName:name,sport,enabled:!following});
   setAccountData('dashboard',d=>({...(d||{}),teamFollows:following
    ?(d?.teamFollows||[]).filter(f=>f.team_key!==key)
    :[{team_key:key,team_name:String(name).trim(),sport},...(d?.teamFollows||[])]}));
   // The team's coming games come with the next dashboard load.
   invalidateAccountData('dashboard');
   setMessage(following?'Sekošana pārtraukta.':'Tagad seko komandai.');
  }catch(e){setMessage(e.message||'Sekošanu neizdevās saglabāt.');}
  finally{setBusy(false);}
 }
 return <span className="meets-follow-control team-follow">
  <button type="button" className={className} aria-pressed={following} disabled={busy||(Boolean(session)&&dashboard.loading)} onClick={toggle}
   aria-label={(following?'Pārtraukt sekot komandai: ':'Sekot komandai: ')+name}>
   <Icon name="bell" size={16} fill={following?'currentColor':'none'}/>{following?followingLabel:label}
  </button>
  {message&&<small role="status">{message}</small>}
 </span>;
}

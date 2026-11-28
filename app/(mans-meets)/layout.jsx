'use client';
import '../workspace/styles.js';
// One layout for the personal pages, so the profile shell stays mounted while
// switching between them and the session is known before anything renders.
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import ProfileShell from '../components/profile-shell.jsx';
import GuestSaved from './guest-saved.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {saveSession,useAccountData,useAccountSession} from '../../lib/account-store.js';
import {readAuthRedirect} from '../../lib/auth-client.js';

export default function MansMeetsLayout({children}){
 const {session,ready}=useAccountSession();
 const pathname=usePathname()||'';
 const registries=useAccountData('registries',{enabled:Boolean(session)});
 const avatar=useAccountData('avatar',{enabled:Boolean(session)});
 const [linkMessage,setLinkMessage]=useState('');
 // The e-mail confirmation link and Google return here with the new session in the URL hash.
 useEffect(()=>{
  readAuthRedirect().then(result=>{
   if(result?.session){
    saveSession(result.session);
    setLinkMessage(result.type!=='google'?'E-pasts apstiprināts. Laipni lūdzam meets.lv.':result.linked?'Google konts pievienots. Turpmāk vari pieslēgties arī ar Google.':'Tu esi pieslēdzies ar Google.');
   }
   else if(result?.error)setLinkMessage(result.error);
  }).catch(e=>setLinkMessage(e.message));
 },[]);
 const banner=linkMessage&&<p className="meets-profile-hint" role="status">{linkMessage}</p>;
 if(!ready)return <div className="meets-profile-skeleton" role="status">Ielādē tavu meets.lv profilu…</div>;
 if(!session){
  const signIn=(intro,title='Mans profils',Heading='h1')=><section className={'meets-profile-auth'+(Heading==='h1'?'':' meets-guest-auth')} id="pieslegties" aria-labelledby="meets-auth-title">
   {Heading==='h1'&&<p className="eyebrow">MANS PROFILS</p>}
   <Heading id="meets-auth-title">{title}</Heading>
   <p className="meets-auth-intro">{intro}</p>
   {banner}
   <Authentication variant="profile" onSuccess={()=>{}}/>
  </section>;
  // Without an account: the events saved in this browser are shown, and following
  // says what it gives before asking to sign in.
  if(pathname==='/mani-pasakumi')return <div className="meets-guest-page">
   <p className="eyebrow">MANS PROFILS</p>
   <GuestSaved signInHref="/profils#pieslegties"/>
  </div>;
  if(pathname==='/sekosana')return <div className="meets-guest-page">
   <section className="meets-guest-explain" aria-labelledby="follow-explain-title">
    <p className="eyebrow">MANS PROFILS</p>
    <h1 id="follow-explain-title">Sekošana</h1>
    <p>Seko norises vietām un rīkotājiem, un viņu jaunie pasākumi būs vienuviet: tev nav jāpārbauda katra lapa atsevišķi.</p>
    <ul><li>Seko vietai pasākuma lapā vai kartē ar zvaniņu «Sekot vietai».</li><li>Seko rīkotājam viņa lapā vai pasākuma kartītē.</li><li>Jaunos pasākumus redzēsi šeit un sava profila pārskatā.</li></ul>
   </section>
   {signIn('Sekošana tiek glabāta kontā, lai tā būtu visās ierīcēs.','Pieslēgties','h2')}
  </div>;
  if(pathname==='/profils')return <div className="meets-guest-page">
   <p className="eyebrow">MANS PROFILS</p>
   <h1 className="meets-guest-title">Mans profils</h1>
   <GuestSaved title="Saglabātie" heading="h2" withCount/>
   {signIn('Pieslēdzies, lai saglabātie pasākumi, sekošana un konta iestatījumi būtu visās ierīcēs.','Pieslēgties','h2')}
  </div>;
  return signIn('Pieslēdzies, lai redzētu saglabātos pasākumus, sekošanu un konta iestatījumus.');
 }
 return <ProfileShell session={session} displayName={(registries.data?.profile?.display_name||'').trim()} avatarUrl={avatar.data?.avatar_url||avatar.data?.avatar_data_url||''}>
  {banner}{children}
 </ProfileShell>;
}

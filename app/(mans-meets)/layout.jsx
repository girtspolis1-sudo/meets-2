'use client';
// One layout for the personal pages, so the profile shell stays mounted while
// switching between them and the session is known before anything renders.
import ProfileShell from '../components/profile-shell.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {useAccountData,useAccountSession} from '../../lib/account-store.js';

export default function MansMeetsLayout({children}){
 const {session,ready}=useAccountSession();
 const registries=useAccountData('registries',{enabled:Boolean(session)});
 const avatar=useAccountData('avatar',{enabled:Boolean(session)});
 if(!ready)return <div className="meets-profile-skeleton" role="status">Ielādē tavu MEETS profilu…</div>;
 if(!session)return <section className="meets-profile-auth" aria-labelledby="meets-auth-title">
  <p className="eyebrow">MANS MEETS</p>
  <h1 id="meets-auth-title">Tavs MEETS vienuviet</h1>
  <p className="meets-auth-intro">Pieslēdzies, lai redzētu saglabātos pasākumus, sekošanu un konta iestatījumus.</p>
  <Authentication variant="profile" onSuccess={()=>{}}/>
 </section>;
 return <ProfileShell session={session} displayName={(registries.data?.profile?.display_name||'').trim()} avatarUrl={avatar.data?.avatar_data_url||''}>
  {children}
 </ProfileShell>;
}

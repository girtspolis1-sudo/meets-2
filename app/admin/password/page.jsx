import PasswordResetForm from './password-reset-form.jsx';

export const metadata={title:'Mainīt admin paroli'};

export default function AdminPasswordPage(){
 const supabaseUrl=process.env.SUPABASE_URL||'';
 const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';

 if(!supabaseUrl||!publishableKey){
  return <section className="section admin-page"><div className="error-message">Admin paroles maiņa nav pieejama — trūkst servera konfigurācijas.</div></section>;
 }

 return <section className="section admin-page">
  <p className="eyebrow">MEETS · admin</p>
  <h1>Mainīt paroli</h1>
  <p className="lead">Izvēlies jaunu paroli admin kontam.</p>
  <PasswordResetForm supabaseUrl={supabaseUrl} publishableKey={publishableKey}/>
 </section>;
}

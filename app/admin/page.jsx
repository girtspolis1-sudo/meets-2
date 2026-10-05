import AdminDashboard from './admin-dashboard.jsx';
import AdminEnvironment from './admin-environment.jsx';

export const metadata={title:'Admin'};

export default function AdminPage(){
 const supabaseUrl=process.env.SUPABASE_URL||'';
 const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
 return <><AdminEnvironment/><section className="section admin-page">
  <p className="eyebrow">MEETS 2 / Admin</p>
  <h1>Pasākumu pārvaldība</h1>
  <p className="lead">Pārbaudi pasākumus, publicē tos un koriģē norises vietu. Publicētās izmaiņas izmanto gan publiskā karte, gan pasākumu tabula/Excel.</p>
  <AdminDashboard supabaseUrl={supabaseUrl} publishableKey={publishableKey}/>
 </section></>;
}

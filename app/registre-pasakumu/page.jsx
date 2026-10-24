import Link from 'next/link';
export const metadata={title:'Pievienot pasākumu vai norises vietu'};
export default function RegisterEntry(){
 return <section className="meets-organizer-page quick-flow">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Organizatoriem</p>
   <h1>Ko vēlies pievienot?</h1><p className="meets-muted">Izvēlies darbību. Pasākumu var sākt veidot arī bez pieslēgšanās.</p></div>
   <Link className="button" href="/organizators">Organizatora kabinets →</Link></div>
  <div className="quick-flow-choices">
   <Link href="/registre-pasakumu/vienkarsi" className="quick-flow-choice">
    <span aria-hidden="true">▣</span><h2>Pasākumu</h2>
    <p>Koncerts, sacensības, tirdziņš, nodarbība vai cits notikums.</p>
    <strong>Pievienot pasākumu →</strong>
   </Link>
   <Link href="/registre-vietu" className="quick-flow-choice">
    <span aria-hidden="true">⌖</span><h2>Norises vietu</h2>
    <p>Skola, sporta centrs, parks vai cita vieta, kur vēlāk varēsi reģistrēt pasākumus.</p>
    <strong>Pievienot vietu →</strong>
   </Link>
  </div>
  <p className="quick-flow-note">Regulāriem grafikiem, komandām un vietu pārvaldībai pieejama <Link href="/organizators">paplašinātā organizatora vide</Link>.</p>
 </section>;
}

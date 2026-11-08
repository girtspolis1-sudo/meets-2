import Link from 'next/link';
import {CONTROLLER,PRIVACY_UPDATED,controllerPending} from '../../lib/legal.js';

export const metadata={
 title:'Privātuma politika',
 description:'Kā meets.lv apstrādā personas datus: konts, saglabātie pasākumi, rīkotāju dati, atrašanās vieta un tavas tiesības.'
};

const updated=new Intl.DateTimeFormat('lv-LV',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(PRIVACY_UPDATED+'T12:00:00Z'));
const pending='tiks papildināts';
const Mail=()=><a href={'mailto:'+CONTROLLER.email}>{CONTROLLER.email}</a>;

// What is processed, why, on which basis and for how long.
const PURPOSES=[
 ['MEETS konts','E-pasta adrese, parole (glabāta tikai neatgriezeniski šifrētā veidā), vārds, profila attēls, pieslēgšanās laiks.','Konta izveide un pieslēgšanās, paroles atjaunošana.','Līgums — pakalpojuma sniegšana (VDAR 6. panta 1. punkta b) apakšpunkts).','Kamēr konts pastāv. Kontu vari izdzēst pats konta iestatījumos.'],
 ['Mans MEETS','Saglabātie, plānotie un apmeklētie pasākumi, intereses, sekošana rīkotājiem, vietām un apdzīvotām vietām, atgādinājumi un paziņojumi vietnē, kopīgotie un iegulstamie saraksti.','Personīgie saraksti, atgādinājumi un ieteikumi.','Līgums (6. panta 1. punkta b) apakšpunkts).','Līdz tu ierakstu noņem vai izdzēs kontu.'],
 ['Pasākumu rīkošana','Rīkotāja profils (nosaukums, apraksts, logo, kontakti, adrese, sociālie tīkli, rekvizīti), komandas dalībnieki un lomas, ielūgumi, norises vietas, pasākumu pieteikumi un vāka attēli, privāto pasākumu saites.','Pasākumu iesniegšana, publicēšana kartē un sarakstā, privāto pasākumu kopīgošana un sludinājumi drukai.','Līgums (6. panta 1. punkta b) apakšpunkts). Publiski redzams tikai tas, ko rīkotājs atzīmē kā publisku, un publicētie pasākumi.','Kamēr rīkotāja profils pastāv. Beigušies pasākumi tiek arhivēti.'],
 ['MEETS pārbaude','Pārbaudes lēmumi, iemesli un piezīmes, e-pasta paziņojumi rīkotājam.','Publicēto pasākumu kvalitāte un drošība, ļaunprātīgas izmantošanas novēršana.','Leģitīmās intereses (6. panta 1. punkta f) apakšpunkts).','Kamēr pastāv attiecīgais pasākuma pieteikums.'],
 ['Atrašanās vieta','Ierīces atrašanās vieta, ja to atļauj pārlūkā; izvēlētā pilsēta vai vieta; adreses meklēšanā ievadītais teksts.','Tuvāko pasākumu rādīšana un attāluma filtrs, adrešu atrašana kartē.','Tava piekrišana pārlūka atļaujā (6. panta 1. punkta a) apakšpunkts); adrešu meklēšanai — līgums.','Ierīces atrašanās vieta tiek izmantota tikai tavā pārlūkā, un mēs to neglabājam serverī. Izvēlētā vieta tiek glabāta tavā ierīcē.'],
 ['Apmeklējumu statistika','Pseidonīms ierīces identifikators (sīkdatnēs), apmeklētās lapas (bez kopīgošanas saišu kodiem un privāto pasākumu nosaukumiem), meklēšanas vārdi, pasākumu atvēršana, saglabāšana un kopīgošana, ierīces un pārlūka veids, aptuvena atrašanās vieta (valsts, pilsēta), ko Google nosaka pēc IP adreses.','Saprast, kuras lapas un pasākumi noder, un uzlabot vietni.','Tava piekrišana (6. panta 1. punkta a) apakšpunkts). To vari atsaukt jebkurā laikā ar saiti “Sīkdatņu iestatījumi” kājenē.','14 mēneši Google Analytics. Ja nepiekrīti, statistika netiek ievākta un Google nekas netiek sūtīts.'],
 ['Tehniskie dati','IP adrese, pārlūka un ierīces dati, pieprasījumu žurnāli, kļūdu ziņojumi (lapas adrese un kļūdas teksts).','Vietnes darbība, drošība un kļūdu novēršana.','Leģitīmās intereses (6. panta 1. punkta f) apakšpunkts).','Īslaicīgi, atbilstoši hostinga un datubāzes pakalpojumu sniedzēju žurnālu termiņiem.'],
 ['Saziņa','Tava e-pasta adrese un vēstules saturs, ja raksti mums.','Atbilde uz jautājumu vai pieprasījumu.','Leģitīmās intereses vai juridisks pienākums (6. panta 1. punkta f) un c) apakšpunkts).','Līdz jautājums ir atrisināts un vēl līdz 1 gadam pieprasījumu uzskaitei.']
];

const PROCESSORS=[
 ['Supabase','Datubāze, autentifikācija un failu glabāšana (profila attēli, logo, vāka attēli).','ES — Frankfurte, Vācija.'],
 ['Vercel','Vietnes hostings un pieprasījumu žurnāli.','ES un ASV.'],
 ['Resend','E-pastu nosūtīšana (paziņojumi rīkotājiem un administratoriem).','ASV.'],
 ['OpenStreetMap Foundation (Nominatim)','Adrešu meklēšana: saņem meklēšanas tekstu, ko nosūtām no mūsu servera.','Apvienotā Karaliste.'],
 ['Google Ireland Limited (Google Analytics)','Apmeklējumu statistika, tikai ar tavu piekrišanu. Google signāli un reklāmu personalizācija ir izslēgti.','ES un ASV.'],
 ['OpenFreeMap','Kartes attēli: saņem tavu IP adresi un pārlūka datus, kad tiek ielādēta karte.','Pakalpojuma sniedzēja serveri (openfreemap.org).']
];

const STORAGE=[
 ['meets_user_session_v1','Pieslēgšanās sesija, lai paliktu pieslēgts.','Līdz izrakstīšanās brīdim vai sesijas beigām.'],
 ['meets_favorites_v1','Saglabātie pasākumi, kamēr neesi pieslēdzies.','Līdz tos noņem vai notīri pārlūka datus.'],
 ['meets_location_choice_v1','Izvēlētā pilsēta vai “Mana atrašanās vieta” tuvāko pasākumu rādīšanai.','Līdz izvēli maini vai notīri pārlūka datus.'],
 ['meets_event_draft_v3, meets_venue_draft_v3','Nepabeigtu pasākumu un vietu melnraksti, lai ievadītais nepazustu.','Līdz pasākums ir iesniegts vai forma notīrīta.'],
 ['meets_analytics_consent_v1','Tava izvēle par apmeklējumu statistiku (Pieņemt vai Noraidīt).','Līdz izvēli maini vai notīri pārlūka datus.']
];
// Set only after "Pieņemt" in the consent notice.
const COOKIES=[
 ['_ga','Google Analytics: atšķir apmeklētājus.','2 gadi'],
 ['_ga_35QTLEMNLP','Google Analytics: saglabā apmeklējuma (sesijas) stāvokli.','2 gadi']
];

export default function PrivacyPage(){
 const missing=controllerPending();
 return <article className="section legal-page">
  <p className="eyebrow">meets.lv</p>
  <h1>Privātuma politika</h1>
  <p className="lead">Šajā politikā skaidrots, kādus personas datus meets.lv apstrādā, kāpēc, cik ilgi un kādas ir tavas tiesības.</p>
  <p className="legal-updated">Pēdējās izmaiņas: {updated}</p>

  {missing&&<p className="legal-note" role="note">Pārziņa rekvizīti (nosaukums, reģistrācijas numurs un adrese) tiks papildināti. Līdz tam ar visiem jautājumiem par datiem raksti uz <Mail/>.</p>}

  <nav className="legal-toc" aria-label="Saturs">
   <ol>
    {['Pārzinis','Kādus datus apstrādājam','Ierīcē glabātā informācija','Kas saņem datus','Datu nodošana ārpus EEZ','Tavas tiesības','Bērni','Drošība','Izmaiņas'].map((title,i)=><li key={title}><a href={'#p'+(i+1)}>{title}</a></li>)}
   </ol>
  </nav>

  <section id="p1">
   <h2>1. Pārzinis</h2>
   <dl className="legal-facts">
    <div><dt>Pārzinis</dt><dd>{CONTROLLER.name||pending}</dd></div>
    <div><dt>Reģistrācijas numurs</dt><dd>{CONTROLLER.regNumber||pending}</dd></div>
    <div><dt>Adrese</dt><dd>{CONTROLLER.address||pending}</dd></div>
    <div><dt>E-pasts</dt><dd><Mail/></dd></div>
   </dl>
   <p>Rīkotāji, kas publicē pasākumus, paši atbild par to, kādu informāciju par citām personām (piemēram, kontaktpersonām) viņi ievieto pasākumu aprakstos.</p>
  </section>

  <section id="p2">
   <h2>2. Kādus datus apstrādājam</h2>
   <p>Pasākumus kartē un sarakstā vari skatīt bez konta. Kontu vajag tikai personīgajiem sarakstiem un pasākumu rīkošanai.</p>
   <div className="legal-cards">
    {PURPOSES.map(([title,data,purpose,basis,keep])=><section key={title} className="legal-card">
     <h3>{title}</h3>
     <dl>
      <div><dt>Dati</dt><dd>{data}</dd></div>
      <div><dt>Mērķis</dt><dd>{purpose}</dd></div>
      <div><dt>Tiesiskais pamats</dt><dd>{basis}</dd></div>
      <div><dt>Glabāšana</dt><dd>{keep}</dd></div>
     </dl>
    </section>)}
   </div>
   <p>Pasākumu informāciju, kas iegūta no publiskiem avotiem (pašvaldību un sporta organizāciju kalendāriem), mēs rādām ar saiti uz avotu. Ja tajā ir tavi dati un vēlies tos labot vai noņemt, raksti uz <Mail/>.</p>
  </section>

  <section id="p3">
   <h2>3. Ierīcē glabātā informācija</h2>
   <p>meets.lv neizmanto reklāmas sīkdatnes. Lai vietne darbotos, tavā pārlūkā (localStorage) tiek glabāti šādi ieraksti:</p>
   <div className="legal-table-scroll"><table className="legal-table">
    <thead><tr><th>Ieraksts</th><th>Kam vajadzīgs</th><th>Cik ilgi</th></tr></thead>
    <tbody>{STORAGE.map(([key,why,keep])=><tr key={key}><td><code>{key}</code></td><td>{why}</td><td>{keep}</td></tr>)}</tbody>
   </table></div>
   <p>Šie ieraksti ir nepieciešami pakalpojumam, ko pats pieprasi, tāpēc tiem nav vajadzīga atsevišķa piekrišana. Tos vari izdzēst pārlūka iestatījumos.</p>
   <h3>Analītikas sīkdatnes (tikai ar piekrišanu)</h3>
   <p>Pirmajā apmeklējumā jautājam, vai drīkstam skaitīt apmeklējumus ar Google Analytics. Kamēr neesi izvēlējies “Pieņemt”, Google Analytics netiek ielādēts un šīs sīkdatnes netiek iestatītas. Izvēli vari mainīt jebkurā laikā ar saiti “Sīkdatņu iestatījumi” kājenē; izvēloties “Noraidīt”, sīkdatnes tiek dzēstas.</p>
   <div className="legal-table-scroll"><table className="legal-table">
    <thead><tr><th>Sīkdatne</th><th>Kam vajadzīga</th><th>Cik ilgi</th></tr></thead>
    <tbody>{COOKIES.map(([key,why,keep])=><tr key={key}><td><code>{key}</code></td><td>{why}</td><td>{keep}</td></tr>)}</tbody>
   </table></div>
  </section>

  <section id="p4">
   <h2>4. Kas saņem datus</h2>
   <p>Datus nepārdodam un nenododam reklāmas vajadzībām. Tos apstrādā šie pakalpojumu sniedzēji (apstrādātāji), tikai lai meets.lv darbotos:</p>
   <div className="legal-table-scroll"><table className="legal-table">
    <thead><tr><th>Pakalpojuma sniedzējs</th><th>Ko dara</th><th>Datu atrašanās vieta</th></tr></thead>
    <tbody>{PROCESSORS.map(([who,what,where])=><tr key={who}><td>{who}</td><td>{what}</td><td>{where}</td></tr>)}</tbody>
   </table></div>
   <p>Rīkotāja publiskais profils, publicētie pasākumi un norises vietas ir redzami visiem. Privāts pasākums ir redzams tikai tiem, kam ir tā saite. Datus varam nodot arī valsts iestādēm, ja to prasa likums.</p>
  </section>

  <section id="p5">
   <h2>5. Datu nodošana ārpus EEZ</h2>
   <p>Daži pakalpojumu sniedzēji ir reģistrēti vai apstrādā datus ārpus Eiropas Ekonomikas zonas. Šādā gadījumā dati tiek nodoti, pamatojoties uz Eiropas Komisijas lēmumu par aizsardzības līmeņa pietiekamību (piemēram, ES un ASV datu privātuma regulējums vai lēmums par Apvienoto Karalisti) vai standarta līguma klauzulām.</p>
  </section>

  <section id="p6">
   <h2>6. Tavas tiesības</h2>
   <ul className="legal-list">
    <li><strong>Piekļūt</strong> saviem datiem un saņemt to kopiju.</li>
    <li><strong>Labot</strong> neprecīzus datus. Lielāko daļu vari labot pats savā kontā.</li>
    <li><strong>Dzēst</strong> datus. Kontu vari izdzēst pats <Link href="/konta-iestatijumi">konta iestatījumos</Link>; rīkotāja profils jāizdzēš pirms konta.</li>
    <li><strong>Ierobežot</strong> apstrādi vai <strong>iebilst</strong> pret apstrādi, kuras pamatā ir leģitīmās intereses.</li>
    <li><strong>Saņemt</strong> savus datus mašīnlasāmā formā (datu pārnesamība).</li>
    <li><strong>Atsaukt piekrišanu</strong>: apmeklējumu statistikai ar saiti “Sīkdatņu iestatījumi” kājenē, atrašanās vietas atļaujai pārlūka iestatījumos.</li>
   </ul>
   <p>Lai izmantotu šīs tiesības, raksti uz <Mail/>. Atbildēsim viena mēneša laikā. Ja uzskati, ka tavi dati tiek apstrādāti nelikumīgi, vari iesniegt sūdzību Datu valsts inspekcijai (<a href="https://www.dvi.gov.lv" target="_blank" rel="noopener noreferrer">www.dvi.gov.lv</a>).</p>
  </section>

  <section id="p7">
   <h2>7. Bērni</h2>
   <p>meets.lv konts nav paredzēts bērniem līdz 13 gadu vecumam. Ja uzzināsim, ka konts izveidots bērnam līdz 13 gadiem bez vecāku piekrišanas, to izdzēsīsim.</p>
  </section>

  <section id="p8">
   <h2>8. Drošība</h2>
   <p>Dati tiek pārsūtīti tikai šifrētā savienojumā (HTTPS). Paroles glabājam tikai neatgriezeniski šifrētā veidā, un piekļuvi datubāzei ierobežo piekļuves noteikumi katram lietotājam un rīkotājam. Ja notiks datu noplūde, kas var apdraudēt tavas tiesības, informēsim Datu valsts inspekciju 72 stundu laikā un, ja nepieciešams, arī tevi.</p>
  </section>

  <section id="p9">
   <h2>9. Izmaiņas</h2>
   <p>Mainot šo politiku, atjaunosim datumu lapas augšā. Par būtiskām izmaiņām informēsim reģistrētos lietotājus pa e-pastu vai vietnē.</p>
  </section>
 </article>;
}

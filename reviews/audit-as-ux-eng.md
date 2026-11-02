# UX audits: meets.lv admin sadaļa (/admin)

**Perspektīva**: UX inženieris
**Datums**: 2026-11-02
**Plāns**: esošā implementācija `app/admin/*` (admin-dashboard.jsx, admin-review-overview.jsx, admin-mapping-list.jsx, admin-user-submissions.jsx, admin-event-register.jsx, admin-import-health.jsx, lib/admin-priorities.js)
**Mērķis**: lai admins ātrāk un efektīvāk pārbauda un uzlabo pasākumu datus

## Kopsavilkums

Admin ir viens lietotājs (vai dažas personas), kas katru dienu izskata 3 rindas:
1. organizatoru iesniegumus;
2. importēto pasākumu vietas (Mapping);
3. publicēto pasākumu kvalitāti.

Pamati ir labi:
- "Ko darīt vispirms" prioritāšu saraksts;
- masveida vietu apstiprināšana;
- toast ar rezultātu;
- iemeslu šabloni iesniegumiem.

Lēnumu rada trīs lietas:
- **Nav "nākamais" plūsmas.** Pēc katras darbības admins atgriežas sarakstā un pats meklē nākamo ierakstu.
- **Atsvaidzinot lapu, pazūd skats.**
- **Pārbaude aptver tikai lokāciju.** Satura kvalitāte netiek pārbaudīta: dublikāti, tukši apraksti, HTML atliekas, aizdomīgi datumi.

## Lietotāja ceļš

| # | Solis | Stāvoklis |
|---|-------|-----------|
| 1 | Atver /admin → "Ielādē admin datus…" (3–6 s, nav progresa) | WARN: nav zināms, cik ilgi gaidīt |
| 2 | Redz 6 cilnes; kārtībā pirmā ir "Ierakstu reģistrs", bet atvērta ir "Pārskats" | WARN: secība neatbilst noklusējumam |
| 3 | Pārskats → "Ko darīt vispirms" → poga "Labot" / "Mapping" / "Izskatīt" | OK |
| 4 | Lietotāju pasākumi → izvēlas darbību → iemesls → "✓ Publicēt kartē" | OK: skaidri iemesli un šabloni |
| 5 | Pēc lēmuma kartīte pazūd; nākamā nav fokusā, un lapa var aizritēt | WARN |
| 6 | Mapping → "Apstiprināt visas (N)" → progress "Saglabā i/N" → toast | WARN: nav apstiprinājuma un nav atsaukšanas |
| 7 | Mapping → "Norādīt korekciju" → modālais redaktors → meklē → izvēlas → "Saglabāt mappingu" | WARN: pēc saglabāšanas modālis aizveras, jāklikšķina nākamais |
| 8 | Karte / masveida darbības → filtri → "Publicēt atlasītos" | WARN: statusu nosaukumi angliski, nav apstiprinājuma |
| 9 | "Publicēt" vienā rindā → toast 12 s | FAIL: nav atsaukšanas ("Atgriezt pārbaudei" ir citā skatā) |
| 10 | Atsvaidzina lapu (F5) vai atver saiti kolēģim | FAIL: vienmēr atver "Pārskats"; filtri un cilne pazūd |
| 11 | Meklē, vai pasākums nav dublikāts vai ar sliktu tekstu | FAIL: šādas pārbaudes nav |

## Verdikts: APSTIPRINĀT AR IZMAIŅĀM

## Kritiskās problēmas (jālabo)

| # | Problēma | Solis | Ietekme uz lietotāju | Labojums |
|---|----------|-------|----------------------|----------|
| 1 | Nav "Saglabāt un nākamais" plūsmas | 4, 7 | Katrs ieraksts prasa 3–4 liekus klikšķus un meklēšanu. Pie 100+ vietām tās ir stundas | Redaktorā pievienot pogu "Saglabāt un nākamais →" un rādīt "3 no 41". Pēc lēmuma fokusēt nākamo kartīti |
| 2 | Skats nav URL | 10 | Pēc F5 vai no e-pasta saites zūd konteksts, un skatu nevar nosūtīt citam | `?view=mapping&q=…&status=…` ar `replaceState` |
| 3 | Masveida darbībām nav apstiprinājuma un atsaukšanas | 6, 8 | Viens klikšķis publicē vai apstiprina desmitiem vietu. Kļūda kļūst publiska | Konkrēts apstiprinājums ("Publicēt 37 pasākumus?") un toast ar "Atsaukt" (atgriež `pending_review`, dzēš mappingu) |
| 4 | Nav satura kvalitātes pārbaudes | 11 | Kļūdas nonāk publiski. Admins tās var atrast tikai nejauši | Jauna rinda "Satura pārbaude": iespējami dublikāti (tas pats nosaukums, datums un vieta), tukšs apraksts, HTML vai `&nbsp;` atliekas, nosaukums tikai lielajiem burtiem, beigu datums pirms sākuma, pasākums ilgāk par 180 dienām, nav avota saites |
| 5 | Viena ieraksta publicēšanai nav atsaukšanas | 9 | Kļūdaini publicētu ierakstu jāmeklē citā skatā | Toast ar "Atsaukt" 12 s laikā |

## Ieteikumi

| # | Problēma | Ietekme | Labojums |
|---|----------|---------|----------|
| 6 | 6 cilnes, un 3 no tām pārklājas: "Ierakstu reģistrs", "Karte / masveida darbības", "Pārskats" | Nav skaidrs, kur ko darīt (Hika likums) | Sakārtot pēc darba plūsmas: **Šodien** (pārskats), **Iesniegumi**, **Vietas**, **Visi ieraksti** (reģistrs + karte + masveida darbības vienā), **Avoti**. Reģistru un "Karte / masveida" apvienot |
| 7 | Cilņu secība neatbilst noklusējumam: pirmā ir "Ierakstu reģistrs", bet atvērta "Pārskats" | Dezorientē | "Pārskats" likt pirmo |
| 8 | Žargons: "Mapping", "alias", "Pending review", "Published", "Cancelled", "Cron aktīvs", "date_to" | Lielāka kognitīvā slodze, jaukta valoda | "Vietu sasaiste", "Ielasītais nosaukums", "Gaida pārbaudi", "Publicēts", "Atcelts", "Automātiskā ielāde ieslēgta", "beigu datums" |
| 9 | Nav tastatūras īsceļu | Lēns darbs ar lielām rindām | `j`/`k` nākamais/iepriekšējais, `p` publicēt, `e` labot, `a` apstiprināt ieteikumu, `/` meklēt, `Esc` aizvērt. Īsceļu sarakstu rādīt ar `?` |
| 10 | Ielāde "Ielādē admin datus…" bez progresa | Neskaidrs gaidīšanas laiks | Skeleta ekrāns ar cilnēm un skaitļiem, kas ielādējas. Ja ielāde ilgst vairāk par 8 s: "Lēni ielādējas — mēģinām vēlreiz" |
| 11 | Neatbilstoša "Jālabo" terminoloģija: KPI "Lokācijas jālabo" rāda `mappingGroups` skaitu, bet citur tas pats ir "Neatpazīti aliasi" un "Neatpazītas vietas" | Skaitļi šķiet pretrunīgi | Viens nosaukums un viena definīcija visur |
| 12 | Pārskata KPI pogas ("Atvērt", "Pārbaudīt", "Labot") visas ved uz to pašu "all" skatu bez filtra | Admins nonāk nefiltrētā sarakstā | Atvērt ar atbilstošu filtru (piem., "Publicēti · jāpārbauda") |
| 13 | Mapping ieteikumu var apstiprināt bez kartes priekšskata | Var apstiprināt nepareizu punktu (piem., cita skola) | Mazs kartes sīkattēls vai apstiprināšanas kartīte ar abiem nosaukumiem un attālumu līdz pašvaldības centram |
| 14 | Toast pazūd pēc 12 s, un vēstures nav | Masveida darbības rezultāts pazūd | Panelis "Pēdējās darbības" (pēdējās 20) ar atsaukšanu |
| 15 | Iesniegumu kartītēs nav redzams, cik vēl atlicis | Nav sajūtas par progresu | Galvenē "3 no 7 izskatīti šodien" |
| 16 | Importu veselība ir pārskata apakšā un garš saraksts | Kļūdas ir grūti pamanāmas | Rādīt tikai problemātiskos ierakstus, pārējos paslēpt zem "Rādīt visus (34)". Problēmas ielikt arī "Ko darīt vispirms" |

## Labi, ja būtu

| # | Ieteikums | Pamatojums |
|---|-----------|------------|
| 17 | Dienas mērķis un sērija ("Šodien sakārtoti 23 ieraksti") | Motivē un parāda progresu |
| 18 | Saglabātie filtri ("Rīgas sports bez vietas") | Atkārtotām pārbaudēm |
| 19 | Salīdzinājums "pirms → pēc" redaktorā (vecā un jaunā vieta kartē) | Mazāk kļūdu |
| 20 | Eksports CSV no jebkura skata | Ārējai pārbaudei vai partneriem |
| 21 | Dark/compact blīvuma režīms tabulām | Vairāk rindu ekrānā |

## Mijiedarbības konsekvence

- Cilnes izmanto `aria-pressed` pogas. Mapping apakšcilnes jauc `aria-pressed` ("Jālabo") un `role="tab"` + `aria-selected` ("Sakārtoti"). Jāizvēlas viens modelis.
- Labošana dažos skatos notiek modālī (LocationEditor), bet iesniegumos tā notiek kartītē (inline). Abi ir pieņemami, taču "Saglabāt un nākamais" jāatbalsta abos.
- Iesniegumos ir iemeslu šabloni un vēsture. Importētajiem pasākumiem nav ne iemeslu, ne vēstures, kurš un kad mainīja.
- Publiskajā daļā termiņa krāsas ir zaļa/dzeltena/sarkana (šodien/rīt/vēlāk). Adminā tās pašas krāsas nozīmē kvalitāti (labi/gatavs/problēma). Tas ir pieņemami, jo kontekstā ir pietiekami atšķirīgs. Tomēr leģenda adminā jārāda vienuviet, nevis garā tekstā "Darba princips".

## Verdikta detaļas

- Atrodamība: BAŽAS (6 cilnes ar pārklāšanos, angļu termini)
- Plūsmas pilnīgums: BAŽAS (nav "nākamais", nav satura pārbaudes)
- Kļūdu labošana: BAŽAS (nav atsaukšanas masveida darbībām un publicēšanai)
- Atgriezeniskā saite un statuss: LABI ar piezīmēm (toast un progress ir, ielāde bez progresa, nav vēstures)
- Konsekvence: BAŽAS (jaukti cilņu modeļi un nosaukumi)

## Ieteicamā secība

1. **Ātrums (lielākais ieguvums):**
   - #1 "Saglabāt un nākamais";
   - #2 skats URL;
   - #12 KPI ar filtriem;
   - #9 īsceļi.
2. **Drošība:**
   - #3 un #5 apstiprinājums un atsaukšana;
   - #13 kartes priekšskats ieteikumam.
3. **Kvalitāte:**
   - #4 satura pārbaudes rinda.
4. **Skaidrība:**
   - #6–#8 un #11: cilņu sakārtošana un latviski termini.

## Izpildes statuss (2026-11-02)

| # | Statuss | Kā |
|---|---------|----|
| 1 | ✅ | Vietas redaktorā "Publicēt/Saglabāt un nākamais →", "Izlaist →" un "3 no 41". Vietu sasaistē "Saglabāt un nākamā →". Pēc lēmuma par iesniegumu ritina uz nākamo |
| 2 | ✅ | `?view=all&bucket=critical&issue=no_point&q=…`; poga "Kopēt saiti uz šo skatu" |
| 3 | ✅ | Konkrēts apstiprinājums masveida publicēšanai un vietu apstiprināšanai. Masveida publicēšanu var atsaukt |
| 4 | ✅ | `lib/admin-checks.js`: dublikāti, HTML atliekas, lielie burti, beigu datums pirms sākuma, ilgāk par pusgadu, nav avota, nav apraksta (tikai informatīvi) |
| 5 | ✅ | Paziņojumā "Atsaukt"; panelī "Pēdējās darbības" ar atsaukšanu |
| 6–7 | ✅ | Cilnes: Pārskats, Iesniegumi, Vietas, Visi aktuālie, Reģistrs, Datu avoti |
| 8 | ✅ | Statusi latviski, "Mapping" → "Vietu sasaiste" / "Vietas" |
| 9 | ✅ | j/k, e/Enter, p, x, n/b, /, ? |
| 10 | ✅ | Ielādes laiks sekundēs, josla un paskaidrojums |
| 11–12 | ✅ | 4 bloki ar vienotu definīciju; skaitļi un iemesli atver filtrētu sarakstu |
| 13 | ✅ | "Skatīt punktu": kartes priekšskats ieteikumam |
| 14 | ✅ | "Pēdējās darbības" (40 sesijas ierakstu) |
| 15 | ✅ | Pēc lēmuma par iesniegumu fokuss pāriet uz nākamo iesniegumu |
| 16 | ✅ | Importu veselība rāda tikai problēmas; tās ir arī "Ko darīt vispirms" sarakstā |
| 17 | ✅ | "šajā sesijā sakārtoti N" |
| 18, 20, 21 | ✅ | Saglabāts skats saitē, CSV eksports, kompakts skats |
| 19 | ⏳ | "Pirms → pēc" kartē: vēl nav |

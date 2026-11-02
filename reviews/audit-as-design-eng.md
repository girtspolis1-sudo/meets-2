# Dizaina inženierijas audits: organizatora vide un pasākumu reģistrācija

**Perspektīva**: Design Engineer
**Datums**: 2026-11-02
**Plāns**: esošā implementācija. Pārbaudīts:
- kods (lapas `/organizators`, `/registre-pasakumu`, `/registre-pasakumu/vienkarsi`, `/registre-vietu`);
- ekrānuzņēmumi 1440 px un 390 px platumā ar imitētiem organizatora datiem.

## Kopsavilkums

Organizators izveido profilu, pievieno norises adreses un reģistrē pasākumus, kurus MEETS pārbauda un publicē. Pamata struktūra ir laba:
- soļu numerācija redaktorā (1 Kas → 2 Kad → 3 Kur → 4 Dalība → 5 Priekšskatījums);
- melnraksta automātiska saglabāšana;
- saraksts "Jāpabeidz" ar MEETS atsauksmi.

Kļūdas ir trīs jomās:
- **Hierarhija.** Ir pārāk daudz primāro (sarkano) pogu.
- **Plūsma.** Viesis nevar pabeigt reģistrāciju bez adreses. Publicētu pasākumu nevar labot.
- **Mobilais skats.** Lipīgā darbību josla aizsedz formas laukus.

## Pārbaudītie faili

| Fails | Vizuālā loma | Risks |
|-------|--------------|-------|
| `app/organizators/page.jsx` (419 rindas) | Organizatora pārskats, pasākumi, adreses, komanda, profils | Augsts: viss vienā failā, 5 paneļi |
| `app/registre-pasakumu/vienkarsi/page.jsx` | Pasākuma redaktors, priekšskatījums, pieslēgšanās, gatavs | Augsts: galvenā konversijas plūsma |
| `app/registre-vietu/page.jsx` | Norises vietas reģistrācija | Vidējs |
| `app/registre-pasakumu/page.jsx` | Izvēle "Pasākumu / Norises vietu" | Zems |
| `app/components/profile-shell.jsx` | Sānu josla un mobilās cilnes | Vidējs |
| `app/organizer-workspace.css`, `app/quick-flow.css` | Organizatora stili (125 `.org-*` noteikumi) | Vidējs: krāsas ārpus tokeniem |
| `app/meets-theme.css` | Tokeni (`--karmins`, `--sodien`, `--rit`, `--velak` …) | Atsauce |

## Verdikts: APSTIPRINĀT AR IZMAIŅĀM

## Kritiskās problēmas (jālabo)

| # | Problēma | Fails | Ietekme | Labojums |
|---|----------|-------|---------|----------|
| 1 | **Mobilajā skatā lipīgā darbību josla aizsedz laukus.** Redaktorā 3 lielas pogas ("Priekšskatīt", "Saglabāt melnrakstu kontā", "Notīrīt") aizņem ~140 px no 844 px ekrāna. Josla ritinot pārklāj aktīvo lauku (ekrānuzņēmumā "Datums no") | `vienkarsi/page.jsx`, `quick-flow.css` | Lietotājs neredz lauku, kuru aizpilda. Viegli nejauši nospiest "Notīrīt" | Telefonā viena rinda (~56 px): "Priekšskatīt →" un "⋯" (melnraksts, notīrīt). "Notīrīt" iznest no lipīgās joslas formas apakšā kā teksta pogu. Formai pievienot `padding-bottom` joslas augstumā |
| 2 | **Viesis nonāk strupceļā.** Viesis var aizpildīt nosaukumu un datumu, bet adresi izvēlēties nevar ("+ Pievienot jaunu" ir atspējots). "Priekšskatīt" izdod kļūdu "Izvēlies organizatora adresi". Vienīgā izeja ir sīka teksta saite "Pieslēdzies" | `vienkarsi/page.jsx` | Lielākā daļa jaunu organizatoru pamet formu tieši šeit | Solī 3 viesim rādīt skaidru kartīti "Lai izvēlētos adresi, pieslēdzies — ievadītais saglabāsies" ar primāro pogu. Vai arī ļaut ierakstīt adresi brīvā tekstā un piesaistīt to pēc pieslēgšanās |
| 3 | **Publicētu pasākumu nevar labot vai atcelt.** "Labot" ir tikai melnrakstiem un "Jālabo" ierakstiem; publicētajiem ir tikai "Dublēt" un "Skatīt publiski" | `organizators/page.jsx` | Mainoties laikam vai vietai vai atceļot pasākumu, organizatoram nav ko darīt. Publiski paliek nepareiza informācija | "Labot" arī publicētajiem (izmaiņas iet atkārtotā pārbaudē, publiskā versija paliek līdz apstiprināšanai) un "Atcelt pasākumu" ar apstiprinājumu |
| 4 | **Primārās krāsas pārmērība.** Pārskatā 1440 px platumā redzamas 6 sarkanas pogas: "Labot un iesniegt", "+ Pievienot adresi", katrā adreses rindā "+ Pievienot pasākumu" un sānu joslā "Jauns pasākums". Īstais darbs ("Labot un iesniegt") nekonkurē ar rutīnu | `organizators/page.jsx`, `organizer-workspace.css` | Acs nezina, kur sākt; samazinās "Jāpabeidz" nozīme | Viena primārā poga uz paneli. Rindu darbības ("+ Pasākums", "Atvērt") kā sekundāras vai ghost pogas. Sarkanā krāsa paliek sadaļai "Jāpabeidz" un galvenajai "Jauns pasākums" |
| 5 | **Organizatora pārslēgšana ir 4 vietās** (virsraksts, `select` ar to pašu nosaukumu, "Visi organizatori", sānu joslas "Aktīvais organizators" un "Organizatori"). Telefonā `select` aizņem visu platumu tieši zem tāda paša virsraksta | `organizators/page.jsx`, `profile-shell.jsx` | Vizuāls troksnis un dubultota informācija; telefonā darbs sākas tikai pēc ekrāna augstuma | Viens pārslēdzējs: virsraksts kā izkrītošā izvēlne ("Mārupes kultūras nams ▾"). `select` un "Visi organizatori" noņemt; ja organizators ir tikai viens, pārslēdzēju nerādīt |

## Ieteikumi

| # | Problēma | Fails | Kāpēc | Labojums |
|---|----------|-------|-------|----------|
| 6 | **Kopsavilkuma josla nav noderīga.** Tajā ir "2 adreses · 5 pasākumi · 1 publicēti", lai gan statusu skaiti (`metrics`: melnraksti, pārbaudē, jālabo, publicēti) tiek aprēķināti, bet netiek rādīti | `organizators/page.jsx` | Organizatoram svarīgs ir statuss, nevis kopējais skaits | 4 klikšķināmas kartītes ar statusu krāsām: Melnraksti · Pārbaudē · Jālabo · Publicēti. Katra atver filtrētu sarakstu (`eventFilterLink` jau ir) |
| 7 | **Datumi neatbilst publiskajai vietnei.** Organizatoram rāda "2026. g. 14. nov.", publiski "Pēc 3 dienām" ar zaļu, dzeltenu vai sarkanu fonu | `organizer-workspace.js` | Organizators neredz pasākumu tā, kā to redz apmeklētāji | Lietot `whenLabel` un `eventTerm` toņus arī organizatora sarakstos |
| 8 | **Statusu krāsas ir ārpus tokeniem.** `.org-status-*` izmanto `#fff4ce`, `#fff0eb`, `#eaf8ef`, `#555` | `organizer-workspace.css:45` | Tokenu sistēma sadrumstalojas; "Publicēts" zaļais atšķiras no `--sodien` | `--sodien-soft/--sodien-text` (publicēts), `--rit-soft/--rit-text` (pārbaudē), `--karmins-soft/--karmins-dark` (jālabo), `--migla` (melnraksts) |
| 9 | **Pasākumu tabulas darbības ir sīkas teksta saites**, līdzinātas pie rindas augšas, kamēr pārējās šūnas ir centrā. "Dublēt" un "Skatīt publiski" ir gandrīz vienādas | `organizators/page.jsx` | Neprecīzi skārienmērķi (<44 px); vizuāli nelīdzens | `align-items:center`; galvenā darbība kā kompakta poga, pārējās izvēlnē "⋯" |
| 10 | **"Visi pasākumi →" telefonā lūzt 3 rindās** un kļūst par lielu pelēku bloku | `organizators/page.jsx` | Lauzta paneļa galva | Paneļa galvā teksta poga ar `white-space:nowrap` |
| 11 | **Mobilās cilnes nogriežas** ("Adre…"), un nav redzams, ka var ritināt; "Komanda" un "Profils" ir paslēptas | `profile-shell.jsx` | Sadaļas nav atrodamas | Labās malas izbalēšana ar `mask-image` un aktīvās cilnes `scrollIntoView`, vai 4 ikonas ar "Vairāk" |
| 12 | **Terminoloģija mainās**: "adrese", "objekts", "norises vieta", "vieta" ("Manas adreses", "Pievienot objektu", "Vietu pārvaldība", "Atvērt objektus") | visi trīs faili | Lietotājs domā, ka tās ir dažādas lietas | Visur "Norises vieta" / "Vietas" |
| 13 | **Priekšskatījums neizskatās kā publiskā kartīte.** Tajā ir vienkāršs teksts ar 📅 ⌖ | `vienkarsi/page.jsx` | Organizators nezina, kā pasākums izskatīsies kartē un sarakstā | Priekšskatījumā rādīt īsto `DiscoveryEventCard` un detaļu kartīti |
| 14 | **Pirmo soļu secība** pieprasa vispirms adresi, lai gan redaktorā adresi var pievienot uzreiz ("+ Pievienot jaunu") | `organizators/page.jsx` | Lieks solis, un pirmais pasākums tiek atlikts | 2. solis "Iesniedz pirmo pasākumu" (adrese tiek pievienota redaktorā); adrese kā neobligāts paralēls solis |
| 15 | **Atspējotā primārā poga** ("+ Pievienot jaunu" viesim) izskatās kā gaišāka aktīva poga, nevis neaktīva | `quick-flow.css` | Lietotājs spiež un nekas nenotiek | Atspējotai: pelēks fons, `cursor:not-allowed`, paskaidrojums blakus |
| 16 | **Attēla augšupielāde** ir tikai parasts faila lauks bez ieteiktā formāta | `vienkarsi/page.jsx` | Attēli tiek nogriezti kartītē negaidīti | Vilkšanas zona, ieteikums "16:9, vismaz 1200 px", priekšskatījums kartītes formā |

## Labi, ja būtu

| # | Ieteikums | Pamatojums |
|---|-----------|------------|
| 17 | "Dublēt ar citu datumu" tieši sarakstā (datuma izvēle bez redaktora) | Regulāri pasākumi ar dažādiem datumiem |
| 18 | Organizatora publiskā profila priekšskats blakus redaktoram (divas kolonnas ir, bet nav vizuāla rezultāta) | Organizators redz, ko publisko |
| 19 | Tumšais režīms | Vietnei nav tumšā režīma vispār (tokeni ir tikai gaišajam). Tas ir apzināts ierobežojums, tāpēc nav kritisks |
| 20 | Skeleta ielāde ("Ielādē organizēšanas vidi…" ir tikai teksts) | Mazāk lēcienu, ātrāka sajūta |

## Dizaina sistēmas atbilstība

- **Tokeni ir hex, nevis oklch.** Tā ir projekta konvencija (`meets-theme.css`); tos nevajag mainīt.
- **Organizatora CSS lielākoties neizmanto tokenus.** `organizer-workspace.css` statusiem un fonam lieto tiešas hex vērtības, un rādiusi ir 9, 10, 12 un 13 px. Ieteicams 2 rādiusi: 12 px kartītēm un 10 px pogām un laukiem.
- **Termiņa krāsas** (`--sodien`, `--rit`, `--velak`), kas tagad ir publiskajā vietnē, organizatora vidē netiek izmantotas, tāpēc vizuālā valoda abās vietās atšķiras.
- **Pogu hierarhija.** `.button.primary` tiek lietots rindu darbībām. Vajadzīgs `.button.ghost` vai kompakts sekundārais variants.

## Vizuālo stāvokļu pārklājums

| Komponents / elements | Hover | Focus | Active | Disabled | Loading | Empty | Error | Dark mode |
|---|---|---|---|---|---|---|---|---|
| Redaktora darbību josla | ✅ | ✅ (globāls) | ⚠️ nav | ⚠️ izskatās aktīva | ✅ "Saglabā…" | — | ✅ toast un inline | ❌ nav tēmas |
| Adreses izvēle (solis 3) | ✅ | ✅ | — | ⚠️ viesim neskaidrs | ⚠️ nav | ✅ teksts | ✅ | ❌ |
| Pārskats "Jāpabeidz" | ✅ | ✅ | — | — | ⚠️ tikai teksts | ✅ (paslēpts) | ✅ atsauksme | ❌ |
| Kopsavilkuma josla | ❌ nav klikšķināma | ❌ | — | — | — | ⚠️ "0" bez paskaidrojuma | — | ❌ |
| Pasākumu tabula | ✅ | ⚠️ teksta saites | — | — | ⚠️ nav | ✅ "Šiem filtriem…" | ✅ | ❌ |
| Statusu žetoni | — | — | — | — | — | — | ⚠️ ārpus tokeniem | ❌ |
| Mobilās cilnes | ✅ | ✅ | ✅ | — | — | — | — | ❌ (nav ritināšanas norādes) |
| Attēla augšupielāde | ⚠️ native | ✅ | — | — | ⚠️ nav progresa | ✅ | ✅ (izmērs/tips) | ❌ |
| Priekšskatījums | — | — | — | — | — | ✅ "Apraksts nav norādīts" | — | ❌ |

## Verdikta detaļas

- Dizaina tokenu atbilstība: BAŽAS (statusi un rādiusi ārpus tokeniem)
- Vizuālo stāvokļu pārklājums: BAŽAS (atspējots, ielāde, kopsavilkums)
- Tumšā režīma paritāte: N/A (vietnei nav tumšā režīma)
- Animāciju kvalitāte: LABI (maz animāciju; `prefers-reduced-motion` ir globāli)
- Vizuālā konsekvence: BAŽAS (primārā krāsa, termini, datumu formāts)

## Ieteicamā secība

1. **Plūsma:**
   - #2 viesa strupceļš;
   - #3 publicēta pasākuma labošana un atcelšana;
   - #14 pirmie soļi.
2. **Mobilais skats:**
   - #1 lipīgā josla;
   - #10 un #11 paneļu galvas un cilnes.
3. **Hierarhija:**
   - #4 primārās pogas;
   - #5 viens pārslēdzējs;
   - #6 statusu kartītes.
4. **Sistēma:**
   - #7 un #8 termiņa krāsas un tokeni;
   - #12 termini;
   - #13 īstā kartīte priekšskatījumā.

## Izpildes statuss (2026-11-02)

| # | Statuss | Kā |
|---|---------|----|
| 1 | ✅ | Telefonā viena kompakta josla ("Priekšskatīt →" un "Saglabāt melnrakstu"); "Notīrīt formu" ir zem formas |
| 2 | ✅ | Viesim solī 3 ir kartīte "Pieslēgties un izvēlēties vietu →"; "Priekšskatīt" bez vietas aizritina līdz šim solim |
| 3 | ✅ | "Labot" publicētajiem (izmaiņas iet pārbaudē, publiskā versija paliek) un "Atcelt pasākumu…". Migrācija `20261102120000`, kurā ir arī datumu un laiku atjaunošana, atkārtoti publicējot |
| 4 | ✅ | Sarkanas paliek tikai "Labot un iesniegt" un sānu joslas "Jauns pasākums"; rindu darbības ir kompaktas un sekundāras |
| 5 | ✅ | Viens pārslēdzējs virsrakstā (tikai, ja organizatori ir vairāki); `select`, "Visi organizatori" un dubultā sānu josla noņemti |
| 6 | ✅ | 4 klikšķināmas statusu kartītes |
| 7 | ✅ | "Pēc N dienām" ar termiņa krāsu un datumu blakus |
| 8 | ✅ | Statusi lieto tokenus, pievienots "Atcelts" |
| 9 | ✅ | Viena galvenā darbība un izvēlne "⋯" (skatīt, dublēt, dublēt ar citu datumu, atcelt); līdzināts centrā |
| 10 | ✅ | "Visi pasākumi →" ir teksta poga, kas nelūzt |
| 11 | ✅ | Ciļņu malas izbalēšana; aktīvā cilne ritinās redzamā vietā; "Adreses" → "Vietas" |
| 12 | ✅ | Visur "norises vieta" / "vietas" |
| 13 | ✅ | Priekšskatījumā īstā `DiscoveryEventCard` |
| 14 | ✅ | Pirmie soļi: 2. "Iesniedz pirmo pasākumu", 3. "Saglabā vietas (neobligāti)" |
| 15 | ✅ | Atspējota galvenā poga ir pelēka ar `not-allowed` |
| 16 | ✅ | Vilkšanas zona ar ieteikumu 16:9, ≥1200 px un priekšskatījums kartītes proporcijās |
| 17 | ✅ | "Dublēt ar citu datumu…" (garums saglabājas) |
| 18 | ✅ | Publiskā profila priekšskats profila redaktorā |
| 19 | ⏳ | Tumšais režīms: vietnē nav tumšo tokenu; to jāievieš visai vietnei vienlaikus, nevis tikai organizatora sadaļā |
| 20 | ✅ | Skeleta ielāde |

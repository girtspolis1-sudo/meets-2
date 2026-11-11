# Automātisko koordinātu izmēģinājums (dry run), 11.11.2026.

Nekas no šī nav piemērots pasākumiem. Skaitļi ir no `meets_private.location_auto_plan()`
produkcijas datiem pēc atsauces tabulu ielādes; pilnais plāns ir tabulā
`meets_private.location_auto_plan_snapshot`.

## Kopsavilkums

Bez pārbaudītām koordinātām: **891 pasākums** (statuss `published` vai `pending_review`).

| | Vietas | Pasākumi | no tiem publicēti | no tiem nākotnē |
|---|---:|---:|---:|---:|
| 1. Adrešu reģistrs | 52 | 76 | 22 | 54 |
| 2. Kultūras iestādes | 118 | 213 | 33 | 181 |
| 3. Apdzīvotas vietas centrs | 92 | 130 | 13 | 117 |
| **Atrisināti kopā** | **262** | **419** | 68 | 352 |
| Paliek manuāli (plānā) | 273 | 424 | 73 | 357 |
| Ārpus plāna: savs nepārbaudīts punkts | – | 34 | | |
| Ārpus plāna: Igaunija / Lietuva | – | 10 | | |
| Ārpus plāna: tiešsaistes | – | 4 | | |

1. un 2. solis dod precīzu punktu 289 pasākumiem; 3. solis 130 pasākumus izņem no
manuālās rindas ar apdzīvotās vietas centru. Manuālajā rindā paliek 472 no 891.

Iestāžu tabulā ielādēti 2 910 ieraksti; koordinātas apstiprinātas 2 492 (1 554 pēc adrešu
reģistra 300 m robežās, 938 pēc ciema vai pilsētas centra), 418 netiek izmantoti. No 118
2. soļa vietām 54 balstās uz reģistra pārbaudi, 64 uz ciema centra pārbaudi.

## Kāpēc paliek manuāli

| Iemesls | Vietas | Pasākumi |
|---|---:|---:|
| Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā | 235 | 347 |
| Nav noteikts novads | 18 | 46 |
| Adrese nav atrasta adrešu reģistrā šajā novadā | 5 | 13 |
| Adrešu reģistrā šai adresei novadā ir vairākas iespējamās vietas | 5 | 8 |
| Iestāde atrasta pēc nosaukuma, bet tekstā nav nosaukta tās apdzīvotā vieta | 3 | 3 |
| Tai pašai vietai citā pasākumā ir pārbaudīts punkts citur | 2 | 2 |
| Vieta nav vienā Latvijas pašvaldībā | 2 | 2 |
| Adrese ir vienīgā novadā, bet tekstā nav nosaukta apdzīvotā vieta | 1 | 1 |
| Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m | 1 | 1 |
| Novadā ir vairākas apdzīvotas vietas ar šādu nosaukumu | 1 | 1 |

Pilns saraksts:

```sql
select municipality, sample_name, sample_address, events, reason
  from meets_private.location_auto_plan_snapshot
 where decision='manual' order by events desc, municipality, sample_name;
```

## Ko izmēģinājums atklāja un kas tika labots

Visas 262 atbilstības izskatītas pa vienai. Pirmajā versijā 1. solī bija trīs kļūdaini
vai nedroši gadījumi; noteikumi pastiprināti, un tie tagad paliek manuāli:

- **"Salaspils koncertzāle, Skolas iela 2 Salaspils"** bija ierakstīta Rīgas
  valstspilsētā un dabūja Rīgas Skolas ielu 2. Tagad pilsētas pašvaldībā adrese netiek
  pieņemta, ja tekstā nosaukta cita pilsēta.
- **"Smiltenes bibliotēka, Gaujas iela 1 un Dakteru iela 27"**: tika ņemta tikai pirmā
  adrese. Tagad tiek nolasītas visas teksta adreses, un divas adreses nozīmē "neskaidrs".
- **Ielas nosaukums kā apdzīvotā vieta**: "Uzvaras iela 1" varēja apstiprināt ciemu
  "Uzvara". Tagad apdzīvotajai vietai jābūt nosauktai ārpus ielas adreses, un novada
  nosaukums ("Mārupes novads") vienīgo adresi apstiprina tikai tad, ja novadā tāda ir viena.

## 1. solis: adrešu reģistrs (20 nejauši no 52)

| Vieta pasākumā | Novads | Atrastā adrese | Punkts | Pasākumi |
|---|---|---|---|---:|
| Ādaži, Gaujas iela 20 | Ādažu | Gaujas iela 20, Ādaži, Ādažu nov., LV-2164 | 57.07856, 24.32921 | 1 |
| Aizkraukle, Centrālais laukums, Lāčplēša iela 1 | Aizkraukles | Lāčplēša iela 1, Aizkraukle, Aizkraukles nov., LV-5101 | 56.60141, 25.25347 | 1 |
| Andrupenes pagasts, Andrupenes lauku sēta, Skolas iela 5, Andrupene | Krāslavas | Skolas iela 5, Andrupene, Andrupenes pag., Krāslavas nov., LV-5687 | 56.19025, 27.39715 | 1 |
| Bobsleja un kamaniņu trase "Sigulda" ¦ Šveices iela 13, Sigulda | Siguldas | Šveices iela 13, Sigulda, Siguldas nov., LV-2150 | 57.15086, 24.84082 | 1 |
| Dienvidkurzemes novada centrālās pārvaldes ēkas lielā zāle, Lielā iela 54 Grobiņa | Dienvidkurzemes | Lielā iela 54, Grobiņa, Dienvidkurzemes nov., LV-3430 | 56.53530, 21.16187 | 1 |
| Dubultu ev. lut. baznīcā Baznīcas ielā 13 | Jūrmalas valstspilsēta | Baznīcas iela 13, Jūrmala, LV-2015 | 56.96959, 23.77382 | 1 |
| Gulbenē, Ābeļu ielā 2 | Gulbenes | Ābeļu iela 2, Gulbene, Gulbenes nov., LV-4401 | 57.17236, 26.76010 | 1 |
| Indras pagasts, Indras Tautas nams, Krāslavas iela 1, Indra | Krāslavas | Krāslavas iela 1, Indra, Indras pag., Krāslavas nov., LV-5664 | 55.88156, 27.54357 | 1 |
| Kombuļu pagasts, Kombuļu pagasta bibliotēka, Skolas iela 4, Kombuļi | Krāslavas | Skolas iela 4, Kombuļi, Kombuļu pag., Krāslavas nov., LV-5656 | 55.97648, 27.17620 | 1 |
| Krāslava, Krāslavas novada bibliotēka, Dīķu iela 5 | Krāslavas | Dīķu iela 5, Krāslava, Krāslavas nov., LV-5601 | 55.89637, 27.16443 | 2 |
| Kultūras pils "Ziemeļblāzma", Ziemeļblāzmas iela 36, LV-1015 | Rīgas valstspilsēta | Ziemeļblāzmas iela 36, Rīga, LV-1015 | 57.03683, 24.10113 | 2 |
| Kultūrtelpas un vides dizaina centrā Pils ielā 1 | Jūrmalas valstspilsēta | Pils iela 1, Jūrmala, LV-2015 | 56.97081, 23.77390 | 1 |
| Līvbērzes kultūras nams, Jelgavas iela 17, Līvbērze, Līvbērzes pagasts | Jelgavas | Jelgavas iela 17, Līvbērze, Līvbērzes pag., Jelgavas nov., LV-3014 | 56.69047, 23.49196 | 2 |
| Ludzas novada pašvaldība, Raiņa iela 16, Ludza | Ludzas | Raiņa iela 16, Ludza, Ludzas nov., LV-5701 | 56.54385, 27.72168 | 3 |
| Mazzalves pagasts, Mazzalves pagasta bibliotēka, Liepu iela 3 | Aizkraukles | Liepu iela 3, Ērberģe, Mazzalves pag., Aizkraukles nov., LV-5133 | 56.36816, 25.01829 | 2 |
| Mērsraga pagasts, Mērsraga tautas nams, Lielā iela 25, Mērsrags | Talsu | Lielā iela 25, Mērsrags, Mērsraga pag., Talsu nov., LV-3284 | 57.33253, 23.12402 | 1 |
| Rīgas 64. vidusskola, Ūnijas iela 93 | Rīgas valstspilsēta | Ūnijas iela 93, Rīga, LV-1084 | 56.96110, 24.18483 | 1 |
| Ūdrīšu pagasts, Ūdrīšu Tautas nams, Dārza iela 2, Augstkalne | Krāslavas | Dārza iela 2, Augstkalne, Ūdrīšu pag., Krāslavas nov., LV-5601 | 55.91572, 27.15114 | 1 |
| Zaļenieku kultūras nams, Centra iela 1, Zaļenieki, Zaļenieku pagasts | Jelgavas | Centra iela 1, Zaļenieki, Zaļenieku pag., Jelgavas nov., LV-3011 | 56.52673, 23.50866 | 1 |
| Zilupes Kultūras nams, Tautas iela 1, Zilupe | Ludzas | Tautas iela 1, Zilupe, Ludzas nov., LV-5751 | 56.38719, 28.12363 | 1 |

## 2. solis: kultūras iestādes (20 nejauši no 118)

| Vieta pasākumā | Novads | Atrastā iestāde un adrese | Punkts | Pasākumi |
|---|---|---|---|---:|
| Aglonas Kultūras nams | Preiļu | Aglonas kultūras nams, Somersētas iela 34, Aglona, Aglonas pag. | 56.13066, 27.00690 | 1 |
| Augstkalnes bibliotēka | Dobeles | Augstkalnes bibliotēka, "Zvaniņi", Augstkalne, Augstkalnes pag. | 56.40930, 23.33639 | 1 |
| Bārtas kultūras nams, Bārta | Dienvidkurzemes | Bārtas pagasta kultūras nams, "Tautas nams", Bārta, Bārtas pag. | 56.35109, 21.32314 | 1 |
| Bērzpils Saieta nams | Balvu | Bērzpils saieta nams, Dārza iela 25A, Bērzpils, Bērzpils pag. | 56.84861, 27.08477 | 1 |
| Codes pagasts, Codes bibliotēka | Bauskas | Codes pagasta Codes bibliotēka, "Virsaiši", Code, Codes pag. | 56.46821, 24.16744 | 1 |
| Daudzeses pagasts, Daudzevas Saieta nams | Aizkraukles | Daudzevas saieta nams, "Pagastmāja", Daudzeva, Daudzeses pag. | 56.50611, 25.24153 | 2 |
| Dobele, Dobeles novada Centrālajā bibliotēka | Dobeles | Dobeles novada Centrālā bibliotēka, Brīvības iela 23, Dobele | 56.62646, 23.28274 | 1 |
| Durbes kultūras nams, Durbe | Dienvidkurzemes | Durbes kultūras nams, Skolas iela 5, Durbe | 56.58664, 21.37029 | 2 |
| Kolkas pagasts, Kolkas tautas nams, Kolka | Talsu | Kolkas Tautas nams, "Tautas nams", Kolka, Kolkas pag. | 57.74492, 22.59325 | 2 |
| Kubulu Kultūras nams | Balvu | Kubulu pagasta Kultūras nams, Balvu iela 15, Kubuli, Kubulu pag. | 57.15794, 27.20421 | 1 |
| Maļinovas pagasta saieta nams | Augšdaugavas | Maļinovas pagasta saieta nams, Skolas iela 2A, Maļinova, Maļinovas pag. | 55.99253, 26.68962 | 2 |
| Nirzas pagasta bibliotēka | Ludzas | Nirzas pagasta bibliotēka, "Bibliotēka", Nirza, Nirzas pag. | 56.40666, 27.93025 | 2 |
| Pļaviņas, Pļaviņu Kultūras centrs | Aizkraukles | Pļaviņu kultūras centrs, Daugavas iela 49, Pļaviņas | 56.61648, 25.72219 | 1 |
| Sauriešu bibliotēka | Ropažu | Sauriešu bibliotēka, Līdumnieku iela 1 - 54, Saurieši, Stopiņu pag. | 56.91905, 24.36061 | 2 |
| Skultes bibliotēka | Limbažu | Skultes bibliotēka, "Pagastmāja", Mandegas, Skultes pag. | 57.32818, 24.49188 | 1 |
| Staiceles kultūras nams | Limbažu | Staiceles kultūras nams, Lielā iela 7, Staicele | 57.83627, 24.74652 | 1 |
| Ugāles bibliotēka | Ventspils | Ugāles bibliotēka, "Bērnudārzs", Ugāle, Ugāles pag. | 57.27430, 22.02271 | 1 |
| Vandzenes pagasts, Vandzenes tautas nams, Vandzene | Talsu | Vandzenes tautas nams, "Tautas nams", Vandzene, Vandzenes pag. | 57.30975, 22.77429 | 1 |
| Variņu Tautas nams | Smiltenes | Variņu tautas nams, Oktobra iela 13, Variņi, Variņu pag. | 57.31924, 26.16904 | 3 |
| Vērgales kultūras nams, Vērgale | Dienvidkurzemes | Vērgales kultūras nams, "Pagastmāja", Vērgale, Vērgales pag. | 56.69840, 21.19720 | 2 |

Iestāžu datne data.gov.lv pēdējoreiz atjaunota 07.07.2024. Nosaukumi sakrīt visās 118
vietās; risks ir iestāde, kas kopš tā laika pārcēlusies.

## 3. solis: apdzīvotas vietas centrs (20 nejauši no 92)

| Vieta pasākumā | Novads | Atrastā vieta | Punkts | Pasākumi |
|---|---|---|---|---:|
| Bērze | Dobeles | Bērze, Bērzes pag., Dobeles nov. | 56.68819, 23.44016 | 1 |
| Bērzpils | Balvu | Bērzpils, Bērzpils pag., Balvu nov. | 56.85081, 27.08339 | 1 |
| Cīrava, Cīravas pagasts | Dienvidkurzemes | Cīrava, Cīravas pag., Dienvidkurzemes nov. | 56.73326, 21.38533 | 1 |
| Dagda | Krāslavas | Dagda, Krāslavas nov. | 56.09525, 27.53282 | 1 |
| Dobele | Dobeles | Dobele, Dobeles nov. | 56.61910, 23.28319 | 1 |
| Durbes pilsēta, Durbe | Dienvidkurzemes | Durbe, Dienvidkurzemes nov. | 56.58512, 21.37945 | 1 |
| Engure | Tukuma | Engure, Engures pag., Tukuma nov. | 57.16156, 23.21950 | 1 |
| Jaunjelgava | Aizkraukles | Jaunjelgava, Aizkraukles nov. | 56.61183, 25.07896 | 1 |
| Kalupes pagasts | Augšdaugavas | Kalupes pag., Augšdaugavas nov. | 56.08928, 26.52608 | 1 |
| Krapes pagasts | Ogres | Krapes pag., Ogres nov. | 56.74265, 25.18330 | 2 |
| Lādezers | Limbažu | Lādezers, Limbažu pag., Limbažu nov. | 57.42336, 24.69410 | 1 |
| Mazzalves pagasts, Ērberģe | Aizkraukles | Ērberģe, Mazzalves pag., Aizkraukles nov. | 56.36595, 25.01788 | 1 |
| Mērsraga pagasts | Talsu | Mērsraga pag., Talsu nov. | 57.31327, 23.02972 | 2 |
| Pļaviņas | Aizkraukles | Pļaviņas, Aizkraukles nov. | 56.61383, 25.70872 | 2 |
| Pope | Ventspils | Pope, Popes pag., Ventspils nov. | 57.40018, 21.85362 | 2 |
| Ragana | Siguldas | Ragana, Krimuldas pag., Siguldas nov. | 57.18197, 24.70686 | 1 |
| Raunas pagasts | Smiltenes | Raunas pag., Smiltenes nov. | 57.34540, 25.63490 | 1 |
| Taurupes pagasts | Ogres | Taurupes pag., Ogres nov. | 56.91443, 25.31934 | 3 |
| Ulbroka | Ropažu | Ulbroka, Stopiņu pag., Ropažu nov. | 56.93300, 24.28942 | 1 |
| Vangaži | Ropažu | Vangaži, Ropažu nov. | 57.09146, 24.53626 | 1 |

Pagasta centroīds ir teritorijas vidus, nevis ciems (piemēram, "Mērsraga pagasts" ir
6 km no Mērsraga ciema).

## 4. solis: adrese no avota lapas (izmēģinājums ar 120 lapām)

Nolasītas 120 no aptuveni 360 avota lapām vietām, kam nekas cits nav atrasts
(117 atvērās, 3 deva 404).

- Ielas adrese atrasta 8 lapās (7 %).
- Pēc filtriem un reģistra pārbaudes paliek **1 vieta**: "Bauska, Bauskas Mūzikas un
  mākslas skolas koncertzāle" → Upmalas iela 5, Bauska (pareizi).
- Pārējās 7 lapās adrese nebija pasākuma vieta: pašvaldības vai federācijas adrese
  ("Allažu Tautas nams" lapā sigulda.lv → Pils iela 16; "Valkas JC ģimnāzija" lapā
  floorball.lv → Miera iela 15-1, Rīga), pieņemšanas vieta vai cita iestāde. Filtri tās
  visas atsijāja.

Ieguvums ir ap 1 % vietu, bet katra lapā atrasta adrese ir potenciāli svešas iestādes
adrese. Solis ir izslēgts (`location_auto_source_pages = off`); ja to ieslēdz, punkts
tiek ielikts, bet pasākums netiek publicēts un paliek manuālajā rindā apstiprināšanai.

## Pēc piemērošanas (11.11.2026.)

`select meets_private.location_auto_run()` piemēroja tieši to, ko rādīja izmēģinājums:
262 vietas, 419 pasākumi; 234 nākotnes importētie pasākumi tika publicēti.

| | Pirms | Pēc |
|---|---:|---:|
| Pasākumi bez `verified_at` (published + pending_review) | 891 | 891 |
| no tiem manuālajā rindā | 891 | 472 |
| `published` | 3 983 | 4 217 |
| `pending_review` | 713 | 479 |
| kvalitāte `missing_point` | 687 | 336 |
| kvalitāte `source_exact` | 7 | 296 |
| kvalitāte `fallback_center` | 170 | 232 |
| kvalitāte `verified_exact` | 3 805 | 3 805 |

`verified_at` automātiskajiem punktiem paliek tukšs, tāpēc pirmā rinda nemainās;
mainās tas, cik no tiem gaida adminu.

Pārbaudes:

- Automātiskie punkti ārpus Latvijas robežas: 0.
- Automātiskās vietas ar diviem dažādiem punktiem: 0; rindas, kuru punkts atšķiras no
  vietas punkta: 0; vietas, kam pārbaudīts punkts citā pasākumā ir tālāk par 150 m: 0.
- 4 527 rindas ar `verified_at` un 506 saglabātie mapējumi: kontrolsummas pirms un pēc sakrīt.
- Žurnālā 419 ieraksti, pa vienam katram pasākumam.
- Neviens pasākums ar apdzīvotas vietas centru netika publicēts.
- Jaunās funkcijas, kas lasa vai raksta `meets_private` tabulas, ir `SECURITY DEFINER` ar
  tukšu `search_path`. Teksta palīgfunkcijas (`lv_stems`, `location_place_key`,
  `location_name_core`, `location_name_variants`, `std_locality_stems`,
  `points_distance_m`) un `std_municipality_id` ir parastas funkcijas ar tukšu
  `search_path`, tāpat kā esošā `plain_text`. Nevienai nav `EXECUTE` tiesību `anon` vai
  `authenticated`.

Atrasts, bet nav mainīts: 45 jau pārbaudītas rindas ar valsts kodu `LV` vai bez koda
atrodas ārpus Latvijas (24 Igaunijā, piemēram, "Jõgeva SH", un 21 Lietuvā, piemēram,
"LSMU Sporto Centras"). Punkti ir pareizi, nepareizs ir valsts kods.

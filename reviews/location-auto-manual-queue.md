# Vietas, kas palikušas manuālajā rindā (11.11.2026. pēc pirmās piemērošanas)

472 pasākumi no 891: 424 ir plānā ar iemeslu (273 vietas, zemāk), 34 ir ar savu
nepārbaudītu punktu, 10 ir Igaunijā vai Lietuvā, 4 ir tiešsaistes.

Saraksts datubāzē atjaunojas reizi stundā:

```sql
select reason, municipality, sample_name, sample_address, events
  from meets_private.location_auto_plan_snapshot
 where decision='manual' order by events desc, municipality, sample_name;
```

`×N` ir pasākumu skaits vietā; bez atzīmes ir viens pasākums.

## Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā (235 vietas, 347 pasākumi)

- Ludzas: Kārsavas kultūrvēstures centrs "Līču mājas" ×8; Briģu pagasta bibliotēka ×3; Nirzas Kultūras nams ×3; Isnaudas Kultūras nams ×2; Pušmucovas Kultūras nams ×2; Briģu Kultūras nams; Goliševas pagasta bibliotēka; Pušmucovas pagasta bibliotēka; Rundēnu pagasta bibliotēka
- Preiļu: Riebiņu Kultūras nams ×5; Stabulnieku Kultūras nams ×4; Preiļu novads ×2; Preiļu novada BJSS manēža; Preiļu Romas katoļu baznīca un Preiļu Kultūras nams; Rušonas Kultūras nams; Sīļukalna Kultūras nams
- Dienvidkurzemes: Dienvidkurzemes novads ×4; Vecpils kultūras nams, Vecpils ×3; Aizputes pagasta Saieta nams ×2; Aizputes pilsētas bibliotēka ×2; Bunkas kultūras namā, Bunka ×2; Dunalkas kultūras nams ×2; Pāvilostas pilsētas bibliotēka ×2; Aizputes kutūras nams, Aizpute; Aizputes un Durbes kultūras namos; Dienvidkurzemes novada bibliotēka (Grobiņa); Dzērves laukums Grobiņā; Kazdangas kultūras centrs; Liepājas OC; Medzes pagasts, Medze; Pāvilostas tūrisma informācijas centrs; Priekules SC; Priekuļi, VTDT; Rucavas kultūras nams un Rucavas tūrisma informācijas centrs; Rucavas Muižas kalnā
- Valkas: Turnas tautas nams ×4; Valkas Jāņa Cimzes ģimnāzijas sporta halle ×3; Valkas JC ģimnāzija ×3; Petanka halle ×2; Valkas brīvdabas estrādes mežā pie "Koklētāja" ×2; Valkas-Valgas centrs ×2; Mežs pie skulptūras "Koklētājs"; Valkas bibliotēka; Valkas-Valgas Dvīņu pilsētas centrs; Viesu nams "Bergervilla"
- Ventspils: Saietu nams "Mazā Vinda" ×4; Puze ×2; Užavas saietu nams ×2; "Morici" Usma; Jūrkalnes Sv. Jāzepa baznīca; Rubeņa bataljona apmetne; Tārgales estrāde; Ugāles pagasta pārvalde; Užavas estrāde
- Aizkraukles: Sunākstes pagasta Saieta nams ×3; Bebru pagasts, LSK "Vecbebri" zālē ×2; Daudzeses pagasta Saieta nams ×2; Klintaines pagasta pakalpojumu centrs ×2; Aiviekstes pagasta tradīciju zāle; Bebru pamatskola; Daudzeses pagasts, dau; Iršu klubs, Pērses pamatskola; Pie Iršu klēts-magazīnas; Jaunjelgavas pamatskolas aktu zāle; Jaunjelgavas Vecpilsētas parks; Jaunjelgava, Svētā Krusta Romas katoļu baznīca; Kokneses parks; Mazzalves pagasta pakalpojumu centrs; Mazzalves pagasta zāle; Neretas apvienība; Pļaviņu Romas katoļu baznīca; Staburaga pagasta centra laukums; Vietalvas pagasta pakalpojumu centrs
- Balvu: Briežuciema Tautas namā ×3; Balvu sākumskola ×2; Balvu novads; Bērzpils pamatskolas sporta angārs; Bērzpils pamatskolas sporta zālē; Krišjāņu Tautas nams; Rugāju tirgus laukums; Vectilžas Kultūras centrā
- Bauskas: Iecavas klīnika ×3; Iecavas kultūras nams ×3; Vecumnieki, Vecumnieku tautas nams ×3; Bauskas Bērnu un jaunatnes sporta skola ×2; tās vieglatlētikas manēža ×2; Griķu pamatskolas sporta zāle ×2; Dāviņu kultūras nams "Dāvis" ×2; Uzvaras pamatskola ×2; DFC "Strēlnieki" ×2; Kultūrtelpa "Mežotnes baznīca" ×2; Vecumnieku sporta skola ×2; Misas tautas nams ×2; Bērsteles kultūras nams ×2; Bārbeles centrs; Bauskas Mūzikas un mākslas skolas koncertzālē; Brunavas jauniešu centrs "Ērgļi"; Brunavas pagasta klubā "Ērgļi"; Brunavas pagasts, pie tilta pāri Mēmelei; Gailīšu bibliotēka; Kultūras nams "Kamarde"; Parks pie Akmens; Uzvaras ciems un tā apkārtesošā teritorija; Uzvaras pamatskolas sporta zāle; Iecavas jauniešu centrs; Iecavas luterāņu baznīca; Iecavas stadions; Iecavas Brīvības piemineklis; Saietu nams "Klētnieki" (Mežotne); Rundāles Avoti; Rundāles pils; Stelpes kultūras zāle; Jaunsaules centrā pie veikala; Vecumnieku vidusskolas lasītava; Vecumnieku pagasts, Vecumnieku tautas nams
- Dobeles: Dobeles sporta halle ×3; Auces kultūras nams; Auces pilsētas Kultūras namā; Auri, PII Auriņš zālē; Auru pagasta māja; Bērzes pamatskola; Biksti, Silkalnu karjers; Dobele, Dobeles pilsētas Kultūras namas; Dobeles Kultūras namā; Dobeles novads, bibliotēkas; Dobeles pilsētas Kultūras namā, Dobele; Dobeles SN; Dobeles vēsturiskais tirgus laukums; Īles sporta zāle; Jaunbērzes bibliotēka; Krimūnu sporta zāle; Naudīte, Naudītes Tautas nams; Naudītes Tautas nams; Zebrenes pagasta pārvalde; Zebrenes sporta zāle
- Limbažu: Sporta un kultūras centrā "Vidriži" ×3; Viļķenes kultūras nams ×3; Lauvu tautas nams ×2; Pociema kultūras nams ×2; Bārdu dzimtas memoriāla muzejs "Rumbiņi"; Igates pils; Lādezera pamatskola; Lauvas tautas nams; Limbažu Sv. Jāņa luterāņu baznīca; Pociema bibliotēka; Puikules muiža; Sporta un kultūras centrs "Vidriži"; Umurgas kultūras nams
- Līvānu: Domes sēžu zāle ×3
- Ogres: Ogres novada Kultūras centra Radošā telpa ×3; Ogres novads ×2
- Ropažu: Vangažu pilsētas bibliotēka ×3; Zaķumuižas Kultūras centrs ×3; Kopienas centrs "Upeslejas" ×2; Pie Vangažu Kultūras centra ×2; Vangažu Kultūras centrs ×2; Kopienu centrs "Garkalne"; Kopienu centrs "Saurieši"; Pie Berģu Mūzikas un mākslas pamatskolas Upesciemā; Ropažu Sporta centrs; Vangažu vidusskola; Zaķumuižas sporta zāle
- Saulkrastu: Saulkrastu SĢC ×3
- Siguldas: Limbažu vsk. ×3; Allažu Tautas nams
- Smiltenes: Launkalnes Tautas nams ×3; Smiltenes novads ×3; Drustu bibliotēka ×2; Palsmanes baznīca ×2; Apes Kultūras centrā; Birzuļu bibliotēka; Birzuļu Tautas nams; Blomes Tautas nams; Jāņukalna estrāde; Jāņukalns, Smiltene; Raunas Kultūras centrs; Smiltenes baznīca; Smiltenes daudzfunkcionālo sociālo pakalpojumu centrs "Īve"; Smiltenes evaņģēliski luteriskā baznīca; Smiltenes novada Kultūras centra Teātra zāle; Variņu bibliotēka
- Talsu: Dažādas norises vietas ×3; Ārlavas pagasts, Nogales bibliotēka; Valdemārpils izstāžu zāle; Vandzenes pagastmāja (Valdemārpils apvienības pārvalde)
- Ādažu: Ādažu stadions ×2; Sporta un aktīvās atpūtas centrā "Zibeņi" ×2; Baltezera baznīca; Carnikavas vidusskola; Kadaga, Ūdensrožu parks; Kalngales brīvā laika pavadīšanas centrs "Kadiķis"; Ojāra Vācieša memoriālais muzejs; pie Carnikavas Tautas nama "Ozolaine"; Ummis, Carnikavas pag.
- Augšdaugavas: Silavišķu ārējās apkalpošanas punkts ×2; Augšdaugavas novada pašvaldības Centrālā pārvalde; Ilūkstes pilsētas bibliotēkas bērnu literatūras nodaļa; Kalkūnes jauniešu attīstības centrs; Kalupes pārvaldes ēka; Tabores Sabiedriskais centrs; Vaboles kulinārā mantojuma darbnīcas telpa
- Gulbenes: Daukstu pagasta Staru bibliotēka ×2; Jaungulbenes pagasta bibliotēka ×2; Gulbenes dzelzceļa stacija; Rankas pagasta Gaujasrēveļu bibliotēka; Stāmerienas pagasta bibliotēka; Staru bibliotēka
- Tukuma: Jaunpils Kultūras nams ×2; Šlokenbekas muiža ×2; Jaunsāti; Lidosta "Jūrmala"; pie Vānes kultūras nama; Pūres Kultūras namā; Tukku Magi pagalms; Tukuma novads; Tukuma pils. stad. māksl. lauk.
- Rēzeknes: Rēzeknes Olimpiskā centra halle ×2
- Rīgas: Rīga, KSSH ×2; Jurmalas valsts gimnazijas sporta zale; Rīgas I Meža kapi, Čakstes aleja; Rīgas Nacionālā sporta manēža; RVS sporta zāle
- Salaspils: Salaspils sporta hall ×2
- Cēsu: Cesis SK; Priekuļi, VTDT; Sporta nams Cēsis
- Jelgavas: Elejas muižas parks; Elejas parka izstāžu zāle, Eleja; Jelgavas novads
- Jūrmalas: Jūrmalas Jaunatnes iniciatīvu centrs; Kaugurciemā pie kapteiņa P. Zolta pieminekļa; Ķemeri
- Krāslavas: Krāslavas novads; Piedrujas pagasta bibliotēka, "Jaunība", Piedruja
- Valmieras: Jāņa Daliņa stadions

Daļa šo vietu iestāžu tabulā ir, bet ar citu nosaukumu vai nepārbaudāmām koordinātām
(piemēram, "Iecavas kultūras nams", "Riebiņu Kultūras nams"). Tās ir nākamais
kandidāts pārklājuma palielināšanai, katru pārbaudot atsevišķi.

## Nav noteikts novads (18 vietas, 46 pasākumi)

Klaipēda ×4; Sauriešu sporta halle ×4; Sējas Sporta centrs ×4; Ääsmäe Spordihoone ×3;
Pieno Žvaigždžių arena ×3; Tabasalu Kooli spordihoone ×3; Tapa Valla Spordikeskus ×3;
Tārgales pamatskolas Sporta zāle ×3; "Dubysa" Sports Centre ×2; Čiekurkalna pam.sk. ×2;
Depo ×2; Kristiine Spordihall ×2; TDAPS Sport Complex RIGA (LAT) ×2; Tīraines Sporta
komplekss ×2; Tuule Sportshall ×2; Viljandi Spordikeskus ×2; Virtuse SH, Aia 40 Jõgeva ×2;
VMSM Sostines Tauras.

Vairākas no tām ir Igaunijā vai Lietuvā, bet pasākumam nav valsts koda.

## Adrese nav atrasta adrešu reģistrā šajā novadā (5 vietas, 13 pasākumi)

- Tukuma SK (Kuldīgas 74) [Tukuma] ×7 — tekstā nav vārda "iela"
- Valsts Robežsardzes sporta zāle, Pumpura iela 105b [Daugavpils] ×2
- Raiņa un Aspazijas vasarnīcā Pliekšāna ielā 5/7 [Jūrmalas] ×2
- Rīga, Mazā Pils 1 [Rīgas]
- Rīgas domes sēžu zāle, Rātslaukums 1, LV-1050 [Rīgas]

## Adrešu reģistrā šai adresei novadā ir vairākas iespējamās vietas (5 vietas, 8 pasākumi)

- Sēžu zāle Vidzeme, Lāčplēša iela 1 [Aizkraukles] ×3
- Lāčplēša iela 1, Sēžu zāle Vidzeme [Aizkraukles] ×2
- Smiltenes bibliotēka, Gaujas iela 1 un Dakteru iela 27 [Smiltenes]
- Smiltenes novada Kultūras centrs, Gaujas ielā 1 [Smiltenes]
- Smiltenes novada pašvaldība, Dārza iela 3 [Smiltenes]

## Pārējie

| Iemesls | Vieta |
|---|---|
| Iestāde atrasta pēc nosaukuma, bet tekstā nav nosaukta tās apdzīvotā vieta | Bites bibliotēka [Dobeles]; Dobeles novadā, Bites bibliotēka [Dobeles]; Raiņa muzejs "Jasmuiža" [Preiļu] |
| Vieta nav vienā Latvijas pašvaldībā | Valga [Ārpus Latvijas (Igaunija)]; Jūrmala un Tukuma novads [Vairākas pašvaldības] |
| Tai pašai vietai citā pasākumā ir pārbaudīts punkts citur | Iecava [Bauskas]; Jūrmala [Jūrmalas] |
| Novadā ir vairākas apdzīvotas vietas ar šādu nosaukumu | Aizkraukle [Aizkraukles] |
| Adrese ir vienīgā novadā, bet tekstā nav nosaukta apdzīvotā vieta | Salaspils koncertzāle, Skolas iela 2 Salaspils [Rīgas] |
| Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m | Smiltenes bibliotēka, Dakteru iela 27 [Smiltenes] |

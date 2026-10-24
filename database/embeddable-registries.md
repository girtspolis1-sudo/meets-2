# MEETS lietotāju reģistri un iframe

## Darbības princips
- /registre-pasakumu/vienkarsi — vienkāršā MEETS pasākuma iesniegšana, izmanto esošo /api/organizer un meets_submissions plūsmu.
- /mani-registri — profils, personiski atlases filtri un individuāla pasākumu pievienošana vai izņemšana.
- /iegult/<uuid> — publisks, bez autentifikācijas tikai lasāms, iframe izmantojams saraksts.
- Publiski tiek rādīti tikai meets_public_catalog() publicētie un aktīvie ieraksti. Manuālie papildinājumi nevar publicēt privātu pasākumu.
- Reģistram nav jābūt ieslēgtam publiskai piekļuvei; pēc noklusējuma tas ir privāts.
- Autentificētais īpašnieks var labot, izslēgt kopīgošanu vai dzēst reģistru. Anonīmam lietotājam nav tabulas SELECT piekļuves, tikai ierobežota RPC izdruka.
- Iframe: <iframe src="https://meets.lv/iegult/REĢISTRA_UUID" title="MEETS pasākumi" width="100%" height="620" loading="lazy"></iframe>
- Vercel ļauj šo maršrutu iegult HTTPS vietnēs, bet neļauj iframe saturam pārvaldīt saglabātos filtrus.
- Lapu un datu filtrus lietotājs maina /mani-registri; iframe saturs automātiski mainās nākamajā ielādē.
- Pagājušie pasākumi, nepublicēti pasākumi un ārpus rolling trīs mēnešu loga ir izslēgti.
- Saturs neietver e-pastus, privātus komentārus, administratīvus laukus.
- Iepriekšējās MEETS 2 kontu un organizatoru API plūsmas ir saglabātas. MEETS ORG joprojām ir atsevišķs nākotnes organizēšanas projekts.

## Pārbaudes
1. `npm ci && npm test && npm run build`.
2. Lietotāja A saglabātu reģistru nevar labot, dzēst vai nolasīt kā īpašnieks lietotājs B.
3. Privāts reģistrs iframe atgriež 404; publicēts rāda tikai publicētu katalogu.
4. Iegult vairākās ārējās HTTPS mājaslapās: desktop/mobilie.
5. Iesniegts pasākums nevar būt redzams kartē, pirms admin apstiprinājuma.

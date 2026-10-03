# MULTI AKCIÓK

Mobil-first magyar akciókereső, ár-összehasonlító és digitális hűségkártya-tárca.

## V1 funkciók

- napi nyilvános forrásellenőrzés: ALDI, Lidl, PENNY, Tesco, SPAR, Auchan, IKEA, Decathlon, OBI, Praktiker, Deichmann, JYSK, Rossmann, Euronics, Gyöngy Patikák, Alma · Újvárosi Patika és Kamilla Patika · Mezőtúr
- további saját üzlet felvitele ellenőrzött gyorslinkként névvel, URL-lel, színnel és megjegyzéssel
- termékkártyák képpel, akciós árral, régi árral és egységárral
- keresés és bolti szűrés
- termékár-összehasonlító nézet
- 90 napos szerveres árhistorika, pontgrafikon és csak elegendő mért adatból számolt „Tényleg jó akció?” értékelés
- bevásárlólista és kiszerelés-/mennyiségérzékeny költségoptimalizáló, szigorú termékazonosítással
- szabad szöveges Gyors lista (pl. `2 tej, 1 kg krumpli`) automatikus, bizonytalanság-tudatos ajánlatillesztéssel
- digitális hűségkártya-tárca
- kamera vagy screenshot alapú QR/vonalkód beolvasás, ahol a böngésző BarcodeDetector API-ja elérhető
- kézi kódmegadás és Saját üzlet opció bármilyen további kártyához
- pénztári, teljes képernyős QR/vonalkód megjelenítés
- Figyelőközpont tartós új/olcsóbb állapottal, elolvasás/eltüntetés/törlés kezeléssel
- opcionális háttér Web Push telepített PWA-ban, a napi Supabase frissítéshez kötve
- helyi JSON adatmentés/visszaállítás a kártyákhoz, listához, figyelésekhez és saját üzletekhez
- PWA manifest + service worker
- napi Supabase Cron + Edge Function ármentés, Vercel Cron nélkül

## Adatforrás-stratégia

Minden beépített kereskedő külön forrásként működik. A feldolgozó csak nyilvánosan elérhető ajánlati oldalakat olvas. Ha egy kereskedő módosítja az oldalát, a többi forrás tovább működik.

A production API nem helyettesíti a sikertelen live adatgyűjtést demo árakkal. A `fallback-offers.ts` kizárólag fejlesztési előnézethez maradt a repóban.

## Technika

- Next.js 16.3.8
- React 19.3
- TypeScript
- Vercel
- localStorage a felhasználó kártyáihoz, listájához, figyeléseihez és saját üzleteihez
- TELEKI Supabase projektben elkülönített `multi_akciok` séma
- csak nyilvános Supabase publishable kulcs az árhistorika olvasásához; service-role kulcs nincs a Vercel appban

## Design

Színrendszer: sötétkék `#0B2545`, akciópiros `#EF3946`, megtakarítászöld `#22C55E`, fehér/törtfehér felületek. Mobil-first, kártyás, prémium iOS-jellegű felület.

## Deploy

GitHub repo importálása Vercelbe. Build parancs: `npm run build`.

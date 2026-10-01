# MULTI AKCIÓK

Mobil-first magyar akciókereső, ár-összehasonlító és digitális hűségkártya-tárca.

## V1 funkciók

- napi nyilvános forrásellenőrzés: ALDI, Lidl, PENNY, Tesco, SPAR, Auchan, IKEA, Decathlon, OBI, Praktiker, Deichmann, JYSK
- további saját üzlet / akcióforrás felvitele névvel, URL-lel, színnel és megjegyzéssel
- termékkártyák képpel, akciós árral, régi árral és egységárral
- keresés és bolti szűrés
- termékár-összehasonlító nézet
- bevásárlólista és költség-összesítő
- digitális hűségkártya-tárca
- kamera vagy screenshot alapú QR/vonalkód beolvasás, ahol a böngésző BarcodeDetector API-ja elérhető
- kézi kódmegadás és Saját üzlet opció bármilyen további kártyához
- pénztári, teljes képernyős QR/vonalkód megjelenítés
- PWA manifest
- napi Vercel Cron forrásfrissítés

## Adatforrás-stratégia

Minden beépített kereskedő külön forrásként működik. A feldolgozó csak nyilvánosan elérhető ajánlati oldalakat olvas. Ha egy kereskedő módosítja az oldalát, a többi forrás tovább működik.

A production API nem helyettesíti a sikertelen live adatgyűjtést demo árakkal. A `fallback-offers.ts` kizárólag fejlesztési előnézethez maradt a repóban.

## Technika

- Next.js 16.3.8
- React 19.3
- TypeScript
- Vercel
- localStorage a felhasználó kártyáihoz, listájához és saját üzleteihez
- `CRON_SECRET` opcionális

## Design

Színrendszer: sötétkék `#0B2545`, akciópiros `#EF3946`, megtakarítászöld `#22C55E`, fehér/törtfehér felületek. Mobil-first, kártyás, prémium iOS-jellegű felület.

## Deploy

GitHub repo importálása Vercelbe. Build parancs: `npm run build`.

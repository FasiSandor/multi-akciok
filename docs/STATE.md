# MULTI AKCIÓK – technikai állapot

## Production

- GitHub: `FasiSandor/multi-akciok`
- production branch: `main`
- production: https://multi-akciok.vercel.app
- a jelenlegi nagy értesítési csomag előtti biztos rollback commit: `9b66eebdc2425eea56f4dc41e2624732cbc6e3bc`
- GitHub CI: TypeScript ellenőrzés + Next build
- Vercel: GitHub `main` automatikus production deploy

## Adatréteg

A MULTI AKCIÓK nem kapott külön fizetős Supabase projektet. A TELEKI Supabase projektben elkülönített `multi_akciok` sémát használ.

Szerveroldalon tárolódik:
- napi ajánlat/ár snapshot
- 90 napos árhistorika
- napi frissítés állapota
- Web Push eszköz-előfizetés: anonim eszköz UUID, push endpoint és legfeljebb 30 figyelési kifejezés

Nem kerül Supabase-be:
- hűségkártya kód
- bevásárlólista
- saját üzletek
- helyi Figyelőközpont elolvasva/eltüntetve állapota

Ezek localStorage-ban maradnak és JSON-mentéssel exportálhatók.

## Automatikus háttérfolyamat

- Supabase Cron: naponta `04:17 UTC`
- Edge Function: `multi-akciok-snapshot`
- ajánlatforrás: production `/api/offers`
- ugyanazon napi snapshot upsert, nem duplikál
- Web Push csak akkor indul, ha egy regisztrált eszköz figyeléseinek legjobb találati hash-e megváltozik
- a push üzenet payload nélküli; a részleteket az app nyitáskor tölti be

## PWA / push

- service worker: `/sw.js`
- VAPID publikus kulcs a kliensben használható
- VAPID privát kulcs Supabase Vaultban
- iPhone-on Web Pushhoz a webappot a Főképernyőre kell telepíteni, majd felhasználói gombnyomással engedélyezni az értesítést
- az első valódi push end-to-end teszt csak ilyen eszköz-előfizetés után végezhető el

## Saját üzlet

A manuálisan felvett üzlet biztonsági okból gyorslink. Tetszőleges felhasználói URL nem válik automatikusan szerveroldali scraperré. Új automatikus forrást csak külön adapterként, ellenőrzés után kötünk be.

## Árértékelés

A „Tényleg jó akció?” értékelés csak legalább 3 külön napi árpont után ad minősítést. Addig az app jelzi, hogy az árhistorika még épül.


## Kedvencek és figyelések – 2026-10-03

A külön kedvenc- és figyelőrendszer helyett egy közös logika marad:
- a szívvel mentett termék/márka kedvenc és egyben napi figyelés
- a kezdőlapon külön „Kedvenceid” blokk mutatja az aktuális legjobb találatokat
- a kedvenc találat egy érintéssel hozzáadható a bevásárlólistához
- ugyanaz a mentett kifejezés hajtja a Web Push „új / olcsóbb lett” értesítést, így nincs dupla állapot vagy dupla háttérfolyamat

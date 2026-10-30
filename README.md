# Volley Parma – calendari e risultati

PWA in italiano, pensata per lo smartphone, con calendari, risultati e classifiche della pallavolo di Parma e provincia.
Uno scraper in TypeScript gira come GitHub Action ogni 2 ore e scrive file JSON statici in `data/`. L'app (Vite + React) legge solo
quei file: non c'è nessun server da gestire.

| Ambito | Fonte | Stato |
|---|---|---|
| Torneo misto CSEN Parma | volleymistocsenparma.it | ✅ incluso |
| Campionati regionali FIPAV Emilia-Romagna (solo gare con squadre di Parma) | crer.portalefipav.net | ✅ incluso |
| Campionati nazionali A1–B2 (solo gare con squadre di Parma) | JSON di federvolley.it (media.myvolley.net) | ✅ incluso |
| Campionati provinciali FIPAV Parma | fipavonline.it | ⛔ escluso: i termini del sito vietano lo scraping. Nell'app c'è solo il link. Vedi `docs/richiesta-autorizzazione-fipav.md` |
| Rassegna stampa | feed RSS di 12 TV Parma, ParmaReport, iVolley Magazine, Federvolley | ✅ inclusa. Gazzetta di Parma, SportParma, ParmaToday, ParmaDaily e VolleyNews esclusi (vietano la raccolta automatica): solo articoli aggiunti a mano |

Dettagli su URL, struttura HTML e limiti di ogni fonte: [docs/FONTI.md](docs/FONTI.md).

## Struttura

```
shared/model.ts            modello dati comune (Campionato, Squadra, Partita, Classifica, Meta)
scraper/src/
  main.ts                  esegue le fonti, conserva l'ultimo dato valido, scrive data/*.json
  build.ts                 unisce le fonti: alias, filtro Parma, gare spostate, report
  parma.ts                 riconoscimento delle squadre di Parma e provincia
  alias.ts                 lettura di alias.json, whitelist-manuale.json, colori.json
  colors.ts                palette accessibile e assegnazione deterministica dei colori
  rassegna.ts              rassegna stampa: feed RSS, articoli pertinenti, squadre citate
  http.ts                  fetch con User-Agent dichiarato, 1 richiesta/1,2 s per host, cache ETag su disco
  sources/                 una fonte per file (csen, crer, myvolley, fipavParma)
scraper/test/              test dei parser con fixture HTML/JSON salvate
web/                       PWA (index.html, src/, public/ con icone e splash)
data/                      dati generati + file di configurazione modificabili a mano
.github/workflows/         Action ogni 2 ore: scraping, commit dei dati, pubblicazione su Aruba
scripts/pubblica-aruba.ts  invio al sito Aruba dei soli file cambiati (con web/public/api/*.php e web.config)
```

## Installazione

Serve Node.js 22 o superiore (testato con Node 24).

```bash
npm install
```

## Scraper

```bash
npm run scrape                     # tutte le fonti abilitate
npm run scrape -- --fonte=csen     # una sola fonte (csen | crer | myvolley)
npm run scrape -- --solo-build     # rigenera data/*.json dagli snapshot, senza scaricare nulla
npm run scrape -- --salta=myvolley # non interroga le fonti indicate, usa il loro ultimo snapshot
```

Cosa produce in `data/`:

| File | Contenuto |
|---|---|
| `campionati.json`, `squadre.json`, `partite.json`, `classifiche.json` | dati letti dall'app |
| `meta.json` | ora di generazione e stato di ogni fonte (ultimo successo, errore) |
| `report-parma.md` | **report di debug**: squadre riconosciute come parmensi in ogni campionato regionale/nazionale, con il motivo |
| `fonti/<fonte>.json` | ultimo snapshot valido di ogni fonte |
| `rassegna.json` | rassegna stampa della stagione: titolo, testata, data, link, breve estratto, squadre citate (vedi `docs/FONTI.md` §7) |
| `rose.json` | rose delle squadre di Parma (CSEN, Lega Volley Femminile): nome, numero, ruolo, link alla foto (vedi `docs/FONTI.md` §6) |
| `loghi/*.webp`, `loghi/indice.json`, `loghi/abbinamenti.json` | loghi delle squadre (96×96), da dove vengono e abbinamenti per nome (vedi `docs/FONTI.md` §5) |

Comportamento in caso di problemi:

- ogni fonte è indipendente. Se una fallisce (errore di rete, struttura cambiata, numero di gare sospetto) il suo snapshot
  precedente **non viene toccato**, l'errore finisce in `meta.json` e nel log, e il processo esce con codice 1;
- nell'app l'intestazione segnala "una fonte non aggiornata" e la pagina Info mostra da quando i dati sono fermi.

Rispetto delle fonti: User-Agent dichiarato, al massimo una richiesta ogni 1,2 secondi per host, richieste condizionali
(ETag) e scoperta completa dei gironi **una volta al giorno**. Negli altri giri si scaricano solo i gironi con squadre di
Parma (oggi circa 20 richieste a giro). Per cambiare il contatto nel User-Agent usa la variabile `SCRAPER_USER_AGENT`.

## App

```bash
npm run dev        # sviluppo su http://localhost:5173 (legge direttamente data/)
npm run build      # controllo tipi + build in dist/ (copia i JSON in dist/data/)
npm run preview    # prova la build, service worker compreso
```

Funzioni: prossime gare per giorno (Oggi / Weekend / 7 giorni / Tutte), risultati recenti, filtri per campionato, livello,
genere, squadra e comune, pagina della singola squadra, classifiche, "Le mie squadre" (salvate in `localStorage`),
dettaglio gara con parziali, mappa e link alla fonte, condivisione (Web Share API, altrimenti copia negli appunti), gare
rinviate e spostate in evidenza, rassegna stampa (anche nella pagina della squadra), tema chiaro/scuro automatico, legenda colori sempre a portata di mano.

In più:
- **home**: riepilogo del weekend (gare, quante in provincia, derby) e prossima gara delle squadre seguite con conto alla rovescia;
- **derby** (due squadre di Parma in un campionato regionale o nazionale) evidenziati nelle card e nel dettaglio;
- **forma**: ultimi 5 risultati (V/P) nelle classifiche e nella pagina squadra, con la serie in corso;
- **classifiche**: frecce ▲▼ rispetto alla giornata precedente (calcolate confrontando con la classifica pubblicata prima,
  `scraper/src/build.ts` → `applicaVariazioni`) e zone colorate da `data/zone-classifiche.json`;
- **calendario della squadra**: la build scrive `data/calendari/<id>.ics` per ogni squadra di Parma (`shared/ics.ts`); dalla
  pagina squadra ci si iscrive (iPhone/Mac/Outlook con `webcal://`, Google Calendar) o si scarica il file;
- **immagine da condividere** (1080×1080, `web/src/lib/immagine.ts`): risultato con parziali o locandina della prossima gara,
  con loghi e colore del campionato, condivisa con la Web Share API o scaricata;
- titoli della rassegna scritti tutti in maiuscolo riportati in forma normale, servizi dei TG segnalati come video;
- font Barlow Condensed (`@fontsource`, incluso nell'app e disponibile offline) per titoli, punteggi e numeri.

PWA: installabile (manifest, icone, splash iOS), offline con gli ultimi dati (*stale-while-revalidate* sui JSON: quando
arrivano dati nuovi l'app li ricarica da sola) e avviso "Nuova versione disponibile".

Verifiche fatte: Lighthouse 13.5 → accessibilità 100, best practice 100. La categoria PWA non esiste più da Lighthouse 12:
con Lighthouse 11.7.1 → PWA 100, accessibilità 100.

## Pubblicazione

L'app è pubblicata su Aruba: **https://www.giacomorabaglia.com/calendariogare/** (hosting Windows, IIS). Aruba non esegue
Node e il suo PHP può scrivere solo in `mdb-database`, la cartella nella radice del dominio. Per questo l'aggiornamento
automatico funziona come in Classifiche, senza FTP:

- l'Action [`aggiorna-e-pubblica.yml`](.github/workflows/aggiorna-e-pubblica.yml) gira **ogni 2 ore** (e a ogni push su
  `main`, senza scraping): test, scraping, commit di `data/` se i dati sono cambiati, poi `npm run pubblica:aruba`;
- [`scripts/pubblica-aruba.ts`](scripts/pubblica-aruba.ts) fa la build e chiede al sito le impronte dei file che serve adesso
  (`api/index.php?a=sito-impronte`). Se qualcosa è cambiato, manda uno zip con i soli file nuovi o cambiati
  (`?a=sito-carica`, intestazione `X-Chiave`). Se non è cambiato nulla non manda niente;
- il server estrae lo zip in `mdb-database/calendariogare/sito/` ([`web/public/api/_pubblicazione.php`](web/public/api/_pubblicazione.php))
  e [`web.config`](web/public/web.config) fa servire quei file da `api/sito.php` al posto di quelli statici;
- se una fonte fallisce si pubblicano comunque gli ultimi dati validi e l'esecuzione viene segnata come fallita (arriva
  l'email di GitHub). Il report delle squadre di Parma è nel riepilogo dell'esecuzione.

`api/` e `web.config` non passano mai dalla pubblicazione automatica: si caricano a mano.

### Campionati nazionali dal PC

`media.myvolley.net` è dietro Cloudflare, che risponde **403 agli IP dei server di GitHub**. Da una connessione domestica
invece risponde. L'Action quindi salta questa fonte (`--salta=myvolley`) e usa l'ultimo snapshot. Se è più vecchio di 3 giorni
lo segnala con un avviso, senza far fallire l'esecuzione. Gli aggiornamenti arrivano dal PC:

- [`scripts/aggiorna-nazionali.ps1`](scripts/aggiorna-nazionali.ps1) lavora in un clone dedicato
  (`%LOCALAPPDATA%\CalendarioGare-nazionali`, riallineato a `origin/main` a ogni giro). Lancia
  `npm run scrape -- --fonte=myvolley` e fa commit e push di `data/` se è cambiato qualcosa. Il push fa partire l'Action,
  che pubblica su Aruba. Log in `%LOCALAPPDATA%\CalendarioGare-nazionali.log`;
- [`scripts/installa-aggiorna-nazionali.ps1`](scripts/installa-aggiorna-nazionali.ps1) crea l'attività pianificata
  *CalendarioGare - nazionali* (ogni sera alle 23:15, sabato e domenica anche alle 19:15; se il PC è spento all'ora
  prevista parte appena possibile):

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\installa-aggiorna-nazionali.ps1
  ```

### Prima installazione

1. Crea il repository su GitHub (anche privato) e fai il push su `main`.
2. *Settings → Actions → General → Workflow permissions: **Read and write***, perché l'Action fa il commit dei dati.
3. *Settings → Secrets and variables → Actions → New repository secret*: `ARUBA_CHIAVE`, con la chiave che trovi in
   `aruba/calendariogare-config.php` (e nel `.env`, per lanciare la pubblicazione dal PC). Sono file esclusi da git.
   Se ti servisse una chiave nuova, una stringa lunga e casuale va bene, purché sia la stessa nei tre posti.
4. Con FileZilla:
   - carica `aruba/calendariogare-config.php` nella cartella `mdb-database` del dominio (accanto a `classifiche-config.php`);
   - fai `npm run build` e carica **tutto** il contenuto di `dist/` nella cartella `/calendariogare`, compresi `api/` e `web.config`.
5. Avvia la prima esecuzione da *Actions → Aggiorna dati e pubblica → Run workflow*.

Dal PC si può pubblicare anche a mano: `npm run pubblica:aruba` (legge `ARUBA_CHIAVE` dal `.env`).

### Dopo un caricamento completo con FileZilla

Le copie in `mdb-database/calendariogare/sito/` hanno la precedenza sui file della cartella. Se ricarichi tutto `dist/` a
mano (per esempio per aggiornare `api/` o `web.config`), lancia poi `npm run pubblica:aruba -- --svuota`, che le toglie.

### Altri hosting

`npm run build` produce percorsi relativi: il contenuto di `dist/` funziona in qualsiasi cartella. Il `web.config` serve
solo su IIS: dichiara i tipi `.webmanifest` e `.webp`, che IIS altrimenti non serve (404). Le sue regole di riscrittura
non fanno nulla finché `mdb-database/calendariogare/sito/` non esiste. Su un altro hosting i file vanno ricopiati dopo
ogni aggiornamento dei dati, oppure va adattato il passo di pubblicazione del workflow.

## Configurazione manuale

Dopo ogni modifica: `npm run scrape -- --solo-build`, poi controlla `data/report-parma.md`.

### `data/alias.json` – nomi delle squadre

La stessa squadra può comparire con nomi diversi (sponsor, abbreviazioni, stagioni diverse). Maiuscole, accenti,
punteggiatura, forme giuridiche (ASD, SSD, POL…) e sigla provincia finale vengono già ignorate. Per i casi rimanenti:

```json
{
  "squadre": [
    { "nome": "CRAL CRÉDIT AGRICOLE", "varianti": ["CREDIT AGRICOLE"], "comune": "Parma" },
    { "nome": "Volley Felino", "varianti": ["MOLINARI VOLLEY FELINO", "FELINO VOLLEY"], "societa": "ASD Volley Felino" }
  ]
}
```

`nome` è il nome mostrato nell'app. `comune` e `societa` sono facoltativi e prevalgono su quanto dedotto dalle fonti.
`logo` è facoltativo: un URL usato al posto di quello della fonte (prendilo solo da siti che ne consentono l'uso),
oppure `false` per mostrare il monogramma.
Squadre con lo stesso nome in campionati diversi (es. Serie D maschile e Under 17 femminile della stessa società) restano
squadre distinte.

### `data/whitelist-manuale.json` – filtro "squadre di Parma"

Per i campionati regionali e nazionali una gara è inclusa se almeno una squadra è riconosciuta come parmense. I criteri,
nell'ordine:

1. esclusa a mano (`escludi`) → mai parmense;
2. nella whitelist (`squadre`);
3. codice affiliazione FIPAV che inizia con `08038` (o con un prefisso in `codiciSocieta`);
4. provincia `PR` dichiarata dalla fonte o sigla `PR` in fondo al nome;
5. società del portale regionale con un'altra squadra già riconosciuta (o in `idSocietaCrer`);
6. nome presente nei campionati provinciali (CSEN, e FIPAV Parma se un giorno sarà abilitato);
7. squadra di casa in una palestra della provincia di Parma.

```json
{
  "squadre": ["NOME SQUADRA NON RICONOSCIUTA"],
  "codiciSocieta": [],
  "idSocietaCrer": ["4470"],
  "escludi": ["SQUADRA RICONOSCIUTA PER ERRORE"]
}
```

### `data/privacy.json` – rose e richieste di rimozione

Le rose contengono dati personali. Regole fisse: foto solo come link alla fonte, mai foto di minorenni o di chi non ha
una data di nascita verificabile (LVF), data di nascita mai pubblicata. Per le richieste:

```json
{
  "contatto": "volleyparma@example.org",
  "nascondiRose": ["NOME SQUADRA"],
  "nascondiAtleti": ["Cognome Nome"],
  "nascondiFoto": ["Cognome Nome"]
}
```

`contatto` (email o link) compare nella pagina squadra e in Info: finché è vuoto l'app invita a rivolgersi alla fonte.
Ti conviene impostarlo prima di pubblicare l'app. Dopo una modifica: `npm run scrape -- --solo-build`.

### `data/rassegna-config.json` – rassegna stampa

```json
{
  "squadre": [{ "parole": ["club italia"], "squadre": ["CLUB ITALIA"], "senza": ["maschil"] }],
  "articoli": [{ "titolo": "…", "url": "https://www.gazzettadiparma.it/…", "data": "2026-10-25", "testata": "Gazzetta di Parma" }],
  "escludi": ["https://… articolo fuori tema"]
}
```

- `squadre`: parole (a parola intera, senza badare a maiuscole e accenti) che nel titolo o nell'attacco indicano una
  squadra. `squadre` accetta nomi di squadra o di società come in `squadre.json`: con una società si associano tutte le
  sue squadre. `senza` annulla l'abbinamento se compare una di quelle parole (anche come inizio di parola).
- `articoli`: articoli aggiunti a mano, per esempio dalle testate che non si possono leggere in automatico. `squadre`
  è facoltativo: se manca si ricava dal titolo.
- `escludi`: URL da non mostrare.

### `data/zone-classifiche.json` – zone delle classifiche

Le regole di promozione e retrocessione cambiano per campionato e stagione, quindi si indicano a mano (vuoto = nessuna zona):

```json
{
  "campionati": {
    "crer-serie-c-m": { "promozione": 1, "playoff": [2, 4], "retrocessione": 2 },
    "naz-b2-f": { "promozione": 1, "playout": [9, 10], "retrocessione": 3 }
  }
}
```

`promozione` e `retrocessione` sono il numero di posizioni in testa e in coda, `playoff` e `playout` un intervallo di
posizioni. Gli id dei campionati sono in `data/campionati.json`. Dopo una modifica: `npm run scrape -- --solo-build`.

### `data/colori.json` – colori dei campionati

I colori sono assegnati in modo deterministico dall'id del campionato, da una palette di 18 colori con contrasto AA
verificato nei test per entrambi i temi. Per forzarne uno: `{ "campionati": { "crer-serie-d-f": "viola" } }` (i nomi
sono in `scraper/src/colors.ts`).

## Aggiungere un campionato o una fonte

- **Nuovo campionato di una fonte esistente**: niente da fare. I gironi regionali e nazionali vengono scoperti dagli
  indici delle fonti ogni giorno, e compaiono se ci gioca una squadra di Parma. Le serie nazionali considerate sono in
  `SERIE_NAZIONALI` (`scraper/src/sources/myvolley.ts`).
- **Nuova fonte**:
  1. documentala in `docs/FONTI.md` (URL, struttura, robots.txt, termini d'uso);
  2. crea `scraper/src/sources/<nome>.ts` con parser puri (`parse…(html)`) e un oggetto `Fonte` con `esegui()` che
     restituisce uno `Snapshot`. Usa `filtroParma: true` se vanno tenute solo le gare con squadre di Parma;
  3. salva le pagine di esempio in `scraper/test/fixtures/<nome>/` (senza dati personali) e scrivi i test;
  4. aggiungila all'elenco `FONTI` in `scraper/src/main.ts`: le fonti provinciali prima di quelle regionali e nazionali.
- **Abilitare i provinciali FIPAV** (solo con autorizzazione scritta): implementa `esegui` in
  `scraper/src/sources/fipavParma.ts` seguendo `csen.ts` e metti `abilitata: true`.

## Test

```bash
npm test
```

I test leggono le fixture salvate di ogni fonte. Se un sito cambia struttura, aggiorna la fixture scaricando di nuovo la
pagina: i test che falliscono indicano cosa sistemare nel parser. In produzione lo scraper si accorge comunque di risultati
anomali (zero partite, calo improvviso, squadre senza nome) e mantiene i dati precedenti.

Icone e splash screen si rigenerano da `web/public/favicon.svg` con `npm run icons`.

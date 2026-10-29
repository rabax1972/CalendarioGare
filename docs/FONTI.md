# Fonti dati

Esplorazione fatta il 25/10/2026 (stagione 2026/27) con richieste `curl` singole e User-Agent dichiarato:
`CalendarioGareParma/0.1 (+contatto: …; progetto non commerciale)`. Nessuna fonte ha richiesto Playwright.
Le fixture salvate per i test sono in `scraper/test/fixtures/`.

## Riepilogo

| # | Ambito | Fonte usabile | Formato | Accesso lecito | Note |
|---|--------|---------------|---------|----------------|------|
| 1 | FIPAV provinciale Parma | fipavonline.it (comitato `08038`) | HTML | **NO**: i termini vietano lo scraping | Unica fonte dei dati provinciali FIPAV, vedi §1 |
| 2 | CSEN misto Parma | volleymistocsenparma.it | HTML server-side | Sì | Ottima: risultati con parziali, spostamenti, classifica, coordinate |
| 3 | FIPAV regionale ER | **crer.portalefipav.net** (non fipavonline) | HTML + iCalendar | Sì | Codice comitato `ComitatoId=35`, stagione `StId=2415` |
| 4 | Nazionale A1–B2 | **media.myvolley.net** (JSON usati da federvolley.it) | JSON | Sì | Include `province` e `cod_aff_societa` della squadra |
| 4b | Serie A (riserva) | legavolley.it, legavolleyfemminile.it | HTML | Sì (robots ok) | Non necessarie: la Serie A è già nel feed federale |

---

## 1. FIPAV provinciale Parma: fipavonline.it

- URL: `https://fipavonline.it/main/tutti_i_campionati/08038` (`08` = Emilia-Romagna, `038` = Parma).
- Tecnica: PHP dietro Cloudflare. Il fetch con User-Agent dichiarato **funziona** (HTTP 200, nessun challenge).
- `robots.txt`: contiene solo il testo standard Cloudflare sui "content signals", senza alcun `Disallow` né segnale espresso.
- Struttura vista (una sola pagina): elenco campionati con link `/gironi/edit/<id>` per ogni girone, cambio stagione con
  `/main/cambia_stagione/<n>/tutti_i_campionati`. Classifiche su `/main/classifica/<idGirone>` (sono quelle incorporate in
  iframe da fipavparma.it/classifiche).
- Campionati 2026/27 elencati: Prima, Seconda e Terza Divisione F, U19/U17/U15/U14/U13/U12 F, Prima Divisione M,
  U19/U17/U15/U14/U13/U13 4vs4/U12/U12 4vs4 M, Open Misto (con relativi gironi A–D).

### Limitazione bloccante: i termini d'uso vietano lo scraping

Il footer di **ogni** pagina riporta:

> Manufacturing Point software e la Federazione Italiana Pallavolo si impegnano attivamente a proteggere i propri dati
> dall'accesso non autorizzato attraverso il web scraping. Qualsiasi tentativo di acquisire informazioni senza
> autorizzazione sarà considerato una violazione delle politiche di tutela dei dati e dei dati personali e sarà
> perseguito legalmente.

È un divieto esplicito, quindi **non** ho esplorato oltre (niente pagine girone/calendario, niente Playwright).
Il fatto che oggi non blocchi tecnicamente le richieste non cambia la sostanza.

Alternative verificate:
- **fipavparma.it** (WordPress del comitato): nessun dato proprio. Le classifiche sono iframe verso fipavonline e i
  calendari non sono pubblicati in altro formato. Gli articoli "Indizione campionato" hanno solo PDF di regolamento.
- **myvolley / federvolley**: l'indice copre solo le serie nazionali, non i provinciali.
- **crer.portalefipav.net**: solo attività regionale e nazionale disputata in ER.

Strade lecite possibili (da decidere):
1. **Chiedere autorizzazione** al Comitato Territoriale FIPAV Parma (via Luigi Anedda 5A, Parma; cell. 379 2734849)
   e/o a Manufacturing Point s.r.l.: uso non commerciale, poche richieste ogni 2–3 ore, link alla fonte.
   Con un'autorizzazione scritta lo scraper provinciale FIPAV si implementa come gli altri.
2. **Senza dati FIPAV provinciali**: nell'app ogni campionato provinciale FIPAV diventa una scheda con link diretto alla
   pagina fipavonline (uscita esterna, non iframe), senza partite proprie.
3. Inserimento manuale/CSV da parte di un referente (poco sostenibile).

### Impatto sul filtro "squadre di Parma"

Le specifiche prevedevano di ricavare l'elenco delle società parmensi dai provinciali FIPAV. Non serve:
- nel feed nazionale ogni squadra ha `province: "PR"` e `cod_aff_societa` con prefisso **`08038`** (es. `080380063`);
- nel portale regionale il nome squadra termina con la sigla provincia (`… PR`) e la palestra riporta `PARMA PR`;
- in più, l'elenco CSEN e `data/whitelist-manuale.json` restano come rinforzo.

---

## 2. CSEN misto Parma: volleymistocsenparma.it

- Tecnica: ASP.NET Core, HTML renderizzato lato server, nessuna protezione anti-bot.
- `robots.txt`: 404 (nessuna restrizione). Nessun divieto di riuso trovato (solo privacy, titolare CSEN Parma).
- Pagine:
  - Calendario: `https://www.volleymistocsenparma.it/Calendario?stagioneId=<id>&fase=<A|B|>&squadraId=<id>`
    - `stagioneId`: `1` = 2026-27, `2` = 2025-26 (valori nel `<select id="filtro-stagione">`).
    - senza parametri restituisce la stagione corrente, tutte le fasi: **una sola richiesta basta**.
  - Classifica: `/Classifica` (stessi filtri). Squadre: `/Squadre`. Palestre: `/Orari`. Live: `/LiveScore`.
  - Export PDF/Excel generato **lato client** (pulsanti `data-esporta-formato`), quindi non c'è un endpoint da usare.
- Struttura calendario:
  - una `<table class="table table-striped align-middle">` per girone, preceduta dal titolo `Girone A`/`Girone B`;
  - riga giornata: `<tr class="calendario-giornata"><th colspan="8">Giornata N <span>27/10 - 29/10/2026</span>`;
  - riga partita, 8 `<td>`: N. gara | `Martedì 27/10/2026 20:00` | casa | `vs` | ospite | luogo (+ link OpenStreetMap
    con `mlat`/`mlon`) | arbitro (è una squadra) | risultato;
  - risultato: `<span class="badge bg-secondary">Da disputare</span>` oppure `<span class="badge bg-success">2 - 1</span>`
    con i parziali in `<div class="small text-muted">19-25, 25-10, 25-17</div>`;
  - partita spostata: `<tr class="table-info">` + `<span class="badge">Spostata</span>` +
    `<div class="small text-muted">era Mercoledì 16/12 20:00</div>`;
  - il link "Aggiungi a Google Calendar" contiene l'**indirizzo completo** della palestra nel parametro `location`.
- Formato di gioco: 3 set fissi (risultati 3-0, 2-1, …), non al meglio dei 5.
- Squadre 2026-27 (20, gironi A e B): ALPINI, BONGIO AZUL, BONGIO BLUE, CEDACRI GIOCOPARMA, Cral CHIESI,
  CRAL CRÉDIT AGRICOLE, CUS, CUS 3, CUS CUS, EMBOLO, GZBO, GZBO 2, INZANITY, ISOMEC INZANI PARMA ASFALTI,
  LAUMAS GIOCOPARMA, MONCHIO, MONTEBELLO, NOT NORMAL, SHIRATORINZANI, VARANESE.
- Limitazioni: il comune della squadra non è esplicito (va ricavato dalla palestra o messo in alias). Il nome cambia
  tra stagioni (es. `CREDIT AGRICOLE` → `CRAL CRÉDIT AGRICOLE`). Il rinvio senza nuova data non è stato osservato.

---

## 3. FIPAV regionale Emilia-Romagna

### Come ci si arriva

`fipavcrer.eu` (CMS Passweb) → pagina `/it/fipav-online` → link **"Calendari e Risultati Pallavolo"** →
`https://crer.portalefipav.net/risultati-classifiche.aspx?PId=29422`.

Quindi i campionati regionali ER **non sono su fipavonline.it** ma sul portale FIPAV "portalefipav" (piattaforma NEWBIT).
Codici trovati:
- **`ComitatoId=35`** (Comitato Regionale Emilia-Romagna)
- **`StId=2415`** = stagione 2026/27 (2297 = 2025/26, 2178 = 2024/25, …)
- `PId=29422` = id della pagina pubblica "Risultati e classifiche"

### Accesso

- IIS/ASP.NET, nessuna protezione anti-bot. `robots.txt` blocca solo cartelle tecniche (`/mngarea/`, `/files/`,
  `/download.aspx`, …); `risultati-classifiche.aspx` e `classifica.aspx` sono consentiti.
- Nessuna clausola anti-scraping nelle pagine. Il portale offre esso stesso feed **iCalendar** per l'abbonamento: uso
  automatico previsto.

### URL

- Risultati e calendario (GET):
  `https://crer.portalefipav.net/risultati-classifiche.aspx?ComitatoId=35&StId=2415&DataDa=&StatoGara=&CId=<girone>&SId=&PId=29422&btFiltro=CERCA`
  - `DataDa` vuoto = tutte le date (senza parametri mostra solo la settimana corrente);
  - `StatoGara`: vuoto = tutte, `1` = disputate, `0` = da disputare;
  - `CId` = girone; vuoto = tutti i gironi (pagina grande); `SId` = società.
- Elenco gironi della stagione: dal `<select name="CId">` (anche `?act=campionato&SId=<StId>`, frammento AJAX).
- Classifica: `https://crer.portalefipav.net/classifica.aspx?CId=<girone>` (anche "alla giornata N", e `tipo=avulsa`).
- Feed iCalendar per girone: `https://www.portalefipav.net/iCalendar.asp?c=<token>`. Il token si legge nel link
  `CalendarioGare.asp?c=<token>` nella `<caption>` di ogni tabella. `REFRESH-INTERVAL` = 8h, `UID:FIPAV-<idGara>`.
- Export Excel: `esporta-risultati.aspx` (POST del form), non necessario.

### Gironi 2026/27 (`CId`)

Serie C M: 92487 (A), 92488 (B) · Serie C F: 92489–92491 (A–C) · Serie D M: 92492–92494 (A–C) ·
Serie D F: 92495–92499 (A–E) · U15F: 93810, 93812, 93813 · U17F: 93820–93822 · U17M: 93778 · U19F: 93757 ·
"CAMPIONATI NAZIONALI": 92450 (vedi sotto). L'elenco si legge ogni volta dal `<select>`, non va codificato.

### Struttura HTML

- Una `<table class="tbl tbl-risultati">` per girone; la `<caption>` contiene nome girone, link iCal e link classifica
  `classifica.aspx?CId=…`.
- Colonne: Gara | Giornata | `23/10/26 21:15` | casa | ospite | risultato | parziali | stato+info.
- Squadra: `<td title="<RAGIONE SOCIALE>"><img src="/mngArea/Societa/img/<idSocietà>/Loghi/LogoS<idSocietà>.jpg">NOME SQUADRA PR</td>`
  - il nome squadra termina **quasi sempre** con la sigla provincia (`PR`, `MO`, `RE`, …), ma non sempre
    (es. `GRANAROLO VOLLEY`, `POLISPORTIVA ICARE`);
  - `idSocietà` (nel path del logo) è un identificatore **stabile** della società: utile per gli alias.
- Risultato: `<td class="risultato" id="Risultato_<idGara>">3 - 2</td>`, parziali in `<span class="parziali">26-24</span>`.
- Stato: `<img src="/img/statogara/stato<N>.png" title="…">`; titoli osservati: `da disputare` (0),
  `risultato ufficioso` (1), `gara omologata`. Rinvii/spostamenti non osservati finora (inizio stagione): da verificare.
- Palestra e arbitri nell'attributo `title` (HTML escapato) dell'icona info:
  `<p><b>PALA CASALINI CAMPO B - GRANDE</b><br/> PARMA PR<br/>VIA LARGO BECCARIA</p><p class="designazione">…arbitri…</p>`.
  I nomi degli arbitri **non** vanno ripubblicati.

### Squadre di Parma viste in questa stagione (esempi)

ISOMEC GREEN INZANI PR (Serie C M), POL. AUDAX PARMA PR, TECHCAB ENERGY VOLLEY PARMA PR,
GALAXY VOLLEY COLLECCHIO PR, ASD POL. COOP PARMA 1964 PR.

### Girone "CAMPIONATI NAZIONALI" (CId 92450)

Contiene 226 gare nazionali (A1, A2, A3, B, B1, B2, Coppe) **disputate in impianti dell'Emilia-Romagna** (designazioni
arbitrali regionali); formato diverso (`6004 - A3 A - CASA MO vs OSPITE PV` in un'unica cella). Mancano le trasferte
fuori regione, quindi **non** va usato come fonte nazionale.

---

## 4. Nazionale: feed JSON federale (media.myvolley.net)

### Come l'ho trovato

`https://www.federvolley.it/campionati/serie-a-b` (Next.js) carica i dati lato client da file JSON statici su
`https://media.myvolley.net/public/json/`, serviti da Cloudflare con `Cache-Control: max-age=14400` (4h) ed `ETag`.
Sono gli stessi dati del sito ufficiale; il sito offre anche il download `calendario.xlsx`.
`robots.txt` contiene solo il testo standard Cloudflare, senza restrizioni.

### URL

- Indice stagioni: `/public/json/index.json`
- Indice di una stagione (paginato): `/public/json/2026/index.json` → `pages[].path_index` (`2026/<n>/index.json`, 36 pagine,
  per lo più beach volley); ogni pagina ha `calendars[]` con `path`, `series`, `sex`, `girone`, `matchesCount`.
- Calendario girone: `/public/json/<anno>/<serie>/<sesso>/<girone>/calendario.json` (es. `2026/B/M/C/calendario.json`, circa 650 KB)
- Classifica girone: `/public/json/<anno>/<serie>/<sesso>/<girone>/classifica.json` (circa 20 KB)
- `anno` = anno di inizio stagione (2026 = 2026/27).

### Gironi indoor 2026/27

A1 F/M (`U`), A2 F/M (`U`), A3 F/M (`A`,`B`), B M (`A`–`H`), B1 F (`A`–`D`), B2 F (`A`–`I`,`L`),
più coppe/supercoppe (`SCA1`, `SCA2`, `SCSI`).

### Struttura `calendario.json`

`data`: `title`, `season`, `giornate[]`, `matches[]`. Ogni partita:
- `id`/`ng` (numero gara), `giornata`, `date` (`17/10/2026`), `time` (`19.00`), `ts_gara` (epoch);
- `impianto` {`denominazione`, `indirizzo`, `cap`, `localita`, `provincia`}; `lat-stadium`/`lng-stadium` (spesso vuoti);
- `played` (bool), `ris_ufficiale` (`"1"`/`"0"`), `is_live`, `team1-setwin`, `team2-setwin`, `pt_a[]`/`pt_b[]` (parziali);
- `data_ultimo_aggiornamento`;
- `team1`/`team2`: `id`, `name` (con sigla provincia), `cod_aff_societa` (9 cifre: regione+comitato+progressivo, Parma =
  `08038…`), `city`, `province`, `series`, `sex`, `girone`.

**Attenzione dati personali**: le squadre includono email, telefoni e nomi dei referenti, e le gare i nomi degli arbitri
(`ufficiali_gara`). Lo scraper deve tenere **solo** i campi necessari. Le fixture sono già ripulite.

Rinvii: nessun campo esplicito osservato. Probabilmente si riconoscono da data cambiata o `played=false` con data passata:
da verificare durante la stagione.

### Squadre di Parma nei nazionali 2026/27

Filtro `province == "PR"` o `cod_aff_societa` che inizia con `08038`, su tutte le 30 classifiche indoor:

| Serie | Girone | Squadra | Codice società | Comune |
|-------|--------|---------|----------------|--------|
| B maschile | C | VERDIANO BUSSETO VOLLEY PR | 080380063 | Busseto |
| B2 femminile | E | GALAXY COLLECCHIO PR | 080380209 | Collecchio |
| B2 femminile | E | CIRCOLO MINERVA ASD PR | 080380153 | Parma |

Nessuna squadra di Parma in A1/A2/A3 quest'anno.

### Leghe (solo riserva)

- legavolley.it: `robots.txt` blocca solo statistiche e simili; calendario su `/calendario/?IdCampionato=<id>` (HTML).
- legavolleyfemminile.it: `robots.txt` vuoto; calendario su `/calendario/?serie=&campionato=&stagione=2026&club=<id>`.
- Non servono finché la Serie A è nel feed federale e non ci sono squadre parmensi in A. Da implementare solo se servisse
  un dato in più (es. diretta TV).

---

## 5. Loghi delle squadre

| Fonte | Dove | Uso |
|---|---|---|
| CSEN | `https://www.volleymistocsenparma.it/Squadre`: `<img src="/Squadre/Logo/<id>?v=<versione>" alt="Logo NOME">` | ✅ (robots.txt assente) |
| Feed federale | campo `team.logo` (`…/loghi/squadre/Fipav_logo_<anno>_<serie>_<id>.png`); `fallback.png` = nessun logo | ✅ (poche squadre ce l'hanno) |
| Lega Volley Femminile | club da `legavolleyfemminile.it/calendario/?serie=<1/2>&stagione=<anno>` (link `club=<id>`), immagine `https://ww5.legavolleyfemminile.it/imgSocietaSquadra.aspx?idImg=<id>` | ✅ robots.txt vieta solo `/upload/`. Abbinamento per nome: 14/17 squadre di A2 F (le 3 restanti hanno sponsor diversi) |
| Portale regionale | `/mngArea/Societa/img/<id>/Loghi/LogoS<id>.jpg` | ⛔ robots.txt: `Disallow: /mngarea/` |

I loghi si scaricano una volta (rinnovo dopo 30 giorni), si riducono a WebP 96×96 e si pubblicano da `data/loghi/`
insieme all'app. Le squadre senza logo hanno un monogramma col colore del campionato. I loghi restano marchi delle
rispettive società: si usano solo per riconoscere la squadra, e si possono togliere con `"logo": false` in `data/alias.json`.

## 6. Rose delle squadre (dati personali)

Solo per le **squadre di Parma** e solo dove la fonte pubblica la rosa:

| Fonte | Dove | Dati |
|---|---|---|
| CSEN | `/Squadre` (`.squadra-card`, link `/Squadre/Dettaglio/<id>`), poi la pagina della squadra: `<tr class="rosa-riga" data-nome data-cognome data-numero data-ruolo data-foto>` | nome, numero, ruolo, foto (`/Squadre/FotoGiocatore/<id>?v=…`). Nessuna data di nascita: è un torneo amatoriale per adulti |
| Lega Volley Femminile | `https://www.legavolleyfemminile.it/club/<slug>/<id>/roster/` (`.scheda-giocatrice-squadra`), profilo `/player/<slug>/<codice>/` con "Data di nascita" | nome, numero, ruolo, foto (`ww1.legavolleyfemminile.it/Foto.aspx?Key=…`); include lo staff |
| Portale regionale, feed federale | non pubblicano rose | — |

Scelte di tutela, in `scraper/src/rose.ts`:
- si pubblicano solo nome, numero, ruolo e il **link** alla foto: la foto non è copiata, se la fonte la toglie sparisce
  anche dall'app;
- per la LVF la foto si mostra solo se la data di nascita conferma che l'atleta è **maggiorenne**. Se la data non c'è,
  non si mostra. La data di nascita serve solo a questo calcolo e non viene pubblicata. Al 26/10/2026 nel Club Italia
  sono nascoste 3 foto su 15;
- `data/privacy.json` permette di togliere persone, foto o intere rose su richiesta e di indicare un contatto, che
  compare nell'app;
- aggiornamento: rose ogni 3 giorni, profili LVF ogni 14 giorni (cache), circa 20 richieste a CSEN e 16 a LVF.

## 7. Rassegna stampa

Verifica fatta il 29/10/2026. Si usano solo **feed RSS** (formato pensato per la lettura automatica) di testate che non
vietano l'accesso automatico. Si pubblicano titolo, data, link e al massimo 200 caratteri dell'attacco preso dal feed:
l'articolo si legge sul sito della testata.

| Testata | Feed | Esito |
|---|---|---|
| 12 TV Parma | ricerca WordPress `/?s=volley&m=AAAAMM&feed=rss2` (anche `pallavolo`) | ✅ robots.txt senza limiti, nessun divieto nei termini. Titoli in maiuscolo, il feed non ha testo |
| ParmaReport | come sopra | ✅ robots.txt senza limiti per `*`, termini senza divieti |
| iVolley Magazine | ricerca `parma` e `club italia` | ✅ robots.txt standard WordPress |
| Federvolley | `https://www.federvolley.it/news-feed` (Drupal, data in `<time datetime>`) | ✅ `Allow: /`. Solo le ultime 20 notizie, **senza paginazione**: lo storico si accumula da un giro all'altro |
| Gazzetta di Parma | nessun feed | ⛔ le note legali vietano «bot, crawler, spider, scraper» senza consenso |
| SportParma | `/argomenti/volley/feed/` | ⛔ robots.txt: vietato «data mine or scrape the content using automated means» senza permesso scritto |
| ParmaToday | `/rss` | ⛔ stesso divieto nel robots.txt (Citynews) |
| VolleyNews | ricerca WordPress | ⛔ termini §4.2: vietato «estrarre sistematicamente articoli… tramite scraping automatico, bot» |
| ParmaDaily | ricerca WordPress | ⛔ Cloudflare risponde ai client non browser con una challenge (`cf-mitigated: challenge`): non va aggirata |
| ilParmense, Zerosette, ParmaPress24 | ricerca WordPress | consentiti ma senza articoli di pallavolo in questa stagione: non inclusi |
| siti delle società | — | non trovati: le società comunicano sui social |

Come funziona (`scraper/src/rassegna.ts`):
- le ricerche WordPress si interrogano **mese per mese** dall'inizio della stagione (luglio) con il parametro `m`,
  fino a 6 pagine per mese. WordPress risponde 404 quando non trova nulla. I mesi chiusi da più di 3 giorni finiscono
  in `completate` dentro `data/fonti/rassegna.json` e non si scaricano più: a regime sono circa 7 richieste a giro, con
  una cache di 2 ore;
- un articolo è tenuto se parla di pallavolo (`volley`, `pallavol`, `fipav`) e, per le testate non locali, se cita
  Parma, un comune della provincia, il PalaRaschi o una squadra. Lo stesso servizio ripetuto in due edizioni del TG
  (stesso titolo entro 3 giorni) compare una volta sola;
- le squadre si riconoscono dalle parole chiave in `data/rassegna-config.json`; lì si aggiungono anche articoli a mano
  (per esempio dalle testate escluse: il link è sempre lecito) e gli URL da nascondere.

## Regole operative per lo scraper

- User-Agent dichiarato con contatto; massimo 1 richiesta al secondo per host; cache su disco e `If-None-Match`/ETag
  dove disponibile (myvolley).
- Richieste per giro di aggiornamento (stima): CSEN 2 (calendario + classifica); CRER circa 1 + N gironi con squadre PR
  (calendario) + N classifiche; myvolley 1–2 indici + i soli gironi con squadre PR (oggi 2) + relative classifiche.
- Fonte FIPAV provinciale (fipavonline): **disattivata** finché non c'è un'autorizzazione.
- Non ripubblicare nomi di arbitri, email o telefoni.
- Ogni partita conserva l'URL della fonte originale per il link "vedi alla fonte".

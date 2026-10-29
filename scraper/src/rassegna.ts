import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Articolo, Rassegna, Squadra, Testata } from '../../shared/model.ts';
import { DATA_DIR, SNAPSHOT_DIR, etichettaStagione, stagioneCorrente } from './config.ts';
import { scarica } from './http.ts';
import { chiaveSquadra, pulisciSpazi, senzaAccenti } from './normalize.ts';

// Rassegna stampa: articoli di questa stagione sulle squadre di Parma, letti dai feed RSS delle testate che non vietano
// l'accesso automatico (vedi docs/FONTI.md §7). Si tengono solo titolo, link, data e un estratto breve: per leggere
// l'articolo si va sul sito della testata.

const FILE_CONFIG = path.join(DATA_DIR, 'rassegna-config.json');
const FILE_SNAPSHOT = path.join(SNAPSHOT_DIR, 'rassegna.json');
const ORA = 3600_000;
const GIORNO = 24 * ORA;
/** Lunghezza del testo tenuto per riconoscere le squadre: basta l'attacco dell'articolo. */
const TESTO_MAX = 400;
const ESTRATTO_MAX = 200;
const PAGINE_MAX = 6;

interface TestataFeed extends Testata {
  /** "ricerca": feed di ricerca WordPress, interrogato mese per mese; "feed": un feed unico con le ultime notizie. */
  tipo: 'ricerca' | 'feed';
  ricerche?: string[];
  feed?: string;
  /** Testata locale: ogni articolo è già "di Parma", basta che parli di pallavolo. */
  locale: boolean;
  /** Testata di sola pallavolo: basta che citi Parma o una squadra di Parma. */
  soloVolley: boolean;
}

export const TESTATE: TestataFeed[] = [
  { id: '12tvparma', nome: '12 TV Parma', url: 'https://www.12tvparma.it', tipo: 'ricerca', ricerche: ['volley', 'pallavolo'], locale: true, soloVolley: false },
  { id: 'parmareport', nome: 'ParmaReport', url: 'https://www.parmareport.it', tipo: 'ricerca', ricerche: ['volley', 'pallavolo'], locale: true, soloVolley: false },
  { id: 'ivolley', nome: 'iVolley Magazine', url: 'https://www.ivolleymagazine.it', tipo: 'ricerca', ricerche: ['parma', 'club italia'], locale: false, soloVolley: true },
  { id: 'federvolley', nome: 'Federvolley', url: 'https://www.federvolley.it', tipo: 'feed', feed: 'https://www.federvolley.it/news-feed', locale: false, soloVolley: true },
];

/** Parole che collocano un articolo a Parma e provincia (oltre ai nomi delle squadre). */
const CONTESTO_PARMA = [
  'parma', 'parmigiano', 'parmigiana', 'parmigiani', 'parmigiane', 'parmense', 'parmensi', 'palaraschi', 'giocoparma',
  'collecchio', 'busseto', 'noceto', 'fidenza', 'salsomaggiore', 'torrile', 'felino', 'sala baganza', 'traversetolo',
  'langhirano', 'mezzani', 'sorbolo', 'colorno', 'fornovo', 'medesano', 'montechiarugolo', 'san secondo', 'fontanellato',
  'soragna', 'varano', 'borgotaro', 'bedonia', 'lesignano', 'basilicagoio', 'sissa', 'trecasali', 'roccabianca',
];

const VOLLEY = /volley|pallavol|fipav|superlega/;

export interface VoceSquadre {
  /** Parole che, nel titolo o nell'attacco dell'articolo, indicano la squadra. */
  parole: string[];
  /** Nomi di squadra o di società come in squadre.json: si associano tutte le squadre di Parma corrispondenti. */
  squadre: string[];
  /** Se il testo contiene una di queste parole, l'abbinamento non vale (es. la squadra maschile omonima). */
  senza?: string[];
}

export interface ArticoloManuale {
  titolo: string;
  url: string;
  /** YYYY-MM-DD */
  data: string;
  /** Nome della testata (es. "Gazzetta di Parma"). */
  testata: string;
  /** Nomi di squadra o società; se manca si ricavano dal titolo. */
  squadre?: string[];
}

export interface ConfigRassegna {
  squadre: VoceSquadre[];
  /** Articoli aggiunti a mano, per esempio dalle testate che vietano la lettura automatica. */
  articoli: ArticoloManuale[];
  /** URL da non mostrare. */
  escludi: string[];
}

const CONFIG_VUOTA: ConfigRassegna = { squadre: [], articoli: [], escludi: [] };

export async function caricaConfigRassegna(): Promise<ConfigRassegna> {
  try {
    return { ...CONFIG_VUOTA, ...JSON.parse(await readFile(FILE_CONFIG, 'utf8')) };
  } catch {
    return CONFIG_VUOTA;
  }
}

/** Articolo come letto dal feed, prima del riconoscimento delle squadre. */
export interface ArticoloGrezzo {
  titolo: string;
  url: string;
  testata: string;
  /** Istante di pubblicazione (ISO). */
  pubblicato: string;
  /** Attacco dell'articolo in testo semplice (al massimo TESTO_MAX caratteri). */
  testo: string;
}

/** Ultimo stato valido, salvato in data/fonti/rassegna.json. */
export interface SnapshotRassegna {
  aggiornatoIl: string;
  stagione: string;
  /** Ricerche già concluse ("testata|ricerca|AAAA-MM"): i mesi passati non si scaricano più. */
  completate: string[];
  articoli: ArticoloGrezzo[];
}

export interface VoceFeed {
  titolo: string;
  url: string;
  pubblicato: string | null;
  descrizione: string;
}

/** Legge un feed RSS 2.0. La data può essere RFC 822 o, come su federvolley.it, un <time datetime="…"> annidato. */
export function parseFeed(xml: string): VoceFeed[] {
  const $ = cheerio.load(xml, { xml: true });
  return $('item')
    .toArray()
    .map((el) => {
      const item = $(el);
      const data = item.children('pubDate');
      const iso = data.find('time').attr('datetime') ?? pulisciSpazi(data.text());
      const d = iso ? new Date(iso) : null;
      return {
        titolo: pulisciSpazi(item.children('title').text()),
        url: pulisciSpazi(item.children('link').text()),
        pubblicato: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        descrizione: item.children('description').text(),
      };
    })
    .filter((v) => v.titolo && /^https?:\/\//.test(v.url));
}

/** Testo semplice da una descrizione HTML, senza le diciture automatiche di WordPress ("L'articolo … proviene da …"). */
export function testoSemplice(html: string): string {
  const testo = pulisciSpazi(cheerio.load(`<div>${html}</div>`).text());
  return pulisciSpazi(
    testo
      .replace(/L['’]articolo .+? proviene da .+?\.?$/s, '')
      .replace(/The post .+? appeared first on .+?\.?$/s, '')
      .replace(/\[(…|\.\.\.|&hellip;)\]|Continua a leggere.*$/gs, '')
      .replace(/\s*(…|\.\.\.)?\s*Leggi tutto\W*$/i, ''),
  );
}

export function estratto(testo: string, max = ESTRATTO_MAX): string | null {
  if (!testo) return null;
  if (testo.length <= max) return testo;
  const taglio = testo.slice(0, max);
  return taglio.slice(0, Math.max(taglio.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.–-]+$/, '') + '…';
}

/** Minuscole, senza accenti né punteggiatura, con spazi ai bordi: così " parola " trova solo parole intere. */
function normalizza(s: string): string {
  return ` ${senzaAccenti(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const contiene = (testo: string, parola: string) => testo.includes(normalizza(parola));

export function riconosciSquadre(testo: string, voci: VoceSquadre[]): string[] {
  const t = normalizza(testo);
  return voci
    // "senza" vale anche come inizio di parola: "maschil" esclude maschile e maschili.
    .filter((v) => v.parole.some((p) => contiene(t, p)) && !(v.senza ?? []).some((p) => t.includes(` ${normalizza(p).trim()}`)))
    .flatMap((v) => v.squadre);
}

/** Un articolo entra nella rassegna se parla di pallavolo e di Parma (o di una squadra di Parma). */
export function pertinente(a: Pick<ArticoloGrezzo, 'titolo' | 'testo' | 'testata'>, voci: VoceSquadre[]): boolean {
  const testata = TESTATE.find((t) => t.id === a.testata);
  const testo = `${a.titolo} ${a.testo}`;
  const volley = testata?.soloVolley || VOLLEY.test(normalizza(testo));
  if (!volley) return false;
  if (testata?.locale) return true;
  const t = normalizza(testo);
  return riconosciSquadre(testo, voci).length > 0 || CONTESTO_PARMA.some((p) => contiene(t, p));
}

/** Sigle e nomi con una grafia fissa nei titoli rimessi in minuscolo. */
const GRAFIE: Record<string, string> = {
  fipav: 'FIPAV', csen: 'CSEN', cus: 'CUS', tg: 'TG', cev: 'CEV', asd: 'ASD', palaraschi: 'PalaRaschi', italia: 'Italia',
  superlega: 'SuperLega', supercoppa: 'Supercoppa', velasco: 'Velasco',
};

/**
 * Titolo tutto in maiuscolo (es. i servizi di 12 TV Parma) in forma normale: minuscolo, iniziale maiuscola e dopo il
 * punto, maiuscole restituite a nomi di squadre e luoghi, sigle e categorie (A2, B2, U17…). I titoli già in forma normale
 * restano come sono.
 */
export function titoloLeggibile(titolo: string, nomiPropri: string[]): string {
  if (/\p{Ll}/u.test(titolo)) return titolo;
  let t = titolo.toLowerCase();
  const maiuscola = (p: string) => p.replace(/(^|[\s'’(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  const escape = (p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const nome of [...nomiPropri].sort((a, b) => b.length - a.length)) {
    const n = nome.toLowerCase().trim();
    if (!n) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(n)})(?=$|[^\\p{L}\\p{N}])`, 'gu');
    t = t.replace(re, (_, a: string, b: string) => a + maiuscola(b));
  }
  t = t
    .replace(/\p{L}+/gu, (p) => GRAFIE[p.toLowerCase()] ?? p)
    .replace(/\b(serie|under) ([a-d]\d?|\d\d)\b/g, (_, a: string, b: string) => `${a} ${b.toUpperCase()}`)
    .replace(/\b([a-d][1-3]|u\d\d)\b/g, (p) => p.toUpperCase());
  return t
    .replace(/^(\P{L}*)(\p{L})/u, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/([.!?] +)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Data e ora locali italiane di un istante ISO. */
export function dataOraRoma(iso: string): { data: string; ora: string } {
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { data: `${parti.year}-${parti.month}-${parti.day}`, ora: `${parti.hour}:${parti.minute}` };
}

/** Mesi (AAAA-MM) da luglio dell'anno di inizio stagione fino a quello corrente. */
export function mesiStagione(anno: number, oggi = new Date()): string[] {
  const mesi: string[] = [];
  const fine = oggi.getFullYear() * 12 + oggi.getMonth();
  for (let m = anno * 12 + 6; m <= fine; m++) mesi.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`);
  return mesi;
}

/** Un mese si considera chiuso qualche giorno dopo la fine: i siti a volte indicizzano in ritardo. */
function meseConcluso(mese: string, ora: number): boolean {
  const [a, m] = mese.split('-').map(Number);
  return Date.UTC(a, m, 1) + 3 * GIORNO < ora;
}

export function urlRicerca(base: string, ricerca: string, mese: string, pagina = 1): string {
  const p = pagina > 1 ? `/page/${pagina}/` : '/';
  return `${base}${p}?s=${encodeURIComponent(ricerca)}&m=${mese.replace('-', '')}&feed=rss2`;
}

function daVoce(v: VoceFeed, testata: string): ArticoloGrezzo | null {
  if (!v.pubblicato) return null;
  return { titolo: v.titolo, url: v.url, testata, pubblicato: v.pubblicato, testo: testoSemplice(v.descrizione).slice(0, TESTO_MAX) };
}

async function scaricaTestata(
  t: TestataFeed,
  mesi: string[],
  completate: Set<string>,
  ora: number,
): Promise<{ articoli: ArticoloGrezzo[]; concluse: string[] }> {
  const articoli: ArticoloGrezzo[] = [];
  const concluse: string[] = [];
  if (t.tipo === 'feed') {
    for (const v of parseFeed(await scarica(t.feed!, { maxEtaCacheMs: 2 * ORA }))) {
      const a = daVoce(v, t.id);
      if (a) articoli.push(a);
    }
    return { articoli, concluse };
  }
  for (const ricerca of t.ricerche ?? []) {
    for (const mese of mesi) {
      const chiave = `${t.id}|${ricerca}|${mese}`;
      if (completate.has(chiave)) continue;
      let perPagina = 0;
      for (let pagina = 1; pagina <= PAGINE_MAX; pagina++) {
        let voci: VoceFeed[];
        try {
          voci = parseFeed(await scarica(urlRicerca(t.url, ricerca, mese, pagina), { maxEtaCacheMs: 2 * ORA }));
        } catch (e) {
          // WordPress risponde 404 quando la ricerca non trova nulla e alla pagina dopo l'ultima.
          if (e instanceof Error && /HTTP 404/.test(e.message)) break;
          throw e;
        }
        for (const v of voci) {
          const a = daVoce(v, t.id);
          if (a) articoli.push(a);
        }
        // Una pagina non piena è l'ultima. Le voci per pagina dipendono dal sito (10, 20…): fa fede la prima.
        perPagina ||= voci.length;
        if (voci.length < Math.max(perPagina, 10)) break;
      }
      if (meseConcluso(mese, ora)) concluse.push(chiave);
    }
  }
  return { articoli, concluse };
}

async function leggiSnapshot(): Promise<SnapshotRassegna | null> {
  try {
    return JSON.parse(await readFile(FILE_SNAPSHOT, 'utf8')) as SnapshotRassegna;
  } catch {
    return null;
  }
}

/** Unisce gli articoli per URL e scarta i doppioni: stesso titolo dalla stessa testata a pochi giorni di distanza. */
export function unisci(articoli: ArticoloGrezzo[]): ArticoloGrezzo[] {
  const perUrl = new Map<string, ArticoloGrezzo>();
  for (const a of articoli) perUrl.set(a.url, { ...perUrl.get(a.url), ...a });
  const ordinati = [...perUrl.values()].sort((a, b) => a.pubblicato.localeCompare(b.pubblicato));
  const tenuti: ArticoloGrezzo[] = [];
  for (const a of ordinati) {
    const doppio = tenuti.some(
      (b) =>
        b.testata === a.testata &&
        normalizza(b.titolo) === normalizza(a.titolo) &&
        Date.parse(a.pubblicato) - Date.parse(b.pubblicato) < 3 * GIORNO,
    );
    if (!doppio) tenuti.push(a);
  }
  return tenuti.sort((a, b) => b.pubblicato.localeCompare(a.pubblicato));
}

const idArticolo = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 12);

/** Squadre di Parma che corrispondono a un nome di squadra o di società. */
function risolviSquadre(nomi: string[], squadre: Squadra[]): string[] {
  const chiavi = new Set(nomi.map((n) => chiaveSquadra(n)));
  return squadre
    .filter((s) => s.parmense && (chiavi.has(chiaveSquadra(s.nome)) || (s.societa && chiavi.has(chiaveSquadra(s.societa)))))
    .map((s) => s.id);
}

function testataManuale(nome: string, url: string): Testata {
  const id = chiaveSquadra(nome).toLowerCase().replace(/\s+/g, '-');
  return { id, nome, url: new URL(url).origin };
}

/** Rassegna pubblicata: articoli pertinenti, squadre riconosciute, articoli manuali ed esclusioni applicati. */
export function costruisciRassegna(
  grezzi: ArticoloGrezzo[],
  config: ConfigRassegna,
  squadre: Squadra[],
  stagione: string,
  inizio: string,
): Omit<Rassegna, 'aggiornataIl'> {
  const esclusi = new Set(config.escludi);
  // Nomi da rimettere in maiuscolo nei titoli: parole chiave delle squadre, luoghi della provincia, testate.
  const nomiPropri = [...config.squadre.flatMap((v) => v.parole), ...CONTESTO_PARMA, 'parma', ...TESTATE.map((t) => t.nome)];
  const testate = new Map<string, Testata>(TESTATE.map(({ id, nome, url }) => [id, { id, nome, url }]));
  const articoli: Articolo[] = [];

  for (const a of grezzi) {
    if (esclusi.has(a.url) || !pertinente(a, config.squadre)) continue;
    const { data, ora } = dataOraRoma(a.pubblicato);
    if (data < inizio) continue;
    articoli.push({
      id: idArticolo(a.url),
      titolo: titoloLeggibile(a.titolo, nomiPropri),
      url: a.url,
      testata: a.testata,
      data,
      ora,
      // Ripulito anche qui: vale per gli articoli salvati prima di una nuova regola di pulizia.
      estratto: estratto(testoSemplice(a.testo)),
      // I servizi dei TG di 12 TV Parma stanno sotto /puntata/: sono video.
      ...(a.testata === '12tvparma' && a.url.includes('/puntata/') ? { video: true } : {}),
      squadre: risolviSquadre(riconosciSquadre(`${a.titolo} ${a.testo}`, config.squadre), squadre),
    });
  }

  for (const m of config.articoli) {
    if (esclusi.has(m.url) || articoli.some((a) => a.url === m.url)) continue;
    const t = [...testate.values()].find((x) => x.nome === m.testata) ?? testataManuale(m.testata, m.url);
    testate.set(t.id, t);
    articoli.push({
      id: idArticolo(m.url),
      titolo: m.titolo,
      url: m.url,
      testata: t.id,
      data: m.data,
      ora: null,
      estratto: null,
      squadre: risolviSquadre(m.squadre ?? riconosciSquadre(m.titolo, config.squadre), squadre),
    });
  }

  articoli.sort((a, b) => b.data.localeCompare(a.data) || (b.ora ?? '').localeCompare(a.ora ?? ''));
  const usate = new Set(articoli.map((a) => a.testata));
  return { stagione, testate: [...testate.values()].filter((t) => usate.has(t.id) || TESTATE.some((x) => x.id === t.id)), articoli };
}

/**
 * Aggiorna data/fonti/rassegna.json (con `scaricare`) e restituisce la rassegna da pubblicare.
 * Una testata che non risponde non blocca le altre: i suoi articoli già letti restano.
 */
export async function aggiornaRassegna(
  squadre: Squadra[],
  opz: { scaricare: boolean; log: (m: string) => void; scriviSnapshot: (s: SnapshotRassegna) => Promise<void> },
): Promise<{ rassegna: Omit<Rassegna, 'aggiornataIl'>; errori: string[] }> {
  const config = await caricaConfigRassegna();
  const anno = stagioneCorrente();
  const stagione = etichettaStagione(anno);
  const inizio = `${anno}-07-01`;
  const errori: string[] = [];

  let snap = await leggiSnapshot();
  if (snap?.stagione !== stagione) snap = { aggiornatoIl: '', stagione, completate: [], articoli: [] };

  if (opz.scaricare) {
    const ora = Date.now();
    const mesi = mesiStagione(anno);
    const completate = new Set(snap.completate);
    const nuovi: ArticoloGrezzo[] = [];
    for (const t of TESTATE) {
      try {
        const r = await scaricaTestata(t, mesi, completate, ora);
        const tenuti = r.articoli.filter((a) => a.pubblicato >= inizio && pertinente(a, config.squadre));
        nuovi.push(...tenuti);
        r.concluse.forEach((c) => completate.add(c));
        opz.log(`Rassegna ${t.nome}: ${r.articoli.length} voci lette, ${tenuti.length} pertinenti`);
      } catch (e) {
        const msg = `Rassegna ${t.nome}: ${(e as Error).message}`;
        errori.push(msg);
        opz.log(msg);
      }
    }
    const articoli = unisci([...snap.articoli, ...nuovi]);
    const prima = JSON.stringify({ c: snap.completate, a: snap.articoli });
    snap = { aggiornatoIl: new Date(ora).toISOString(), stagione, completate: [...completate].sort(), articoli };
    if (JSON.stringify({ c: snap.completate, a: snap.articoli }) !== prima) await opz.scriviSnapshot(snap);
  }

  const rassegna = costruisciRassegna(snap.articoli, config, squadre, stagione, inizio);
  opz.log(`Rassegna stampa: ${rassegna.articoli.length} articoli`);
  return { rassegna, errori };
}

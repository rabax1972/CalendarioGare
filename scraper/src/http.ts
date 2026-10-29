import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, INTERVALLO_RICHIESTE_MS, USER_AGENT } from './config.ts';

interface VoceCache {
  url: string;
  etag?: string;
  lastModified?: string;
  scaricatoIl: number;
  corpo: string;
}

export interface OpzioniFetch {
  /** Se la copia in cache è più giovane di così, non si contatta il server. */
  maxEtaCacheMs?: number;
  tentativi?: number;
  timeoutMs?: number;
}

const ultimaRichiesta = new Map<string, number>();
let richiesteEffettuate = 0;
let risposteDaCache = 0;

const ETA_CACHE_DEFAULT = Number(process.env.SCRAPER_CACHE_MINUTI ?? 10) * 60_000;

export function statisticheHttp() {
  return { richiesteEffettuate, risposteDaCache };
}

function fileCache(url: string) {
  return path.join(CACHE_DIR, 'http', createHash('sha1').update(url).digest('hex') + '.json');
}

async function leggiCache(url: string): Promise<VoceCache | null> {
  try {
    return JSON.parse(await readFile(fileCache(url), 'utf8')) as VoceCache;
  } catch {
    return null;
  }
}

async function scriviCache(voce: VoceCache) {
  const f = fileCache(voce.url);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(voce));
}

async function attendiTurno(host: string) {
  const ultima = ultimaRichiesta.get(host) ?? 0;
  const attesa = ultima + INTERVALLO_RICHIESTE_MS - Date.now();
  if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));
  ultimaRichiesta.set(host, Date.now());
}

/**
 * GET con User-Agent dichiarato, una richiesta alla volta per host,
 * cache su disco e richieste condizionali (ETag / Last-Modified).
 */
export async function scarica(url: string, opz: OpzioniFetch = {}): Promise<string> {
  const { maxEtaCacheMs = ETA_CACHE_DEFAULT, tentativi = 3, timeoutMs = 30_000 } = opz;
  const cache = await leggiCache(url);
  if (cache && Date.now() - cache.scaricatoIl < maxEtaCacheMs) {
    risposteDaCache++;
    return cache.corpo;
  }

  const host = new URL(url).host;
  let ultimoErrore: unknown;
  for (let i = 1; i <= tentativi; i++) {
    await attendiTurno(host);
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'it-IT,it;q=0.9',
    };
    if (cache?.etag) headers['If-None-Match'] = cache.etag;
    if (cache?.lastModified) headers['If-Modified-Since'] = cache.lastModified;
    try {
      richiesteEffettuate++;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 304 && cache) {
        risposteDaCache++;
        await scriviCache({ ...cache, scaricatoIl: Date.now() });
        return cache.corpo;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
      const corpo = await res.text();
      await scriviCache({
        url,
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
        scaricatoIl: Date.now(),
        corpo,
      });
      return corpo;
    } catch (e) {
      ultimoErrore = e;
      // 4xx diversi da 429: inutile riprovare.
      if (e instanceof Error && /HTTP 4(?!29)\d\d/.test(e.message)) break;
      if (i < tentativi) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw ultimoErrore instanceof Error ? ultimoErrore : new Error(String(ultimoErrore));
}

/** GET di un'immagine (stesse regole di cortesia di `scarica`, senza cache testuale). */
export async function scaricaImmagine(url: string, maxByte = 3_000_000): Promise<Buffer> {
  await attendiTurno(new URL(url).host);
  richiesteEffettuate++;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
  const tipo = res.headers.get('content-type') ?? '';
  if (!tipo.startsWith('image/')) throw new Error(`Non è un'immagine (${tipo || 'tipo sconosciuto'}): ${url}`);
  const corpo = Buffer.from(await res.arrayBuffer());
  if (corpo.length > maxByte) throw new Error(`Immagine troppo grande (${corpo.length} byte): ${url}`);
  return corpo;
}

export async function scaricaJson<T>(url: string, opz?: OpzioniFetch): Promise<T> {
  const testo = await scarica(url, opz);
  try {
    return JSON.parse(testo) as T;
  } catch {
    throw new Error(`Risposta non JSON da ${url}`);
  }
}

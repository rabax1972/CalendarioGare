import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'data');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'fonti');
export const CACHE_DIR = path.join(ROOT, '.cache');

export const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ??
  'CalendarioGareParma/0.1 (+https://github.com/; progetto non commerciale, dati pallavolo Parma)';

/** Pausa minima tra due richieste allo stesso host. */
export const INTERVALLO_RICHIESTE_MS = 1200;

/** Ogni quanto rifare la scoperta completa dei gironi con squadre di Parma. */
export const TTL_SCOPERTA_MS = 24 * 60 * 60 * 1000;

/** Prefisso del codice affiliazione FIPAV delle società di Parma (08 = ER, 038 = Parma). */
export const PREFISSO_CODICE_PARMA = '08038';
export const PROVINCIA = 'PR';

export function stagioneCorrente(oggi = new Date()): number {
  // La stagione sportiva parte a luglio.
  return oggi.getMonth() >= 6 ? oggi.getFullYear() : oggi.getFullYear() - 1;
}

export function etichettaStagione(anno: number): string {
  return `${anno}/${String((anno + 1) % 100).padStart(2, '0')}`;
}

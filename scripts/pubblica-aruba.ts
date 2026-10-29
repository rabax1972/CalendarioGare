// Pubblicazione automatica su Aruba senza FTP, come in Classifiche: build dell'app, confronto con le impronte dei file che il
// server serve adesso e invio a pezzi di uno zip con quelli nuovi o cambiati, che il server estrae in
// mdb-database/calendariogare/sito/ (web/public/api/_pubblicazione.php). La lancia la GitHub Action dopo lo scraping.
//
//   npm run pubblica:aruba                  build e pubblicazione (serve ARUBA_CHIAVE: nel .env o nei secrets di GitHub)
//   npm run pubblica:aruba -- --no-build    usa la build già in dist/
//   npm run pubblica:aruba -- --svuota      dopo aver caricato tutto dist/ con FileZilla: toglie le copie aggiornate dal server
//
// api/ e web.config non passano mai di qui: si caricano a mano con FileZilla.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createZip, type ZipEntry } from './zip.ts';

const URL_SITO = process.env.ARUBA_URL ?? 'https://www.giacomorabaglia.com/calendariogare';
const API = `${URL_SITO}/api/index.php`;
const DIST = path.resolve('dist');
const USER_AGENT = 'CalendarioGareParma-pubblicazione';

if (existsSync('.env')) process.loadEnvFile('.env');
const chiave = process.env.ARUBA_CHIAVE?.trim();
if (!chiave) {
  console.warn('ARUBA_CHIAVE non impostata: pubblicazione su Aruba saltata.');
  process.exit(0);
}

async function api<T>(azione: string, corpo?: Buffer): Promise<T> {
  const res = await fetch(`${API}?a=${azione}`, {
    method: azione === 'sito-impronte' ? 'GET' : 'POST',
    headers: { 'X-Chiave': chiave!, 'User-Agent': USER_AGENT, ...(corpo ? { 'Content-Type': 'application/octet-stream' } : {}) },
    body: corpo ? new Uint8Array(corpo) : undefined,
  });
  const dati = (await res.json().catch(() => ({}))) as T & { errore?: string };
  if (!res.ok) {
    const suggerimento = res.status === 404 ? ' (api/ non caricata sul sito o chiave diversa da chiave_pubblicazione)' : '';
    throw new Error(`${azione}: HTTP ${res.status}${dati.errore ? ` – ${dati.errore}` : ''}${suggerimento}`);
  }
  return dati;
}

/** Impronta sha1 (come sha1_file del PHP) di ogni file della cartella, con percorsi relativi separati da "/". */
function impronte(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const pieno = path.join(dir, f.name);
    if (f.isDirectory()) impronte(pieno, base, out);
    else out[path.relative(base, pieno).split(path.sep).join('/')] = createHash('sha1').update(readFileSync(pieno)).digest('hex');
  }
  return out;
}

if (process.argv.includes('--svuota')) {
  const r = await api<{ eliminati: number }>('sito-svuota');
  console.log(`Tolte dal server ${r.eliminati} copie aggiornate: ora il sito serve i file caricati con FileZilla.`);
  process.exit(0);
}

if (!process.argv.includes('--no-build')) {
  // Percorsi relativi (BASE_PATH vuoto): l'app funziona nella cartella /calendariogare.
  const { BASE_PATH: _, ...env } = process.env;
  execSync('npm run build', { stdio: 'inherit', env });
}

const pubblicabile = (f: string) => !f.startsWith('api/') && f !== 'web.config';
const locali = impronte(DIST);
const remoti = await api<{ file: Record<string, string>; pezzo: number }>('sito-impronte');
const cambiati = Object.keys(locali).filter((f) => pubblicabile(f) && remoti.file[f] !== locali[f]);
console.log(`${Object.keys(locali).length} file nella build, ${cambiati.length} nuovi o cambiati rispetto al sito.`);
if (!cambiati.length) process.exit(0);

// Prima i file referenziati, per ultimi index.html e sw.js: il server li estrae in ordine, così chi apre l'app durante
// l'estrazione non trova mai una pagina che punta a file non ancora arrivati.
const ultimi = ['sw.js', 'index.html'];
cambiati.sort((a, b) => ultimi.indexOf(a) - ultimi.indexOf(b));
const voci: ZipEntry[] = cambiati.map((f) => ({ name: f, data: readFileSync(path.join(DIST, ...f.split('/'))) }));
const zip = createZip(voci);
const id = createHash('sha256').update(zip).digest('hex');
const dimensione = Math.min(remoti.pezzo, 4 * 1024 * 1024);
const parti = Math.ceil(zip.length / dimensione);
console.log(`Zip di ${(zip.length / 1048576).toFixed(2)} MB in ${parti} ${parti === 1 ? 'pezzo' : 'pezzi'}…`);
let esito: { file?: number } = {};
for (let n = 1; n <= parti; n++) {
  const pezzo = zip.subarray((n - 1) * dimensione, n * dimensione);
  for (let tentativo = 1; ; tentativo++) {
    try {
      esito = await api(`sito-carica&id=${id}&parte=${n}&parti=${parti}`, pezzo);
      break;
    } catch (e) {
      if (tentativo === 3) throw e;
      console.warn(`Pezzo ${n}: ${(e as Error).message}, riprovo…`);
      await new Promise((r) => setTimeout(r, 5000 * tentativo));
    }
  }
}
console.log(`Pubblicati ${esito.file ?? 0} file su ${URL_SITO}/`);

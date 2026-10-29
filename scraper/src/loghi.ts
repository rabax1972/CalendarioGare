import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Campionato, Squadra } from '../../shared/model.ts';
import { DATA_DIR } from './config.ts';
import { scarica, scaricaImmagine } from './http.ts';
import { abbina } from './normalize.ts';
import { SERIE_LVF, parseClubLvf, urlCalendarioLvf, urlLogoLvf, type ClubLvf } from './sources/lvf.ts';

// Loghi delle squadre: scaricati una volta, ridotti a 96×96 WebP e serviti dall'app da data/loghi/.
// Fonti consentite: CSEN (pagina Squadre), feed federale myvolley, Lega Volley Femminile per A1/A2 F.
// Il portale regionale è escluso: robots.txt vieta /mngarea/, la cartella dei loghi.

export const DIR_LOGHI = path.join(DATA_DIR, 'loghi');
const FILE_INDICE = path.join(DIR_LOGHI, 'indice.json');
/** Squadra → URL logo trovato per somiglianza di nome (LVF): serve anche a --solo-build, che non va in rete. */
const FILE_ABBINAMENTI = path.join(DIR_LOGHI, 'abbinamenti.json');
const RINNOVO_MS = 30 * 24 * 3600_000;
const RIPROVA_ERRORE_MS = 7 * 24 * 3600_000;
const LATO = 96;

interface VoceIndice {
  file: string | null;
  quando: number;
  errore?: string;
}

type Indice = Record<string, VoceIndice>;

/** Club LVF di un campionato (A1/A2 F), dalla pagina calendario tenuta in cache una settimana. */
export async function clubLvf(c: Campionato): Promise<ClubLvf[]> {
  const url = urlCalendarioLvf(SERIE_LVF[c.id], c.stagione.slice(0, 4));
  return parseClubLvf(await scarica(url, { maxEtaCacheMs: RIPROVA_ERRORE_MS }));
}

async function loghiLvf(
  squadre: Squadra[],
  campionati: Campionato[],
  candidati: Map<string, string | false>,
  abbinati: Record<string, string>,
  log: (m: string) => void,
) {
  for (const c of campionati.filter((x) => SERIE_LVF[x.id])) {
    const daAbbinare = squadre.filter((s) => s.campionati.includes(c.id) && !candidati.has(s.id));
    if (!daAbbinare.length) continue;
    try {
      const club = await clubLvf(c);
      let n = 0;
      for (const s of daAbbinare) {
        const trovato = abbina(s.nome, club);
        if (!trovato) continue;
        abbinati[s.id] = urlLogoLvf(trovato.id);
        n++;
      }
      log(`Loghi LVF ${c.nomeBreve}: ${n}/${daAbbinare.length} squadre abbinate`);
    } catch (e) {
      log(`Loghi LVF ${c.nomeBreve} non disponibili: ${(e as Error).message}`);
    }
  }
}

async function leggiJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

const ordina = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** Riduce l'immagine a un quadrato trasparente di 96 px; il nome del file è l'hash del risultato. */
export async function normalizzaLogo(dati: Buffer): Promise<{ nome: string; webp: Buffer }> {
  const img = sharp(dati, { limitInputPixels: 25_000_000 });
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) throw new Error('immagine troppo piccola');
  const webp = await img
    .resize(LATO, LATO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();
  return { nome: createHash('sha1').update(webp).digest('hex').slice(0, 12) + '.webp', webp };
}

/**
 * Assegna `logo` alle squadre. Con `scaricare = false` (es. --solo-build) usa solo i loghi già presenti.
 * Restituisce quante squadre hanno un logo.
 */
export async function aggiornaLoghi(
  squadre: Squadra[],
  campionati: Campionato[],
  candidati: Map<string, string | false>,
  opz: { scaricare: boolean; log: (m: string) => void },
): Promise<number> {
  await mkdir(DIR_LOGHI, { recursive: true });
  const indice = (await leggiJson<Indice>(FILE_INDICE)) ?? {};
  const precedenti = (await leggiJson<Record<string, string>>(FILE_ABBINAMENTI)) ?? {};
  const abbinati: Record<string, string> = {};
  if (opz.scaricare) await loghiLvf(squadre, campionati, candidati, abbinati, opz.log);
  else for (const s of squadre) if (precedenti[s.id] && !candidati.has(s.id)) abbinati[s.id] = precedenti[s.id];
  for (const [id, url] of Object.entries(abbinati)) candidati.set(id, url);

  let scaricati = 0;
  let falliti = 0;
  for (const s of squadre) {
    const url = candidati.get(s.id);
    if (!url) continue;
    let voce = indice[url];
    const scaduto = !voce || Date.now() - voce.quando > (voce.file ? RINNOVO_MS : RIPROVA_ERRORE_MS);
    if (scaduto && opz.scaricare) {
      try {
        const { nome, webp } = await normalizzaLogo(await scaricaImmagine(url));
        await writeFile(path.join(DIR_LOGHI, nome), webp);
        voce = indice[url] = { file: nome, quando: Date.now() };
        scaricati++;
      } catch (e) {
        // Un logo mancante non è un errore della fonte: si riprova tra qualche giorno e intanto resta il monogramma.
        voce = indice[url] = { file: voce?.file ?? null, quando: Date.now(), errore: (e as Error).message };
        falliti++;
      }
    }
    if (voce?.file) s.logo = `loghi/${voce.file}`;
  }

  // Togli i file che nessuna squadra usa più.
  const usati = new Set(squadre.map((s) => s.logo?.slice('loghi/'.length)).filter(Boolean));
  for (const f of await readdir(DIR_LOGHI)) {
    if (f.endsWith('.webp') && !usati.has(f)) await rm(path.join(DIR_LOGHI, f));
  }
  await writeFile(FILE_INDICE, JSON.stringify(ordina(indice), null, 1) + '\n');
  await writeFile(FILE_ABBINAMENTI, JSON.stringify(ordina(abbinati), null, 1) + '\n');

  const conLogo = squadre.filter((s) => s.logo).length;
  opz.log(`Loghi: ${conLogo} squadre con logo (${scaricati} scaricati ora${falliti ? `, ${falliti} non disponibili` : ''})`);
  return conLogo;
}

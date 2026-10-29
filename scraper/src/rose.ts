import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Atleta, Campionato, Rosa, Squadra } from '../../shared/model.ts';
import { DATA_DIR } from './config.ts';
import { scarica } from './http.ts';
import { clubLvf } from './loghi.ts';
import { abbina, chiaveSquadra } from './normalize.ts';
import { CSEN_CAMPIONATO_ID, URL_SQUADRE_CSEN, parseRosaCsen, parseSquadreCsen } from './sources/csen.ts';
import { SERIE_LVF, parseNascitaLvf, parseRosaLvf } from './sources/lvf.ts';

// Rose delle squadre di Parma, dove la fonte le pubblica (CSEN, Lega Volley Femminile).
// Dati personali: si tengono solo nome, numero e ruolo; la foto resta sul sito della fonte (link, non copia)
// e non si mostra mai per i minorenni o quando l'età non è verificabile. Rimozioni su richiesta: data/privacy.json.

const FILE_ROSE = path.join(DATA_DIR, 'rose.json');
const FILE_PRIVACY = path.join(DATA_DIR, 'privacy.json');
const GIORNO = 24 * 3600_000;

export interface FilePrivacy {
  /** Contatto mostrato nell'app per chiedere la rimozione dei propri dati. */
  contatto: string;
  /** Squadre (nome o id) di cui non pubblicare la rosa. */
  nascondiRose: string[];
  /** Persone da togliere dalle rose ("Cognome Nome" o "Nome Cognome"). */
  nascondiAtleti: string[];
  /** Persone di cui non mostrare la foto. */
  nascondiFoto: string[];
}

const PRIVACY_VUOTA: FilePrivacy = { contatto: '', nascondiRose: [], nascondiAtleti: [], nascondiFoto: [] };

export async function caricaPrivacy(): Promise<FilePrivacy> {
  try {
    return { ...PRIVACY_VUOTA, ...JSON.parse(await readFile(FILE_PRIVACY, 'utf8')) };
  } catch {
    return PRIVACY_VUOTA;
  }
}

/** Età compiuta alla data `oggi` (YYYY-MM-DD). */
export function eta(nascita: string, oggi: string): number {
  const [ay, am, ag] = nascita.split('-').map(Number);
  const [by, bm, bg] = oggi.split('-').map(Number);
  return by - ay - (bm < am || (bm === am && bg < ag) ? 1 : 0);
}

const chiavePersona = (nome: string, cognome: string) => [nome, cognome].map((x) => chiaveSquadra(x)).sort().join(' ');
const chiaveDaTesto = (s: string) => chiaveSquadra(s).split(' ').sort().join(' ');

interface AtletaConNascita extends Atleta {
  /** null = data di nascita non disponibile alla fonte. Solo per decidere sulla foto: non viene pubblicata. */
  nascita?: string | null;
}

/** Applica tutela dei minori ed esclusioni: è l'unico punto da cui passano le rose prima di essere scritte. */
export function filtraRosa(
  atleti: AtletaConNascita[],
  privacy: FilePrivacy,
  oggi: string,
  richiedeEta: boolean,
): { atleti: Atleta[]; fotoNascoste: number } {
  const via = new Set(privacy.nascondiAtleti.map(chiaveDaTesto));
  const senzaFoto = new Set(privacy.nascondiFoto.map(chiaveDaTesto));
  let fotoNascoste = 0;
  const risultato = atleti
    .filter((a) => !via.has(chiavePersona(a.nome, a.cognome)))
    .map(({ nascita, ...a }) => {
      const maggiorenne = nascita ? eta(nascita, oggi) >= 18 : !richiedeEta;
      const mostra = a.foto && maggiorenne && !senzaFoto.has(chiavePersona(a.nome, a.cognome));
      if (a.foto && !mostra) fotoNascoste++;
      return { ...a, foto: mostra ? a.foto : null };
    })
    .sort((x, y) => (Number(x.numero) || 999) - (Number(y.numero) || 999) || x.cognome.localeCompare(y.cognome, 'it'));
  return { atleti: risultato, fotoNascoste };
}

async function roseCsen(squadre: Squadra[], log: (m: string) => void) {
  const daFare = squadre.filter((s) => s.parmense && s.campionati.includes(CSEN_CAMPIONATO_ID));
  if (!daFare.length) return [];
  const elenco = parseSquadreCsen(await scarica(URL_SQUADRE_CSEN, { maxEtaCacheMs: 3 * GIORNO }));
  const rose: { squadra: Squadra; fonteUrl: string; atleti: AtletaConNascita[] }[] = [];
  for (const s of daFare) {
    const voce = abbina(s.nome, elenco);
    if (!voce) continue;
    const atleti = parseRosaCsen(await scarica(voce.url, { maxEtaCacheMs: 3 * GIORNO }));
    if (atleti.length) rose.push({ squadra: s, fonteUrl: voce.url, atleti });
  }
  log(`Rose CSEN: ${rose.length}/${daFare.length} squadre`);
  return rose;
}

async function roseLvf(squadre: Squadra[], campionati: Campionato[], log: (m: string) => void) {
  const rose: { squadra: Squadra; fonteUrl: string; atleti: AtletaConNascita[] }[] = [];
  for (const c of campionati.filter((x) => SERIE_LVF[x.id])) {
    const daFare = squadre.filter((s) => s.parmense && s.campionati.includes(c.id));
    if (!daFare.length) continue;
    const club = await clubLvf(c);
    for (const s of daFare) {
      const cl = abbina(s.nome, club);
      if (!cl?.url) continue;
      const fonteUrl = `${cl.url}roster/`;
      const atleti: AtletaConNascita[] = [];
      for (const a of parseRosaLvf(await scarica(fonteUrl, { maxEtaCacheMs: 3 * GIORNO }))) {
        let nascita: string | null = null;
        if (a.profilo && a.foto) {
          // La data di nascita serve solo a decidere se mostrare la foto; il profilo cambia di rado.
          nascita = await scarica(a.profilo, { maxEtaCacheMs: 14 * GIORNO })
            .then(parseNascitaLvf)
            .catch(() => null);
        }
        atleti.push({ numero: a.numero, nome: a.nome, cognome: a.cognome, ruolo: a.ruolo, foto: a.foto, nascita });
      }
      if (atleti.length) rose.push({ squadra: s, fonteUrl, atleti });
    }
  }
  if (rose.length) log(`Rose LVF: ${rose.map((r) => r.squadra.nome).join(', ')}`);
  return rose;
}

function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

/**
 * Scrive data/rose.json. Con `scaricare = false` riapplica solo data/privacy.json alle rose già presenti.
 * La data "aggiornata" cambia solo se la rosa cambia, per non produrre commit a ogni esecuzione.
 */
export async function aggiornaRose(
  squadre: Squadra[],
  campionati: Campionato[],
  opz: { scaricare: boolean; log: (m: string) => void },
): Promise<Rosa[]> {
  const privacy = await caricaPrivacy();
  const precedenti: Rosa[] = JSON.parse(await readFile(FILE_ROSE, 'utf8').catch(() => '[]'));
  const prima = new Map(precedenti.map((r) => [r.squadraId, r]));
  const escluse = new Set(privacy.nascondiRose.map((x) => chiaveSquadra(x)));
  const esclusa = (s: Squadra | undefined, id: string) => escluse.has(chiaveSquadra(id)) || (s && escluse.has(chiaveSquadra(s.nome)));
  const oggi = oggiRoma();
  const perId = new Map(squadre.map((s) => [s.id, s]));

  let rose: Rosa[];
  if (!opz.scaricare) {
    rose = precedenti
      .filter((r) => perId.has(r.squadraId) && !esclusa(perId.get(r.squadraId), r.squadraId))
      .map((r) => {
        const f = filtraRosa(r.atleti, privacy, oggi, false);
        return { ...r, atleti: f.atleti, fotoNascoste: r.fotoNascoste + f.fotoNascoste };
      });
  } else {
    const grezze = [
      ...(await roseCsen(squadre, opz.log).catch((e) => (opz.log(`Rose CSEN non disponibili: ${e.message}`), []))),
      ...(await roseLvf(squadre, campionati, opz.log).catch((e) => (opz.log(`Rose LVF non disponibili: ${e.message}`), []))),
    ];
    rose = grezze
      .filter((g) => !esclusa(g.squadra, g.squadra.id))
      .map((g) => {
        // CSEN è un torneo amatoriale per adulti e non pubblica date di nascita: lì l'età non è richiesta.
        const f = filtraRosa(g.atleti, privacy, oggi, g.fonteUrl.includes('legavolleyfemminile'));
        const vecchia = prima.get(g.squadra.id);
        const uguale = vecchia && JSON.stringify(vecchia.atleti) === JSON.stringify(f.atleti);
        return {
          squadraId: g.squadra.id,
          fonte: g.fonteUrl.includes('legavolleyfemminile') ? 'Lega Volley Femminile' : 'CSEN Parma',
          fonteUrl: g.fonteUrl,
          aggiornata: uguale ? vecchia.aggiornata : oggi,
          atleti: f.atleti,
          fotoNascoste: f.fotoNascoste,
        };
      });
  }
  rose.sort((a, b) => a.squadraId.localeCompare(b.squadraId));
  await writeFile(FILE_ROSE, JSON.stringify(rose) + '\n');
  const atleti = rose.reduce((n, r) => n + r.atleti.length, 0);
  const nascoste = rose.reduce((n, r) => n + r.fotoNascoste, 0);
  opz.log(`Rose: ${rose.length} squadre, ${atleti} atleti, ${nascoste} foto non mostrate (minori/età non verificabile/richiesta)`);
  return rose;
}

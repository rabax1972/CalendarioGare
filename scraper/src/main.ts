import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Classifica, Meta, Partita, Rassegna, StatoFonte, ZoneClassifica } from '../../shared/model.ts';
import { caricaConfigurazione } from './alias.ts';
import { applicaVariazioni, costruisci, creaRiconoscitore } from './build.ts';
import { DATA_DIR, SNAPSHOT_DIR, etichettaStagione, stagioneCorrente } from './config.ts';
import { statisticheHttp } from './http.ts';
import { aggiornaLoghi } from './loghi.ts';
import { aggiornaRassegna } from './rassegna.ts';
import { aggiornaRose, caricaPrivacy } from './rose.ts';
import { fonteCrer } from './sources/crer.ts';
import { fonteCsen } from './sources/csen.ts';
import { campionatiSoloLink, fonteFipavParma } from './sources/fipavParma.ts';
import { fonteMyvolley } from './sources/myvolley.ts';
import type { Fonte, Snapshot } from './types.ts';

// Prima le fonti provinciali: servono a riconoscere le squadre di Parma in quelle regionali e nazionali.
const FONTI: Fonte[] = [fonteCsen, fonteFipavParma, fonteCrer, fonteMyvolley];

const args = process.argv.slice(2);
const soloBuild = args.includes('--solo-build');
const soloFonte = args.find((a) => a.startsWith('--fonte='))?.split('=')[1];

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function leggiJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Scrittura atomica: un file a metà non deve mai finire nei dati pubblicati. */
async function scriviJson(file: string, dati: unknown, indent = 0) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(dati, null, indent) + '\n');
  await rename(tmp, file);
}

const fileSnapshot = (id: string) => path.join(SNAPSHOT_DIR, `${id}.json`);

/** Controlli di plausibilità: un sito che cambia struttura di solito produce "zero partite". */
function verifica(fonte: Fonte, nuovo: Snapshot, vecchio: Snapshot | null): string | null {
  if (nuovo.partite.length < fonte.minimoPartite) {
    return `solo ${nuovo.partite.length} partite (minimo atteso ${fonte.minimoPartite}): possibile cambio di struttura del sito`;
  }
  if (vecchio && vecchio.stagione === nuovo.stagione && vecchio.partite.length >= 20 && nuovo.partite.length < vecchio.partite.length / 3) {
    return `partite scese da ${vecchio.partite.length} a ${nuovo.partite.length}: risultato sospetto, mantengo i dati precedenti`;
  }
  const senzaSquadre = nuovo.partite.filter((p) => !p.casa.nome || !p.ospite.nome).length;
  if (senzaSquadre > 0) return `${senzaSquadre} partite senza nome squadra: parsing da verificare`;
  return null;
}

async function main() {
  const config = await caricaConfigurazione();
  const metaPrecedente = await leggiJson<Meta>(path.join(DATA_DIR, 'meta.json'));
  const statoPrecedente = new Map(metaPrecedente?.fonti.map((f) => [f.id, f]) ?? []);
  const snapshots = new Map<string, Snapshot>();
  for (const f of FONTI) {
    const s = await leggiJson<Snapshot>(fileSnapshot(f.id));
    if (s && f.abilitata) snapshots.set(f.id, s);
  }

  const stati: StatoFonte[] = [];
  const errori: string[] = [];

  for (const fonte of FONTI) {
    const prima = statoPrecedente.get(fonte.id);
    const stato: StatoFonte = {
      id: fonte.id,
      nome: fonte.nome,
      abilitata: fonte.abilitata,
      ok: fonte.abilitata ? (prima?.ok ?? false) : false,
      ultimoSuccesso: prima?.ultimoSuccesso ?? null,
      ultimoTentativo: prima?.ultimoTentativo ?? null,
      partite: snapshots.get(fonte.id)?.partite.length ?? 0,
      ...(prima?.errore ? { errore: prima.errore } : {}),
    };
    if (!fonte.abilitata) {
      stato.errore = 'Fonte disattivata: il sito non consente il riuso automatico dei dati';
      stati.push(stato);
      continue;
    }
    if (soloBuild || (soloFonte && soloFonte !== fonte.id)) {
      stati.push(stato);
      continue;
    }

    stato.ultimoTentativo = new Date().toISOString();
    try {
      // Il riconoscitore usa gli snapshot aggiornati delle fonti già eseguite.
      const parma = creaRiconoscitore([...snapshots.values()], config);
      const snap = await fonte.esegui({ isParma: parma.isParma, chiaveConfig: config.chiave, log });
      const vecchio = snapshots.get(fonte.id) ?? null;
      const problema = verifica(fonte, snap, vecchio);
      if (problema) throw new Error(problema);
      // Se il contenuto non è cambiato il file resta com'è: niente commit inutili a ogni esecuzione.
      const senzaOra = (s: Snapshot) => JSON.stringify({ ...s, aggiornatoIl: '' });
      if (!vecchio || senzaOra(vecchio) !== senzaOra(snap)) await scriviJson(fileSnapshot(fonte.id), snap);
      snapshots.set(fonte.id, snap);
      stato.ok = true;
      stato.ultimoSuccesso = snap.aggiornatoIl;
      stato.partite = snap.partite.length;
      delete stato.errore;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stato.ok = false;
      stato.errore = msg;
      errori.push(`${fonte.nome}: ${msg}`);
      log(`ERRORE ${fonte.id}: ${msg} — mantengo l'ultimo dato valido`);
    }
    stati.push(stato);
  }

  const elenco = [...snapshots.values()];
  const stagione = elenco.find((s) => s.stagione)?.stagione ?? etichettaStagione(stagioneCorrente());
  const extra = fonteFipavParma.abilitata ? [] : campionatiSoloLink(stagione);
  const precedenti = (await leggiJson<Partita[]>(path.join(DATA_DIR, 'partite.json'))) ?? [];
  const r = costruisci(elenco, config, extra, precedenti);
  applicaVariazioni(r.classifiche, (await leggiJson<Classifica[]>(path.join(DATA_DIR, 'classifiche.json'))) ?? []);
  // Zone delle classifiche (promozione, playoff, retrocessione): solo dove sono state indicate a mano.
  const zone = (await leggiJson<{ campionati: Record<string, ZoneClassifica> }>(path.join(DATA_DIR, 'zone-classifiche.json')))?.campionati ?? {};
  for (const c of r.campionati) if (zone[c.id]) c.zone = zone[c.id];
  try {
    await aggiornaLoghi(r.squadre, r.campionati, r.candidatiLogo, { scaricare: !soloBuild, log });
  } catch (e) {
    // I loghi sono un abbellimento: un problema qui non deve fermare l'aggiornamento delle gare.
    log(`Loghi non aggiornati: ${(e as Error).message}`);
  }
  try {
    await aggiornaRose(r.squadre, r.campionati, { scaricare: !soloBuild, log });
  } catch (e) {
    log(`Rose non aggiornate: ${(e as Error).message}`);
  }

  try {
    const { rassegna, errori: erroriRassegna } = await aggiornaRassegna(r.squadre, {
      scaricare: !soloBuild,
      log,
      scriviSnapshot: (s) => scriviJson(fileSnapshot('rassegna'), s),
    });
    // La data cambia solo se cambiano gli articoli, per non produrre commit a ogni esecuzione.
    const file = path.join(DATA_DIR, 'rassegna.json');
    const prima = await leggiJson<Rassegna>(file);
    const confronto = prima && JSON.stringify({ ...prima, aggiornataIl: undefined });
    if (confronto !== JSON.stringify({ ...rassegna, aggiornataIl: undefined })) {
      await scriviJson(file, { aggiornataIl: new Date().toISOString(), ...rassegna });
    }
    // Come per loghi e rose, un problema della rassegna non segna l'esecuzione come fallita.
    for (const e of erroriRassegna) console.warn(`::warning::${e}`);
  } catch (e) {
    log(`Rassegna stampa non aggiornata: ${(e as Error).message}`);
  }

  await scriviJson(path.join(DATA_DIR, 'campionati.json'), r.campionati, 1);
  await scriviJson(path.join(DATA_DIR, 'squadre.json'), r.squadre);
  await scriviJson(path.join(DATA_DIR, 'partite.json'), r.partite);
  await scriviJson(path.join(DATA_DIR, 'classifiche.json'), r.classifiche);
  const { contatto } = await caricaPrivacy();
  const meta: Meta = {
    generatoIl: new Date().toISOString(),
    stagione,
    fonti: stati,
    ...(contatto ? { contattoPrivacy: contatto } : {}),
  };
  await scriviJson(path.join(DATA_DIR, 'meta.json'), meta, 1);
  await writeFile(path.join(DATA_DIR, 'report-parma.md'), r.report + '\n');

  console.log('\n' + r.report);
  const http = statisticheHttp();
  log(
    `Scritti ${r.partite.length} partite, ${r.campionati.length} campionati, ${r.squadre.length} squadre, ` +
      `${r.classifiche.length} classifiche. Richieste HTTP: ${http.richiesteEffettuate} (da cache/304: ${http.risposteDaCache}).`,
  );

  if (errori.length) {
    for (const e of errori) console.error(`::error::${e}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config.ts';
import { chiaveSquadra, pulisciSpazi, separaProvincia } from './normalize.ts';

export interface VoceAlias {
  /** Nome con cui la squadra compare nell'app. */
  nome: string;
  /** Altri nomi con cui la squadra compare nelle fonti (maiuscole, accenti e punteggiatura non contano). */
  varianti?: string[];
  societa?: string;
  comune?: string;
  /** URL di un logo da usare al posto di quello della fonte, oppure false per non mostrarne nessuno. */
  logo?: string | false;
}

export interface FileAlias {
  squadre: VoceAlias[];
}

export interface FileWhitelist {
  /** Squadre da considerare di Parma anche se non riconosciute automaticamente. */
  squadre: string[];
  /** Prefissi di codice affiliazione FIPAV da considerare parmensi (oltre a 08038). */
  codiciSocieta: string[];
  /** Id società del portale regionale (numero nel logo "LogoS<id>"). */
  idSocietaCrer: string[];
  /** Squadre da NON considerare di Parma (falsi positivi). */
  escludi: string[];
}

export interface Configurazione {
  alias: FileAlias;
  whitelist: FileWhitelist;
  colori: Record<string, string>;
  /** Hash di alias e whitelist: se cambia, la scoperta dei gironi va rifatta. */
  chiave: string;
}

async function leggiJson<T>(file: string, predefinito: T): Promise<{ valore: T; testo: string }> {
  try {
    const testo = await readFile(file, 'utf8');
    return { valore: { ...predefinito, ...JSON.parse(testo) }, testo };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { valore: predefinito, testo: '' };
    throw new Error(`${path.basename(file)} non è un JSON valido: ${(e as Error).message}`);
  }
}

export async function caricaConfigurazione(dir = DATA_DIR): Promise<Configurazione> {
  const a = await leggiJson<FileAlias>(path.join(dir, 'alias.json'), { squadre: [] });
  const w = await leggiJson<FileWhitelist>(path.join(dir, 'whitelist-manuale.json'), {
    squadre: [],
    codiciSocieta: [],
    idSocietaCrer: [],
    escludi: [],
  });
  const c = await leggiJson<{ campionati: Record<string, string> }>(path.join(dir, 'colori.json'), { campionati: {} });
  return {
    alias: a.valore,
    whitelist: w.valore,
    colori: c.valore.campionati,
    chiave: createHash('sha1').update(a.testo).update(w.testo).digest('hex').slice(0, 12),
  };
}

export interface NomeRisolto {
  chiave: string;
  nome: string;
  voce?: VoceAlias;
}

export class TabellaAlias {
  private perChiave = new Map<string, VoceAlias>();

  constructor(file: FileAlias) {
    for (const voce of file.squadre ?? []) {
      for (const n of [voce.nome, ...(voce.varianti ?? [])]) this.perChiave.set(chiaveSquadra(n), voce);
    }
  }

  risolvi(nomeGrezzo: string): NomeRisolto {
    const voce = this.perChiave.get(chiaveSquadra(nomeGrezzo));
    if (voce) return { chiave: chiaveSquadra(voce.nome), nome: voce.nome, voce };
    return { chiave: chiaveSquadra(nomeGrezzo), nome: pulisciSpazi(separaProvincia(nomeGrezzo).nome) };
  }
}

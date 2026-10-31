import type { Partita } from '../../../shared/model.ts';
import { aggiungiGiorni, giornoSettimana } from './date.ts';

// Calcoli della vista settimanale (griglia lunedì–domenica con l'asse delle ore, come Google Calendar).

/** Durata indicativa di una gara, per l'altezza del blocco: l'orario di fine non è nei dati. */
export const DURATA_MINUTI = 120;

/** Lunedì della settimana che contiene il giorno indicato. */
export function lunedi(iso: string): string {
  return aggiungiGiorni(iso, -((giornoSettimana(iso) + 6) % 7));
}

export function giorniDellaSettimana(lun: string): string[] {
  return Array.from({ length: 7 }, (_, i) => aggiungiGiorni(lun, i));
}

export function minuti(ora: string): number {
  const [h, m] = ora.split(':').map(Number);
  return h * 60 + m;
}

export interface Blocco {
  p: Partita;
  inizio: number;
  fine: number;
  /** Colonna del blocco tra le gare che si sovrappongono (0-based) e numero di colonne del gruppo. */
  corsia: number;
  corsie: number;
  /** Gruppo di gare che si sovrappongono a catena (stesso numero di corsie). */
  gruppo: number;
}

/**
 * Dispone le gare con orario di un giorno: quelle che si sovrappongono stanno affiancate,
 * ognuna nella prima corsia libera; ogni gruppo di gare collegate condivide il numero di corsie.
 */
export function disponi(partite: Partita[]): Blocco[] {
  const ordinate = partite
    .filter((p) => p.ora)
    .map((p) => ({ p, inizio: minuti(p.ora!), fine: Math.min(minuti(p.ora!) + DURATA_MINUTI, 24 * 60), corsia: 0, corsie: 1, gruppo: 0 }))
    .sort((a, b) => a.inizio - b.inizio || a.p.id.localeCompare(b.p.id));

  let gruppo: Blocco[] = [];
  let fineGruppo = -1;
  let n = 0;
  const chiudi = () => {
    const corsie = Math.max(0, ...gruppo.map((b) => b.corsia)) + 1;
    gruppo.forEach((b) => (b.corsie = corsie));
    gruppo = [];
  };
  for (const b of ordinate) {
    if (b.inizio >= fineGruppo) {
      chiudi();
      n++;
    }
    b.gruppo = n;
    const occupate = new Set(gruppo.filter((g) => g.fine > b.inizio).map((g) => g.corsia));
    while (occupate.has(b.corsia)) b.corsia++;
    gruppo.push(b);
    fineGruppo = Math.max(fineGruppo, b.fine);
  }
  chiudi();
  return ordinate;
}

export interface Altre {
  inizio: number;
  fine: number;
  corsia: number;
  corsie: number;
  quante: number;
}

/**
 * Oltre `max` gare affiancate i blocchi diventano illeggibili: si mostrano le prime `max - 1` corsie
 * e un blocco "+N" al posto delle altre (che si vedono allargando il giorno).
 */
export function comprimi(blocchi: Blocco[], max: number): { visibili: Blocco[]; altre: Altre[] } {
  const visibili: Blocco[] = [];
  const nascoste = new Map<number, Blocco[]>();
  for (const b of blocchi) {
    if (b.corsie <= max) visibili.push(b);
    else if (b.corsia < max - 1) visibili.push({ ...b, corsie: max });
    else nascoste.set(b.gruppo, [...(nascoste.get(b.gruppo) ?? []), b]);
  }
  const altre = [...nascoste.values()].map((lista) => ({
    inizio: Math.min(...lista.map((b) => b.inizio)),
    fine: Math.max(...lista.map((b) => b.fine)),
    corsia: max - 1,
    corsie: max,
    quante: lista.length,
  }));
  return { visibili, altre };
}

/** Ore da mostrare (inizio incluso, fine esclusa): sempre almeno 17–23, allargate alle gare della settimana. */
export function fasciaOraria(partite: Partita[]): [number, number] {
  const ore = partite.filter((p) => p.ora).map((p) => minuti(p.ora!));
  const da = Math.min(17, ...ore.map((m) => Math.floor(m / 60)));
  const a = Math.max(23, ...ore.map((m) => Math.ceil((m + DURATA_MINUTI) / 60)));
  return [da, Math.min(a, 24)];
}

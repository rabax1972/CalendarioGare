import type { Campionato, Genere, Livello, Partita, Squadra } from '../../../shared/model.ts';
import { creaStato } from './storage.ts';

export interface Filtri {
  campionati: string[];
  livelli: Livello[];
  generi: Genere[];
  squadra: string | null;
  comune: string | null;
}

export const FILTRI_VUOTI: Filtri = { campionati: [], livelli: [], generi: [], squadra: null, comune: null };

export const statoFiltri = creaStato<Filtri>('volley-parma:filtri', FILTRI_VUOTI);

export function quantiFiltri(f: Filtri): number {
  return f.campionati.length + f.livelli.length + f.generi.length + (f.squadra ? 1 : 0) + (f.comune ? 1 : 0);
}

interface Indici {
  campionato: Map<string, Campionato>;
  squadra: Map<string, Squadra>;
}

export function applicaFiltri(partite: Partita[], f: Filtri, idx: Indici): Partita[] {
  if (!quantiFiltri(f)) return partite;
  return partite.filter((p) => {
    const c = idx.campionato.get(p.campionatoId);
    if (f.campionati.length && !f.campionati.includes(p.campionatoId)) return false;
    if (f.livelli.length && (!c || !f.livelli.includes(c.livello))) return false;
    if (f.generi.length && (!c || !f.generi.includes(c.genere))) return false;
    if (f.squadra && p.casa !== f.squadra && p.ospite !== f.squadra) return false;
    if (f.comune) {
      const comuni = [p.comune, idx.squadra.get(p.casa)?.comune, idx.squadra.get(p.ospite)?.comune];
      if (!comuni.includes(f.comune)) return false;
    }
    return true;
  });
}

/** Raggruppa per giorno mantenendo l'ordine; le gare senza data finiscono nel gruppo `null`. */
export function perGiorno(partite: Partita[]): [string | null, Partita[]][] {
  const gruppi = new Map<string | null, Partita[]>();
  for (const p of partite) {
    const g = gruppi.get(p.data) ?? [];
    g.push(p);
    gruppi.set(p.data, g);
  }
  return [...gruppi.entries()];
}

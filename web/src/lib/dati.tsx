import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Campionato, Classifica, Meta, Partita, Rassegna, Rosa, Squadra } from '../../../shared/model.ts';

export interface Dati {
  campionati: Campionato[];
  squadre: Squadra[];
  partite: Partita[];
  classifiche: Classifica[];
  meta: Meta;
  campionato: Map<string, Campionato>;
  squadra: Map<string, Squadra>;
  partita: Map<string, Partita>;
  rosa: Map<string, Rosa>;
  rassegna: Rassegna | null;
}

interface StatoDati {
  dati: Dati | null;
  errore: string | null;
  ricarica: () => void;
}

const Contesto = createContext<StatoDati>({ dati: null, errore: null, ricarica: () => {} });

async function json<T>(nome: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${nome}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function carica(): Promise<Dati> {
  const [campionati, squadre, partite, classifiche, meta, rose, rassegna] = await Promise.all([
    json<Campionato[]>('campionati'),
    json<Squadra[]>('squadre'),
    json<Partita[]>('partite'),
    json<Classifica[]>('classifiche'),
    json<Meta>('meta'),
    // Le rose sono facoltative: senza, l'app funziona come prima.
    json<Rosa[]>('rose').catch(() => [] as Rosa[]),
    json<Rassegna>('rassegna').catch(() => null),
  ]);
  return {
    campionati,
    squadre,
    partite,
    classifiche,
    meta,
    campionato: new Map(campionati.map((c) => [c.id, c])),
    squadra: new Map(squadre.map((s) => [s.id, s])),
    partita: new Map(partite.map((p) => [p.id, p])),
    rosa: new Map(rose.map((r) => [r.squadraId, r])),
    rassegna,
  };
}

export function DatiProvider({ children }: { children: ReactNode }) {
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const ricarica = useCallback(() => {
    carica()
      .then((d) => {
        setDati(d);
        setErrore(null);
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    ricarica();
    // Il service worker avvisa quando ha scaricato dati più recenti di quelli serviti dalla cache.
    if (!('BroadcastChannel' in window)) return;
    const canale = new BroadcastChannel('aggiornamento-dati');
    let timer: number | undefined;
    canale.onmessage = () => {
      clearTimeout(timer);
      timer = window.setTimeout(ricarica, 500);
    };
    return () => canale.close();
  }, [ricarica]);

  const valore = useMemo(() => ({ dati, errore, ricarica }), [dati, errore, ricarica]);
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useStatoDati() {
  return useContext(Contesto);
}

/** Da usare nelle viste mostrate solo a dati caricati. */
export function useDati(): Dati {
  const { dati } = useContext(Contesto);
  if (!dati) throw new Error('Dati non ancora caricati');
  return dati;
}

import { describe, expect, it, vi } from 'vitest';
import type { Campionato, Partita, Squadra } from '../../../shared/model.ts';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
const { applicaFiltri, FILTRI_VUOTI, perGiorno } = await import('./filtri.ts');
const { intervallo } = await import('./date.ts');

const camp = (id: string, livello: Campionato['livello'], genere: Campionato['genere']) =>
  ({ id, livello, genere }) as Campionato;
const sq = (id: string, comune: string) => ({ id, comune }) as Squadra;
const partita = (id: string, campionatoId: string, casa: string, ospite: string, data: string | null = '2026-11-07') =>
  ({ id, campionatoId, casa, ospite, data, comune: null }) as Partita;

const idx = {
  campionato: new Map([
    ['csen', camp('csen', 'provinciale', 'misto')],
    ['df', camp('df', 'regionale', 'femminile')],
    ['bm', camp('bm', 'nazionale', 'maschile')],
  ]),
  squadra: new Map([
    ['a', sq('a', 'Parma')],
    ['b', sq('b', 'Collecchio')],
    ['c', sq('c', 'Modena')],
  ]),
};
const partite = [partita('1', 'csen', 'a', 'b'), partita('2', 'df', 'c', 'b'), partita('3', 'bm', 'c', 'a')];

describe('filtri', () => {
  it('senza filtri restituisce tutto', () => {
    expect(applicaFiltri(partite, FILTRI_VUOTI, idx)).toHaveLength(3);
  });

  it('combina campionato, livello, genere, squadra e comune', () => {
    const ids = (f: Partial<typeof FILTRI_VUOTI>) => applicaFiltri(partite, { ...FILTRI_VUOTI, ...f }, idx).map((p) => p.id);
    expect(ids({ campionati: ['csen', 'bm'] })).toEqual(['1', '3']);
    expect(ids({ livelli: ['regionale'] })).toEqual(['2']);
    expect(ids({ generi: ['maschile', 'misto'] })).toEqual(['1', '3']);
    expect(ids({ squadra: 'b' })).toEqual(['1', '2']);
    expect(ids({ comune: 'Parma' })).toEqual(['1', '3']);
    expect(ids({ comune: 'Parma', livelli: ['nazionale'] })).toEqual(['3']);
  });

  it('raggruppa per giorno', () => {
    const g = perGiorno([partita('1', 'csen', 'a', 'b', '2026-11-07'), partita('2', 'csen', 'a', 'b', '2026-11-07'), partita('3', 'csen', 'a', 'b', null)]);
    expect(g.map(([d, l]) => [d, l.length])).toEqual([['2026-11-07', 2], [null, 1]]);
  });
});

describe('iniziali del monogramma', async () => {
  const { iniziali } = await import('./iniziali.ts');
  it('ignora forme giuridiche e parole generiche', () => {
    expect(iniziali('A.S.D. POL. COOP PARMA 1964')).toBe('CP');
    expect(iniziali('ISOMEC GREEN INZANI')).toBe('IG');
    expect(iniziali('VOLLEY TREVISO')).toBe('TR');
    expect(iniziali('CUS 3')).toBe('C3');
    expect(iniziali('VOLLEY')).toBe('VO');
  });
});

describe('periodi', () => {
  it('weekend: sabato e domenica successivi, o quello in corso', () => {
    expect(intervallo('weekend', '2026-10-28')).toEqual({ da: '2026-10-31', a: '2026-11-01' }); // mercoledì
    expect(intervallo('weekend', '2026-10-31')).toEqual({ da: '2026-10-31', a: '2026-11-01' }); // sabato
    expect(intervallo('weekend', '2026-11-01')).toEqual({ da: '2026-11-01', a: '2026-11-01' }); // domenica
  });

  it('settimana: oggi più sei giorni', () => {
    expect(intervallo('settimana', '2026-12-28')).toEqual({ da: '2026-12-28', a: '2027-01-03' });
  });
});

import { describe, expect, it } from 'vitest';
import type { Partita } from '../../shared/model.ts';
import type { Configurazione } from '../src/alias.ts';
import { applicaSpostamenti, costruisci } from '../src/build.ts';
import type { PartitaGrezza, Snapshot } from '../src/types.ts';

const configBase = (over: Partial<Configurazione> = {}): Configurazione => ({
  alias: { squadre: [] },
  whitelist: { squadre: [], codiciSocieta: [], idSocietaCrer: [], escludi: [] },
  colori: {},
  chiave: 'test',
  ...over,
});

function partita(id: string, casa: PartitaGrezza['casa'], ospite: PartitaGrezza['ospite'], extra: Partial<PartitaGrezza> = {}): PartitaGrezza {
  return {
    id,
    campionatoId: extra.campionatoId ?? 'reg-d-f',
    girone: 'A',
    giornata: 1,
    numeroGara: id,
    data: '2026-11-07',
    ora: '18:00',
    palestra: null,
    indirizzo: null,
    comune: null,
    casa,
    ospite,
    set: [],
    punteggio: null,
    stato: 'da_giocare',
    fonteUrl: 'https://x',
    ...extra,
  };
}

const campionato = (id: string, livello: 'provinciale' | 'regionale') => ({
  id,
  nome: id,
  nomeBreve: id,
  livello,
  federazione: 'FIPAV' as const,
  genere: 'femminile' as const,
  categoria: id,
  stagione: '2026/27',
  fonte: 'test',
  fonteUrl: 'https://x',
  gironi: ['A'],
});

const provinciale: Snapshot = {
  fonte: 'prov',
  aggiornatoIl: '',
  stagione: '2026/27',
  filtroParma: false,
  campionati: [campionato('prov', 'provinciale')],
  partite: [partita('p1', { nome: 'VOLLEY FELINO' }, { nome: 'CUS PARMA' }, { campionatoId: 'prov' })],
  classifiche: [],
};

const regionale: Snapshot = {
  fonte: 'crer',
  aggiornatoIl: '',
  stagione: '2026/27',
  filtroParma: true,
  campionati: [campionato('reg-d-f', 'regionale')],
  partite: [
    partita('r1', { nome: 'SALSOVOLLEY PR', provincia: 'PR' }, { nome: 'MODENA MO', provincia: 'MO' }),
    partita('r2', { nome: 'MODENA MO', provincia: 'MO' }, { nome: 'REGGIO RE', provincia: 'RE' }),
    partita('r3', { nome: 'REGGIO RE', provincia: 'RE' }, { nome: 'A.S.D. Volley Felino' }),
    partita('r4', { nome: 'SQUADRA SENZA SIGLA' }, { nome: 'REGGIO RE' }, { provinciaPalestra: 'PR' }),
    partita('r5', { nome: 'MISTERIOSA', idSocietaFonte: '99' }, { nome: 'MODENA MO' }),
    partita('r6', { nome: 'BOLOGNA BO', provincia: 'BO' }, { nome: 'Isolata' }),
    // Squadra di un'altra provincia che gioca "in casa" in campo neutro a Parma: non è parmense.
    partita('r7', { nome: 'VBC CREMONESE', provincia: 'CR' }, { nome: 'MODENA MO', provincia: 'MO' }, { provinciaPalestra: 'PR' }),
  ],
  classifiche: [],
};

describe('filtro squadre di Parma', () => {
  it('tiene solo le gare con almeno una squadra parmense, per i motivi attesi', () => {
    const r = costruisci([provinciale, regionale], configBase());
    const ids = r.partite.map((p) => p.id).sort();
    expect(ids).toEqual(['p1', 'r1', 'r3', 'r4']);
    expect(r.report).toContain('SALSOVOLLEY** — provincia PR');
    expect(r.report).toContain('presente nei campionati provinciali');
    expect(r.report).toContain('gioca in casa in provincia di Parma');
  });

  it('whitelist ed esclusioni manuali hanno la precedenza', () => {
    const r = costruisci(
      [provinciale, regionale],
      configBase({
        whitelist: { squadre: ['isolata'], codiciSocieta: [], idSocietaCrer: ['99'], escludi: ['SALSOVOLLEY'] },
      }),
    );
    const ids = r.partite.map((p) => p.id).sort();
    expect(ids).toEqual(['p1', 'r3', 'r4', 'r5', 'r6']);
  });

  it('gli alias unificano i nomi e danno il nome mostrato', () => {
    const r = costruisci(
      [provinciale, regionale],
      configBase({ alias: { squadre: [{ nome: 'Salsomaggiore Volley', varianti: ['SALSOVOLLEY'], comune: 'Salsomaggiore Terme' }] } }),
    );
    const s = r.squadre.find((x) => x.nome === 'Salsomaggiore Volley')!;
    expect(s).toMatchObject({ comune: 'Salsomaggiore Terme', parmense: true });
    expect(r.partite.find((p) => p.id === 'r1')!.casa).toBe(s.id);
  });

  it('elenca solo i campionati con gare incluse e assegna un colore a ciascuno', () => {
    const r = costruisci([provinciale, regionale], configBase());
    expect(r.campionati.map((c) => c.id).sort()).toEqual(['prov', 'reg-d-f']);
    expect(new Set(r.campionati.map((c) => c.colore)).size).toBe(2);
  });
});

describe('gare spostate', () => {
  const base: Partita = {
    id: 'x',
    campionatoId: 'c',
    girone: null,
    giornata: 1,
    numeroGara: null,
    data: '2026-11-07',
    ora: '18:00',
    palestra: null,
    indirizzo: null,
    comune: null,
    casa: 'a',
    ospite: 'b',
    set: [],
    punteggio: null,
    stato: 'da_giocare',
    fonteUrl: '',
  };

  it('rileva il cambio di data rispetto all’esecuzione precedente', () => {
    const nuove = [{ ...base, data: '2026-11-14' }];
    applicaSpostamenti(nuove, [base]);
    expect(nuove[0].spostata).toEqual({ data: '2026-11-07', ora: '18:00' });
  });

  it('conserva la data originale anche dopo un secondo spostamento', () => {
    const prima = { ...base, data: '2026-11-14', spostata: { data: '2026-11-07', ora: '18:00' } };
    const nuove = [{ ...base, data: '2026-11-21' }];
    applicaSpostamenti(nuove, [prima]);
    expect(nuove[0].spostata).toEqual({ data: '2026-11-07', ora: '18:00' });
  });

  it('toglie il segno se la gara torna alla data originale', () => {
    const prima = { ...base, data: '2026-11-14', spostata: { data: '2026-11-07', ora: '18:00' } };
    const nuove = [{ ...base }];
    applicaSpostamenti(nuove, [prima]);
    expect(nuove[0].spostata).toBeUndefined();
  });
});

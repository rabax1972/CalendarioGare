import { describe, expect, it } from 'vitest';
import {
  convertiCalendarioMv,
  convertiClassificaMv,
  type CalendarioMv,
  type ClassificaMv,
} from '../src/sources/myvolley.ts';
import { fixture } from './helpers.ts';

const girone = { anno: '2026', serie: 'B', sesso: 'M', girone: 'C' };

// Se questi test falliscono dopo aver aggiornato le fixture, il formato dei JSON federali è cambiato.
describe('myvolley – calendario', () => {
  const partite = convertiCalendarioMv(JSON.parse(fixture('myvolley/calendario-B-M-C.json')) as CalendarioMv, girone);

  it('converte le partite giocate con set e punteggio', () => {
    const p = partite.find((x) => x.numeroGara === '7404')!;
    expect(p).toMatchObject({
      campionatoId: 'naz-b-m',
      girone: 'C',
      data: '2026-10-17',
      ora: '18:00',
      comune: 'Busseto',
      stato: 'giocata',
      punteggio: { casa: 2, ospite: 3 },
      casa: { nome: 'VERDIANO BUSSETO VOLLEY PR', provincia: 'PR', codiceSocieta: '080380063' },
    });
    expect(p.set).toHaveLength(5);
  });

  it('non riporta dati personali delle società', () => {
    const ammessi = ['codiceSocieta', 'comune', 'logoUrl', 'nome', 'provincia'];
    for (const p of partite) for (const s of [p.casa, p.ospite]) expect(Object.keys(s).every((k) => ammessi.includes(k))).toBe(true);
  });

  it('ignora il logo segnaposto del feed', () => {
    expect(partite.every((p) => !/fallback/.test(p.casa.logoUrl ?? '') && !/fallback/.test(p.ospite.logoUrl ?? ''))).toBe(true);
  });

  it('segna come da giocare le gare future', () => {
    expect(partite.some((p) => p.stato === 'da_giocare' && p.punteggio === null)).toBe(true);
  });
});

describe('myvolley – classifica', () => {
  it('converte la classifica', () => {
    const cl = convertiClassificaMv(JSON.parse(fixture('myvolley/classifica-B-M-C.json')) as ClassificaMv, girone);
    expect(cl.campionatoId).toBe('naz-b-m');
    expect(cl.righe.length).toBeGreaterThan(10);
    expect(cl.righe.some((r) => r.squadra.provincia === 'PR')).toBe(true);
  });
});

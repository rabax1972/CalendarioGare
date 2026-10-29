import { describe, expect, it } from 'vitest';
import {
  interpretaEtichettaCrer,
  parseClassificaCrer,
  parseGironeCrer,
  parseIndiceCrer,
} from '../src/sources/crer.ts';
import { fixture } from './helpers.ts';

// Se questi test falliscono dopo aver aggiornato le fixture, crer.portalefipav.net ha cambiato struttura.
describe('CRER – indice', () => {
  it('trova stagione e gironi, escludendo il gruppo "campionati nazionali"', () => {
    const idx = parseIndiceCrer(fixture('crer/risultati-settimana.html'));
    expect(idx.stId).toBe('2415');
    expect(idx.stagione).toBe('2026/27');
    expect(idx.gironi).toHaveLength(21);
    expect(idx.gironi.some((g) => /nazional/i.test(g.etichetta))).toBe(false);
  });

  it('interpreta le etichette dei gironi', () => {
    expect(interpretaEtichettaCrer('CM Gir. A')).toMatchObject({ id: 'crer-serie-c-m', genere: 'maschile', girone: 'A' });
    expect(interpretaEtichettaCrer('DF Gir. E')).toMatchObject({ id: 'crer-serie-d-f', genere: 'femminile', girone: 'E' });
    expect(interpretaEtichettaCrer('17FB')).toMatchObject({ id: 'crer-u17-f', categoria: 'Under 17', girone: 'B' });
  });
});

describe('CRER – girone', () => {
  const { partite } = parseGironeCrer(fixture('crer/risultati-cm-gir-a.html'), 'https://x');

  it('legge tutte le partite del girone', () => {
    expect(partite).toHaveLength(156);
    expect(partite.every((p) => p.campionatoId === 'crer-serie-c-m' && p.girone === 'A')).toBe(true);
  });

  it('legge squadre con provincia e id società, risultato e parziali', () => {
    const p = partite.find((x) => x.id === 'crer-131626240')!;
    expect(p.ospite).toEqual({
      nome: 'ISOMEC GREEN INZANI PR',
      societa: 'ISOMEC GREEN INZANI',
      provincia: 'PR',
      idSocietaFonte: '4470',
    });
    expect(p.punteggio).toEqual({ casa: 3, ospite: 2 });
    expect(p.set).toEqual([[25, 18], [20, 25], [25, 21], [23, 25], [15, 13]]);
    expect(p).toMatchObject({ data: '2026-10-17', ora: '19:00', palestra: 'PALESTRA I CENTO PASSI', comune: 'Soliera' });
  });

  it('distingue le gare da giocare', () => {
    expect(partite.filter((p) => p.stato === 'da_giocare').length).toBeGreaterThan(100);
  });
});

describe('CRER – classifica', () => {
  it('legge la classifica', () => {
    const cl = parseClassificaCrer(fixture('crer/classifica-cm-gir-a.html'), 'CM Gir. A', 'https://x')!;
    expect(cl.righe).toHaveLength(13);
    expect(cl.righe[0]).toMatchObject({
      posizione: 1,
      squadra: { nome: 'UNIVOLLEY CARPI MO' },
      punti: 6,
      giocate: 2,
      setVinti: 6,
      puntiFatti: 158,
    });
  });
});

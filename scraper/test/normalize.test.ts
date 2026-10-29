import { describe, expect, it } from 'vitest';
import { chiaveSquadra, dataIso, oraIso, separaProvincia } from '../src/normalize.ts';

describe('normalizzazione nomi', () => {
  it('separa la sigla provincia finale solo se è una provincia', () => {
    expect(separaProvincia('GALAXY VOLLEY COLLECCHIO PR')).toEqual({ nome: 'GALAXY VOLLEY COLLECCHIO', provincia: 'PR' });
    expect(separaProvincia('CUS 3')).toEqual({ nome: 'CUS 3', provincia: null });
    expect(separaProvincia('VOLLEY XX')).toEqual({ nome: 'VOLLEY XX', provincia: null });
  });

  it('rende confrontabili nomi scritti in modo diverso', () => {
    expect(chiaveSquadra('A.S.D. Pol. Coop Parma 1964 PR')).toBe(chiaveSquadra('ASD POL.COOP PARMA 1964'));
    expect(chiaveSquadra('CRAL CRÉDIT AGRICOLE')).toBe(chiaveSquadra('Cral Credit Agricole'));
    expect(chiaveSquadra('CUS PARMA A')).not.toBe(chiaveSquadra('CUS PARMA B'));
  });

  it('interpreta date e orari delle fonti', () => {
    expect(dataIso('Martedì 27/10/2026 20:00')).toBe('2026-10-27');
    expect(dataIso('23/10/26 21:15')).toBe('2026-10-23');
    expect(dataIso('da definire')).toBeNull();
    expect(oraIso('19.00')).toBe('19:00');
    expect(oraIso('9:30')).toBe('09:30');
    expect(oraIso('00:00')).toBeNull();
  });
});

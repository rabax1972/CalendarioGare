import { describe, expect, it } from 'vitest';
import type { Campionato, Partita, Squadra } from '../../../shared/model.ts';
import { contoAllaRovescia, forma, isDerby, prossimaGara, riepilogoWeekend, serie } from './analisi.ts';

const camp = (id: string, livello: Campionato['livello']) => ({ id, livello }) as Campionato;
const sq = (id: string, parmense: boolean) => ({ id, nome: id.toUpperCase(), parmense }) as Squadra;
const d = {
  campionato: new Map([
    ['csen', camp('csen', 'provinciale')],
    ['b2', camp('b2', 'nazionale')],
  ]),
  squadra: new Map([
    ['minerva', sq('minerva', true)],
    ['galaxy', sq('galaxy', true)],
    ['modena', sq('modena', false)],
  ]),
};
const gara = (id: string, over: Partial<Partita>): Partita =>
  ({ id, campionatoId: 'b2', casa: 'minerva', ospite: 'modena', data: '2026-10-31', ora: '18:00', stato: 'da_giocare', punteggio: null, ...over }) as Partita;

describe('analisi per la home e le classifiche', () => {
  it('derby solo tra squadre di Parma fuori dai provinciali', () => {
    expect(isDerby(gara('1', { ospite: 'galaxy' }), d)).toBe(true);
    expect(isDerby(gara('2', {}), d)).toBe(false);
    expect(isDerby(gara('3', { ospite: 'galaxy', campionatoId: 'csen' }), d)).toBe(false);
  });

  it('forma: ultimi risultati dal più vecchio, vista dalla squadra; serie in corso', () => {
    const partite = [
      gara('a', { data: '2026-10-10', stato: 'giocata', punteggio: { casa: 3, ospite: 0 } }),
      gara('b', { data: '2026-10-17', stato: 'giocata', casa: 'modena', ospite: 'minerva', punteggio: { casa: 3, ospite: 1 } }),
      gara('c', { data: '2026-10-24', stato: 'giocata', casa: 'modena', ospite: 'minerva', punteggio: { casa: 2, ospite: 3 } }),
      gara('d', { data: '2026-10-31' }),
    ];
    const f = forma('minerva', partite, d);
    expect(f.map((e) => [e.partitaId, e.vinta, e.set])).toEqual([
      ['a', true, [3, 0]],
      ['b', false, [1, 3]],
      ['c', true, [3, 2]],
    ]);
    expect(serie(f)).toBe(1);
    expect(serie(f.slice(0, 2))).toBe(-1);
    expect(forma('minerva', partite, d, 2).map((e) => e.partitaId)).toEqual(['b', 'c']);
  });

  it('riepilogo del weekend, oppure dei 7 giorni se nel weekend non si gioca', () => {
    // Giovedì 29 ottobre 2026: weekend 31 ottobre – 1 novembre.
    const partite = [
      gara('1', { data: '2026-10-31', ospite: 'galaxy' }),
      gara('2', { data: '2026-11-01', casa: 'modena', ospite: 'minerva' }),
      gara('3', { data: '2026-11-01', stato: 'rinviata' }),
      gara('4', { data: '2026-11-03' }),
    ];
    expect(riepilogoWeekend(partite, d, '2026-10-29')).toMatchObject({ periodo: 'weekend', gare: 2, inCasa: 1, derby: 1, campionati: 1 });
    expect(riepilogoWeekend([partite[3]], d, '2026-10-29')).toMatchObject({ periodo: 'settimana', gare: 1 });
  });

  it('prossima gara delle squadre seguite e conto alla rovescia', () => {
    const partite = [gara('passata', { data: '2026-10-29', ora: '09:00' }), gara('dopo', { data: '2026-11-03', ora: '20:30' })];
    const adesso = new Date('2026-10-29T12:00:00+01:00');
    expect(prossimaGara(partite, ['minerva'], adesso)?.id).toBe('dopo');
    expect(prossimaGara(partite, ['galaxy'], adesso)).toBeNull();
    expect(contoAllaRovescia(partite[1], '2026-10-29')).toBe('Tra 5 giorni · mar 3 nov, 20:30');
    expect(contoAllaRovescia(gara('x', { data: '2026-10-30' }), '2026-10-29')).toBe('Domani alle 18:00');
  });
});

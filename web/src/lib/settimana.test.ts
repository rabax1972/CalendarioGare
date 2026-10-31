import { describe, expect, it } from 'vitest';
import type { Partita } from '../../../shared/model.ts';
import { comprimi, disponi, fasciaOraria, giorniDellaSettimana, lunedi } from './settimana.ts';

const gara = (id: string, ora: string | null): Partita => ({ id, data: '2026-11-04', ora }) as Partita;

describe('vista settimanale', () => {
  it('settimana da lunedì a domenica', () => {
    expect(lunedi('2026-11-04')).toBe('2026-11-02');
    expect(lunedi('2026-11-02')).toBe('2026-11-02');
    expect(lunedi('2026-11-08')).toBe('2026-11-02');
    expect(giorniDellaSettimana('2026-10-26')).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
  });

  it('affianca le gare che si sovrappongono, le altre occupano tutta la colonna', () => {
    const b = disponi([gara('d', '21:00'), gara('a', '19:30'), gara('b', '20:00'), gara('c', '20:00'), gara('x', null), gara('e', '15:00')]);
    expect(b.map((x) => [x.p.id, x.corsia, x.corsie])).toEqual([
      ['e', 0, 1],
      ['a', 0, 4],
      ['b', 1, 4],
      ['c', 2, 4],
      ['d', 3, 4],
    ]);
  });

  it('riusa la corsia che si libera', () => {
    const b = disponi([gara('a', '18:00'), gara('b', '19:00'), gara('c', '20:00')]);
    expect(b.map((x) => [x.p.id, x.corsia, x.corsie])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2],
    ]);
  });

  it('oltre il massimo di corsie raccoglie le altre gare in un blocco "+N"', () => {
    const b = disponi([gara('e', '15:00'), ...['a', 'b', 'c', 'd', 'f'].map((id) => gara(id, '21:00'))]);
    const { visibili, altre } = comprimi(b, 3);
    expect(visibili.map((x) => [x.p.id, x.corsia, x.corsie])).toEqual([
      ['e', 0, 1],
      ['a', 0, 3],
      ['b', 1, 3],
    ]);
    expect(altre).toEqual([{ inizio: 21 * 60, fine: 23 * 60, corsia: 2, corsie: 3, quante: 3 }]);
  });

  it('fascia oraria: almeno 17–23, allargata alle gare', () => {
    expect(fasciaOraria([])).toEqual([17, 23]);
    expect(fasciaOraria([gara('a', '15:30'), gara('b', '21:30'), gara('c', null)])).toEqual([15, 24]);
  });
});

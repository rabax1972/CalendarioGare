import { describe, expect, it } from 'vitest';
import type { Campionato, Partita, Squadra } from '../../shared/model.ts';
import { calendarioSquadra, utcDaRoma } from '../../shared/ics.ts';

const squadra: Squadra = { id: 'minerva', nome: 'CIRCOLO MINERVA', societa: null, comune: 'Parma', parmense: true, campionati: ['b2'] };
const campionati = new Map([['b2', { id: 'b2', nome: 'Serie B2 femminile', nomeBreve: 'B2 F' } as Campionato]]);
const gara = (over: Partial<Partita>): Partita => ({
  id: 'g1', campionatoId: 'b2', girone: 'E', giornata: 3, numeroGara: null, data: '2026-11-07', ora: '18:30',
  palestra: 'PalaCasalini', indirizzo: 'Via Rossi, 1', comune: 'Parma', casa: 'minerva', ospite: 'altra',
  set: [], punteggio: null, stato: 'da_giocare', fonteUrl: 'https://esempio.it/g1', ...over,
});

describe('calendario iCalendar della squadra', () => {
  it('converte l’ora italiana in UTC con ora legale e solare', () => {
    expect(utcDaRoma('2026-10-24', '18:00').toISOString()).toBe('2026-10-24T16:00:00.000Z');
    expect(utcDaRoma('2026-11-07', '18:30').toISOString()).toBe('2026-11-07T17:30:00.000Z');
  });

  it('un evento per gara, con risultato, rinvii, luogo e testo con caratteri speciali', () => {
    const ics = calendarioSquadra({
      squadra,
      campionati,
      generatoIl: '2026-10-29T10:00:00Z',
      nomeSquadra: (id) => (id === 'minerva' ? 'CIRCOLO MINERVA' : 'VOLLEY, ALTRA'),
      partite: [
        gara({}),
        gara({ id: 'g2', data: '2026-10-24', ora: '18:00', stato: 'giocata', punteggio: { casa: 3, ospite: 1 }, set: [[25, 20]] }),
        gara({ id: 'g3', data: '2026-12-01', ora: null, stato: 'rinviata' }),
        gara({ id: 'g4', data: null }),
        gara({ id: 'g5', casa: 'x', ospite: 'y' }),
      ],
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('DTSTART:20261107T173000Z\r\nDTEND:20261107T193000Z');
    expect(ics).toContain('SUMMARY:CIRCOLO MINERVA – VOLLEY\\, ALTRA (B2 F)');
    expect(ics).toContain('SUMMARY:CIRCOLO MINERVA 3-1 VOLLEY\\, ALTRA (B2 F)');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('LOCATION:PalaCasalini\\, Via Rossi\\, 1\\, Parma');
    for (const riga of ics.split('\r\n')) expect(Buffer.byteLength(riga)).toBeLessThanOrEqual(75);
  });
});

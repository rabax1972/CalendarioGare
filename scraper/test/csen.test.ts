import { describe, expect, it } from 'vitest';
import { interpretaLuogo, parseCalendarioCsen, parseClassificaCsen, urlCalendarioCompleto } from '../src/sources/csen.ts';
import { fixture } from './helpers.ts';

// Se questi test falliscono dopo aver aggiornato le fixture, il sito CSEN ha cambiato struttura.
describe('CSEN – calendario', () => {
  const cal = parseCalendarioCsen(fixture('csen/calendario-2026.html'), 'https://x');

  it('legge stagione, gironi e tutte le partite', () => {
    expect(cal.stagione).toBe('2026/27');
    expect(cal.gironi).toEqual(['A', 'B']);
    expect(cal.partite).toHaveLength(180);
    expect(new Set(cal.partite.map((p) => p.id)).size).toBe(180);
  });

  it('legge una partita da giocare con palestra, comune e coordinate', () => {
    const p = cal.partite.find((x) => x.numeroGara === '3')!;
    expect(p).toMatchObject({
      girone: 'A',
      giornata: 1,
      data: '2026-10-27',
      ora: '20:00',
      palestra: 'PALESTRA PER TUTTI',
      indirizzo: 'Via Luigi Anedda, 1',
      comune: 'Parma',
      casa: { nome: 'CEDACRI GIOCOPARMA' },
      ospite: { nome: 'ISOMEC INZANI PARMA ASFALTI' },
      stato: 'da_giocare',
      punteggio: null,
    });
    expect(p.lat).toBeCloseTo(44.828285);
  });

  it('riconosce le gare spostate con la data originale', () => {
    const p = cal.partite.find((x) => x.numeroGara === '56')!;
    expect(p.data).toBe('2026-12-09');
    expect(p.spostata).toEqual({ data: '2026-12-16', ora: '20:00' });
  });

  it('legge risultati e parziali (stagione precedente)', () => {
    const prec = parseCalendarioCsen(fixture('csen/calendario-2025.html'), 'https://x');
    const giocate = prec.partite.filter((p) => p.stato === 'giocata');
    expect(giocate.length).toBeGreaterThan(150);
    const p = prec.partite.find((x) => x.casa.nome === 'EMBOLO' && x.ospite.nome === 'CREDIT AGRICOLE')!;
    expect(p.punteggio).toEqual({ casa: 2, ospite: 1 });
    expect(p.set).toEqual([[19, 25], [25, 10], [25, 17]]);
  });
});

describe('CSEN – classifica', () => {
  it('legge una classifica per girone', () => {
    const cl = parseClassificaCsen(fixture('csen/classifica-2026.html'), 'https://x');
    expect(cl.map((c) => c.girone)).toEqual(['A', 'B']);
    expect(cl[0].righe[0]).toMatchObject({ posizione: 1, squadra: { nome: 'BONGIO AZUL' }, punti: 0 });
    expect(cl[0].righe.length + cl[1].righe.length).toBe(20);
  });
});

describe('CSEN – luogo', () => {
  it("estrae comune e provincia dall'indirizzo del link Google Calendar", () => {
    expect(interpretaLuogo("Varano, 43040 Varano de' Melegari PR")).toMatchObject({
      comune: "Varano De' Melegari",
      provincia: 'PR',
    });
    expect(interpretaLuogo('Anna Frank, Strada Egidio Pini, 16, parma')).toMatchObject({ comune: 'Parma', provincia: null });
    expect(interpretaLuogo('Pala Casalini, Pala-Casalini')).toMatchObject({ palestra: 'Pala Casalini', comune: null });
  });
});

describe('CSEN – pagina Calendario con i filtri', () => {
  // Struttura dei filtri introdotta dal sito a fine ottobre 2026: di default mostra solo la giornata corrente.
  const filtri = (stagioni: string) => `<form>
    <select id="filtro-stagione" name="stagioneId">${stagioni}</select>
    <select id="filtro-giornata" name="giornata">
      <option value="tutte">Tutte le giornate</option><option value="1" selected="selected">Giornata 1</option>
    </select></form>`;

  it('chiede tutte le giornate della stagione selezionata', () => {
    expect(urlCalendarioCompleto(filtri('<option selected="selected" value="1">2026-27</option><option value="2">2025-26</option>'))).toBe(
      'https://www.volleymistocsenparma.it/Calendario?stagioneId=1&fase=&squadraId=&giornata=tutte',
    );
  });

  it('senza filtri la pagina predefinita contiene già tutto', () => {
    expect(urlCalendarioCompleto(fixture('csen/calendario-2026.html'))).toBeNull();
  });
});

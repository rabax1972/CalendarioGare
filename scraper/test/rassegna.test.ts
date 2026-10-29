import { describe, expect, it } from 'vitest';
import type { Squadra } from '../../shared/model.ts';
import {
  costruisciRassegna,
  dataOraRoma,
  estratto,
  mesiStagione,
  parseFeed,
  pertinente,
  riconosciSquadre,
  testoSemplice,
  unisci,
  urlRicerca,
  type ArticoloGrezzo,
  type ConfigRassegna,
} from '../src/rassegna.ts';

// Feed ricalcati sulla struttura reale (WordPress e Drupal di federvolley.it), con testi inventati.

const FEED_WP = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<title>Risultati della ricerca per &#8220;volley&#8221;</title>
<item>
  <title>VOLLEY B2 FEMMINILE, DEBUTTO PER IL MINERVA</title>
  <link>https://www.12tvparma.it/puntata/tg/volley-b2-minerva/</link>
  <pubDate>Wed, 21 Oct 2026 17:30:00 +0000</pubDate>
  <description><![CDATA[<p>L'articolo <a href="https://www.12tvparma.it/x/">VOLLEY B2</a> proviene da <a href="https://www.12tvparma.it">12 TV Parma</a>.</p>]]></description>
</item>
<item>
  <title>Senza data</title>
  <link>https://www.12tvparma.it/senza-data/</link>
</item>
</channel></rss>`;

const FEED_DRUPAL = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>
<item>
  <title>Club Italia, prima vittoria da tre punti</title>
  <link>https://www.federvolley.it/club-italia-vittoria</link>
  <description>&lt;img src="x.jpg" /&gt;&lt;p&gt;Al &lt;strong&gt;PalaRaschi&lt;/strong&gt; di Parma le azzurrine vincono 3-0.&lt;/p&gt;</description>
  <pubDate><time datetime="2026-10-24T18:05:00+02:00" title="Sabato">Sab, 10/24/2026 - 18:05</time>
</pubDate>
</item>
</channel></rss>`;

const VOCI = [
  { parole: ['club italia'], squadre: ['CLUB ITALIA'], senza: ['maschil'] },
  { parole: ['energy volley'], squadre: ['ENERGY VOLLEY'] },
  { parole: ['minerva'], squadre: ['CIRCOLO MINERVA ASD'] },
];

const art = (over: Partial<ArticoloGrezzo>): ArticoloGrezzo => ({
  titolo: 'Titolo',
  url: 'https://www.12tvparma.it/a/',
  testata: '12tvparma',
  pubblicato: '2026-10-21T17:30:00.000Z',
  testo: '',
  ...over,
});

describe('lettura dei feed', () => {
  it('RSS WordPress: data RFC 822, scarta le voci senza data valida solo dopo', () => {
    const voci = parseFeed(FEED_WP);
    expect(voci).toHaveLength(2);
    expect(voci[0]).toMatchObject({
      titolo: 'VOLLEY B2 FEMMINILE, DEBUTTO PER IL MINERVA',
      url: 'https://www.12tvparma.it/puntata/tg/volley-b2-minerva/',
      pubblicato: '2026-10-21T17:30:00.000Z',
    });
    expect(voci[1].pubblicato).toBeNull();
  });

  it('RSS Drupal di federvolley.it: data dentro <time datetime>', () => {
    const [v] = parseFeed(FEED_DRUPAL);
    expect(v.pubblicato).toBe('2026-10-24T16:05:00.000Z');
    expect(testoSemplice(v.descrizione)).toBe('Al PalaRaschi di Parma le azzurrine vincono 3-0.');
  });

  it('toglie la dicitura automatica di WordPress e tronca l’estratto a una parola intera', () => {
    expect(testoSemplice(parseFeed(FEED_WP)[0].descrizione)).toBe('');
    expect(testoSemplice('<p>Gran partita al PalaRaschi [&hellip;]</p>')).toBe('Gran partita al PalaRaschi');
    expect(estratto('')).toBeNull();
    expect(estratto('uno due tre quattro', 12)).toBe('uno due tre…');
  });

  it('URL di ricerca mese per mese, con le pagine successive', () => {
    expect(urlRicerca('https://www.12tvparma.it', 'club italia', '2026-09')).toBe(
      'https://www.12tvparma.it/?s=club%20italia&m=202609&feed=rss2',
    );
    expect(urlRicerca('https://www.12tvparma.it', 'volley', '2026-09', 2)).toBe(
      'https://www.12tvparma.it/page/2/?s=volley&m=202609&feed=rss2',
    );
  });

  it('mesi della stagione da luglio a oggi; data e ora italiane', () => {
    expect(mesiStagione(2026, new Date('2026-10-29T10:00:00Z'))).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(dataOraRoma('2026-10-24T22:30:00.000Z')).toEqual({ data: '2026-10-25', ora: '00:30' });
  });
});

describe('articoli pertinenti e squadre', () => {
  it('riconosce le squadre a parole intere e rispetta le esclusioni', () => {
    expect(riconosciSquadre('Il Club Italia batte Trento', VOCI)).toEqual(['CLUB ITALIA']);
    expect(riconosciSquadre('Club Italia maschile ko', VOCI)).toEqual([]);
    expect(riconosciSquadre('ENERGY VOLLEY PARMA FESTEGGIA 25 ANNI', VOCI)).toEqual(['ENERGY VOLLEY']);
    expect(riconosciSquadre('Synergy volleyball', VOCI)).toEqual([]);
  });

  it('testata locale: basta la pallavolo; testata di volley: serve Parma o una squadra', () => {
    expect(pertinente(art({ titolo: 'VOLLEY, IL MINERVA RIPARTE' }), VOCI)).toBe(true);
    expect(pertinente(art({ titolo: 'Calcio, il Parma vince' }), VOCI)).toBe(false);
    expect(pertinente(art({ testata: 'ivolley', titolo: 'Lube, vittoria a Verona' }), VOCI)).toBe(false);
    expect(pertinente(art({ testata: 'ivolley', titolo: 'Supercoppa', testo: 'Si gioca al PalaRaschi' }), VOCI)).toBe(true);
    expect(pertinente(art({ testata: 'ivolley', titolo: 'Club Italia, quarta vittoria' }), VOCI)).toBe(true);
  });

  it('unisce per URL e scarta lo stesso servizio ripetuto in due edizioni del TG', () => {
    const r = unisci([
      art({ url: 'https://x/tg-1930/a', titolo: 'MINERVA, DEBUTTO', pubblicato: '2026-10-21T17:30:00.000Z' }),
      art({ url: 'https://x/tg-1245/a', titolo: 'MINERVA, DEBUTTO', pubblicato: '2026-10-21T10:45:00.000Z' }),
      art({ url: 'https://x/altro', titolo: 'Altro', pubblicato: '2026-10-22T10:00:00.000Z' }),
      art({ url: 'https://x/altro', titolo: 'Altro aggiornato', pubblicato: '2026-10-22T10:00:00.000Z' }),
    ]);
    expect(r.map((a) => a.url)).toEqual(['https://x/altro', 'https://x/tg-1245/a']);
    expect(r[0].titolo).toBe('Altro aggiornato');
  });

  it('pubblica articoli della stagione con squadre, manuali ed esclusioni', () => {
    const squadre: Squadra[] = [
      { id: 'techcab', nome: 'TECHCAB ENERGY VOLLEY PARMA', societa: 'ENERGY VOLLEY', comune: 'Parma', parmense: true, campionati: [] },
      { id: 'club-italia', nome: 'CLUB ITALIA', societa: null, comune: 'Parma', parmense: true, campionati: [] },
      { id: 'altra', nome: 'ENERGY VOLLEY', societa: null, comune: 'Altrove', parmense: false, campionati: [] },
    ];
    const config: ConfigRassegna = {
      squadre: VOCI,
      escludi: ['https://x/escluso'],
      articoli: [
        { titolo: 'Club Italia, che rimonta', url: 'https://www.gazzettadiparma.it/sport/a', data: '2026-10-25', testata: 'Gazzetta di Parma' },
      ],
    };
    const r = costruisciRassegna(
      [
        art({ url: 'https://x/energy', titolo: 'ENERGY VOLLEY PARMA, 25 ANNI', pubblicato: '2026-09-13T10:45:00.000Z' }),
        art({ url: 'https://x/escluso', titolo: 'VOLLEY, ESCLUSO' }),
        art({ url: 'https://x/vecchio', titolo: 'VOLLEY, STAGIONE SCORSA', pubblicato: '2026-05-01T10:00:00.000Z' }),
      ],
      config,
      squadre,
      '2026/27',
      '2026-07-01',
    );
    expect(r.articoli.map((a) => [a.data, a.testata, a.squadre])).toEqual([
      ['2026-10-25', 'gazzetta-di-parma', ['club-italia']],
      ['2026-09-13', '12tvparma', ['techcab']],
    ]);
    expect(r.testate.find((t) => t.id === 'gazzetta-di-parma')).toEqual({
      id: 'gazzetta-di-parma',
      nome: 'Gazzetta di Parma',
      url: 'https://www.gazzettadiparma.it',
    });
  });
});

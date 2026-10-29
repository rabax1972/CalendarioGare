import { describe, expect, it } from 'vitest';
import { eta, filtraRosa, type FilePrivacy } from '../src/rose.ts';
import { parseRosaCsen, parseSquadreCsen } from '../src/sources/csen.ts';
import { parseClubLvf, parseNascitaLvf, parseRosaLvf } from '../src/sources/lvf.ts';

// HTML ricalcato sulla struttura reale delle fonti, con persone inventate: niente dati personali veri nel repository.

const ROSA_CSEN = `<table><tbody>
<tr class="rosa-riga" data-foto="/Squadre/FotoGiocatore/1?v=a" data-nome="Mario" data-cognome="Rossi" data-numero="7" data-ruolo="Centrale" data-sesso="Maschile"><td></td></tr>
<tr class="rosa-riga" data-foto="" data-nome="Anna" data-cognome="Bianchi" data-numero="3" data-ruolo="Libero" data-sesso="Femminile"><td></td></tr>
</tbody></table>`;

const SQUADRE_CSEN = `
<div class="card squadra-card"><div class="card-body"><h2 class="card-title">CUS 3</h2><a href="/Squadre/Dettaglio/41">Vedi la rosa</a></div></div>
<div class="card squadra-card"><div class="card-body"><h2 class="card-title">EMBOLO</h2><a href="/Squadre/Dettaglio/9">Vedi la rosa</a></div></div>`;

const ROSA_LVF = `
<div class="scheda-giocatrice-squadra"><div class="num-giocatrice"> 4 </div>
  <div class="foto"><img src="https://ww1.legavolleyfemminile.it/Foto.aspx?Key=VER-GIU-08&sqid=1&heightImg=254"></div>
  <div class="dati"><h2>Giulia</h2><h2>Verdi</h2><p>Centrale</p><div class="vai-al"><a href="https://www.legavolleyfemminile.it/player/verdi-giulia/VER-GIU-08/">Vai al profilo</a></div></div></div>
<div class="scheda-giocatrice-squadra"><div class="num-giocatrice">  </div>
  <div class="foto"><img src="https://ww1.legavolleyfemminile.it/Foto.aspx?Key=NER-PAO-70&sqid=1&heightImg=254"></div>
  <div class="dati"><h2>Paolo</h2><h2>Neri</h2><p>1st Coach</p></div></div>`;

const CALENDARIO_LVF = `
<a href="https://www.legavolleyfemminile.it/calendario/?serie=2&stagione=2026&club=710958">Club Italia</a>
<a href="https://www.legavolleyfemminile.it/calendario/?serie=2&stagione=2026&club=710958">TUTTE</a>
<a href="https://www.legavolleyfemminile.it/club/club-italia/710958/">Club Italia</a>`;

const privacy = (over: Partial<FilePrivacy> = {}): FilePrivacy => ({
  contatto: '',
  nascondiRose: [],
  nascondiAtleti: [],
  nascondiFoto: [],
  ...over,
});

describe('parser rose', () => {
  it('CSEN: elenco squadre e rosa con foto assoluta', () => {
    expect(parseSquadreCsen(SQUADRE_CSEN).map((s) => [s.nome, s.id])).toEqual([['CUS 3', '41'], ['EMBOLO', '9']]);
    expect(parseRosaCsen(ROSA_CSEN)).toEqual([
      {
        numero: '7',
        nome: 'Mario',
        cognome: 'Rossi',
        ruolo: 'Centrale',
        foto: 'https://www.volleymistocsenparma.it/Squadre/FotoGiocatore/1?v=a',
      },
      { numero: '3', nome: 'Anna', cognome: 'Bianchi', ruolo: 'Libero', foto: null },
    ]);
  });

  it('LVF: rosa con staff, foto ridotta e profilo; club con pagina; data di nascita', () => {
    const r = parseRosaLvf(ROSA_LVF);
    expect(r[0]).toMatchObject({ numero: '4', nome: 'Giulia', cognome: 'Verdi', ruolo: 'Centrale' });
    expect(r[0].foto).toContain('heightImg=160');
    expect(r[1]).toMatchObject({ numero: null, ruolo: '1st Coach', profilo: null });
    expect(parseClubLvf(CALENDARIO_LVF)).toEqual([
      { id: '710958', nome: 'Club Italia', url: 'https://www.legavolleyfemminile.it/club/club-italia/710958/' },
    ]);
    expect(parseNascitaLvf('<p>Data di nascita: 02/04/2008</p>')).toBe('2008-04-02');
    expect(parseNascitaLvf('<p>nessuna data</p>')).toBeNull();
  });
});

describe('tutela dei minori e richieste di rimozione', () => {
  const atleta = (cognome: string, nascita: string | null, foto = 'https://x/f.jpg') => ({
    numero: '1',
    nome: 'Prova',
    cognome,
    ruolo: null,
    foto,
    nascita,
  });

  it("calcola l'età compiuta", () => {
    expect(eta('2008-10-26', '2026-10-26')).toBe(18);
    expect(eta('2008-10-27', '2026-10-26')).toBe(17);
  });

  it('non mostra la foto dei minorenni né di chi non ha età verificabile, e non pubblica la data di nascita', () => {
    const r = filtraRosa(
      [atleta('Adulta', '2000-01-01'), atleta('Minore', '2010-01-01'), atleta('Ignota', null)],
      privacy(),
      '2026-10-26',
      true,
    );
    expect(r.atleti.map((a) => [a.cognome, Boolean(a.foto)])).toEqual([['Adulta', true], ['Ignota', false], ['Minore', false]]);
    expect(r.fotoNascoste).toBe(2);
    expect(r.atleti.every((a) => !('nascita' in a))).toBe(true);
  });

  it('senza obbligo di età (torneo adulti) mostra le foto disponibili', () => {
    const r = filtraRosa([atleta('Senza data', null)], privacy(), '2026-10-26', false);
    expect(r.atleti[0].foto).not.toBeNull();
  });

  it('applica le esclusioni di data/privacy.json, in qualunque ordine nome/cognome', () => {
    const r = filtraRosa(
      [atleta('Rossi', '1990-01-01'), atleta('Bianchi', '1990-01-01')],
      privacy({ nascondiAtleti: ['Rossi Prova'], nascondiFoto: ['prova bianchi'] }),
      '2026-10-26',
      true,
    );
    expect(r.atleti.map((a) => [a.cognome, a.foto])).toEqual([['Bianchi', null]]);
  });
});

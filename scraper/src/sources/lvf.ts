import * as cheerio from 'cheerio';
import { dataIso, pulisciSpazi } from '../normalize.ts';

// Lega Volley Femminile (A1/A2 F): usata solo per loghi e rose, il calendario arriva dal feed federale.
// robots.txt: vieta solo /upload/. Vedi docs/FONTI.md §5–6.

export const SERIE_LVF: Record<string, string> = { 'naz-a1-f': '1', 'naz-a2-f': '2' };

export function urlCalendarioLvf(serie: string, anno: string): string {
  return `https://www.legavolleyfemminile.it/calendario/?serie=${serie}&campionato=0&stagione=${anno}`;
}

export function urlLogoLvf(idClub: string): string {
  return `https://ww5.legavolleyfemminile.it/imgSocietaSquadra.aspx?idImg=${idClub}`;
}

export interface ClubLvf {
  id: string;
  nome: string;
  /** Pagina del club, es. https://www.legavolleyfemminile.it/club/club-italia/710958/ */
  url: string | null;
}

/** Club dalla pagina calendario: nomi dai link "club=<id>", pagine dai link "/club/<slug>/<id>/". */
export function parseClubLvf(html: string): ClubLvf[] {
  const $ = cheerio.load(html);
  const club = new Map<string, ClubLvf>();
  $('a[href*="club="]').each((_, a) => {
    const id = /club=(\d+)/.exec($(a).attr('href') ?? '')?.[1];
    const nome = pulisciSpazi($(a).text());
    if (id && nome && !/^tutt[ei]$/i.test(nome) && !club.has(id)) club.set(id, { id, nome, url: null });
  });
  $('a[href*="/club/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = /\/club\/[^/]+\/(\d+)\/?$/.exec(href);
    const c = m && club.get(m[1]);
    if (c && !c.url) c.url = new URL(href, 'https://www.legavolleyfemminile.it').toString().replace(/\/?$/, '/');
  });
  return [...club.values()];
}

export interface AtletaLvf {
  numero: string | null;
  nome: string;
  cognome: string;
  ruolo: string | null;
  foto: string | null;
  profilo: string | null;
}

/** Pagina roster del club: una ".scheda-giocatrice-squadra" per atleta. */
export function parseRosaLvf(html: string): AtletaLvf[] {
  const $ = cheerio.load(html);
  return $('.scheda-giocatrice-squadra')
    .toArray()
    .map((el) => {
      const s = $(el);
      const nomi = s.find('.dati h2').toArray().map((h) => pulisciSpazi($(h).text()));
      const src = s.find('.foto img').attr('src') ?? null;
      return {
        numero: pulisciSpazi(s.find('.num-giocatrice').text()) || null,
        nome: nomi[0] ?? '',
        cognome: nomi[1] ?? '',
        ruolo: pulisciSpazi(s.find('.dati p').first().text()) || null,
        // Formato più piccolo di quello della pagina (254 px): basta per le figurine dell'app.
        foto: src ? src.replace(/heightImg=\d+/, 'heightImg=160') : null,
        profilo: s.find('.vai-al a').attr('href') ?? null,
      };
    })
    .filter((a) => a.nome || a.cognome);
}

/** "Data di nascita: 02/04/2008" dal profilo atleta. */
export function parseNascitaLvf(html: string): string | null {
  const testo = pulisciSpazi(cheerio.load(html).root().text());
  const m = /Data di nascita:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(testo);
  return m ? dataIso(m[1]) : null;
}

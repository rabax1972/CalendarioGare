import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { scarica } from '../http.ts';
import { dataIso, numero, oraIso, parziale, pulisciSpazi, slug, titoloCase } from '../normalize.ts';
import type { CampionatoGrezzo, ClassificaGrezza, Fonte, PartitaGrezza, Snapshot } from '../types.ts';

const BASE = 'https://www.volleymistocsenparma.it';
export const CSEN_CAMPIONATO_ID = 'csen-misto';

interface Luogo {
  palestra: string | null;
  indirizzo: string | null;
  comune: string | null;
  provincia: string | null;
}

/** Interpreta il campo "location" del link Google Calendar: "Palestra, Via X, 1, 43122 Parma PR". */
export function interpretaLuogo(location: string | null): Luogo {
  if (!location) return { palestra: null, indirizzo: null, comune: null, provincia: null };
  const parti = location.split(',').map((p) => pulisciSpazi(p)).filter(Boolean);
  const palestra = parti[0] ?? null;
  if (parti.length < 2) return { palestra, indirizzo: null, comune: null, provincia: null };
  const ultima = parti[parti.length - 1];
  const m = /^(\d{5})\s+(.+?)(?:\s+([A-Z]{2}))?$/.exec(ultima);
  if (m) {
    return {
      palestra,
      indirizzo: parti.slice(1, -1).join(', ') || null,
      comune: titoloCase(m[2]),
      provincia: m[3] ?? null,
    };
  }
  // Senza CAP l'ultima parte è un comune solo se prima c'è anche un indirizzo ("Pala Casalini, Pala-Casalini" no).
  if (parti.length < 3) return { palestra, indirizzo: null, comune: null, provincia: null };
  return {
    palestra,
    indirizzo: parti.slice(1, -1).join(', ') || null,
    comune: titoloCase(ultima),
    provincia: null,
  };
}

/** "era Mercoledì 16/12 20:00" → data con anno dedotto da quella della gara. */
function dataOriginale(testo: string, dataGara: string | null): { data: string | null; ora: string | null } {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(testo);
  const ora = oraIso(testo.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/, ''));
  if (!m) return { data: null, ora };
  if (m[3]) return { data: dataIso(m[0]), ora };
  const annoGara = dataGara ? Number(dataGara.slice(0, 4)) : new Date().getFullYear();
  const meseGara = dataGara ? Number(dataGara.slice(5, 7)) : 1;
  const mese = Number(m[2]);
  let anno = annoGara;
  if (mese - meseGara > 6) anno--;
  if (meseGara - mese > 6) anno++;
  return { data: dataIso(`${m[1]}/${m[2]}/${anno}`), ora };
}

function etichettaStagioneCsen($: cheerio.CheerioAPI): string {
  const testo = pulisciSpazi($('#filtro-stagione option[selected]').first().text()); // "2026-27"
  return testo.replace('-', '/') || '';
}

function gironeDiTabella($: cheerio.CheerioAPI, table: Element): string | null {
  const titolo = pulisciSpazi($(table).closest('.table-responsive').prevAll('h2').first().text());
  const m = /Girone\s+(\S+)/i.exec(titolo);
  return m ? m[1] : titolo || null;
}

export function parseCalendarioCsen(html: string, fonteUrl: string) {
  const $ = cheerio.load(html);
  const stagione = etichettaStagioneCsen($);
  const partite: PartitaGrezza[] = [];
  const gironi = new Set<string>();

  $('table').each((_, table) => {
    const girone = gironeDiTabella($, table);
    if (girone) gironi.add(girone);
    let giornata: number | null = null;

    $(table)
      .find('tbody > tr')
      .each((__, tr) => {
        const $tr = $(tr);
        if ($tr.hasClass('calendario-giornata')) {
          const m = /Giornata\s+(\d+)/i.exec($tr.text());
          giornata = m ? Number(m[1]) : null;
          return;
        }
        const td = $tr.children('td');
        if (td.length < 8) return;

        const cellaData = td.eq(1);
        const testoData = pulisciSpazi(cellaData.clone().children().remove().end().text());
        const data = dataIso(testoData);
        const ora = oraIso(testoData.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/, ''));
        const spostataTesto = pulisciSpazi(cellaData.find('.text-muted').text());
        const eSpostata = /spostat/i.test(cellaData.find('.badge').text()) || $tr.hasClass('table-info');

        const casa = pulisciSpazi(td.eq(2).text());
        const ospite = pulisciSpazi(td.eq(4).text());
        const cellaLuogo = td.eq(5);
        const nomeLuogo = pulisciSpazi(cellaLuogo.clone().find('a').remove().end().text());
        const osm = cellaLuogo.find('a[href*="openstreetmap"]').attr('href') ?? '';
        const lat = numero(/mlat=([-\d.]+)/.exec(osm)?.[1]);
        const lon = numero(/mlon=([-\d.]+)/.exec(osm)?.[1]);

        const cellaRis = td.eq(7);
        const gcal = cellaRis.find('a[href*="calendar.google.com"]').attr('href');
        const location = gcal ? new URL(gcal).searchParams.get('location') : null;
        const luogo = interpretaLuogo(location);

        const badge = pulisciSpazi(cellaRis.find('.badge').first().text());
        const set = cellaRis
          .find('.text-muted')
          .text()
          .split(',')
          .map((p) => parziale(p))
          .filter((p): p is [number, number] => p !== null);
        const ris = /^(\d+)\s*-\s*(\d+)$/.exec(badge);
        let stato: PartitaGrezza['stato'] = 'da_giocare';
        if (ris) stato = 'giocata';
        else if (/rinvi|sospes|da definire/i.test(badge) || (!data && !ris)) stato = 'rinviata';

        const numeroGara = pulisciSpazi(td.eq(0).text());
        const nGara = /^\d+$/.test(numeroGara) ? numeroGara : null;
        const idBase = nGara ?? `${slug(casa)}-${slug(ospite)}-${giornata ?? data ?? ''}`;

        partite.push({
          id: `csen-${slug(stagione)}-${idBase}`,
          campionatoId: CSEN_CAMPIONATO_ID,
          girone,
          giornata,
          numeroGara: nGara,
          data,
          ora,
          palestra: nomeLuogo || luogo.palestra,
          indirizzo: luogo.indirizzo,
          comune: luogo.comune,
          ...(lat != null && lon != null ? { lat, lon } : {}),
          casa: { nome: casa },
          ospite: { nome: ospite },
          set,
          punteggio: ris ? { casa: Number(ris[1]), ospite: Number(ris[2]) } : null,
          stato,
          ...(eSpostata ? { spostata: dataOriginale(spostataTesto, data) } : {}),
          fonteUrl,
          provinciaPalestra: luogo.provincia,
        });
      });
  });

  return { stagione, partite, gironi: [...gironi] };
}

export function parseClassificaCsen(html: string, fonteUrl: string): ClassificaGrezza[] {
  const $ = cheerio.load(html);
  const classifiche: ClassificaGrezza[] = [];
  $('table').each((_, table) => {
    const girone = gironeDiTabella($, table);
    const righe: ClassificaGrezza['righe'] = [];
    $(table)
      .find('tbody > tr')
      .each((__, tr) => {
        const c = $(tr)
          .children('td')
          .map((___, td) => pulisciSpazi($(td).text()))
          .get();
        if (c.length < 8) return;
        righe.push({
          posizione: numero(c[0]) ?? righe.length + 1,
          squadra: { nome: c[1] },
          punti: numero(c[2]) ?? 0,
          giocate: numero(c[3]) ?? 0,
          vinte: numero(c[4]) ?? 0,
          perse: numero(c[5]) ?? 0,
          setVinti: numero(c[6]) ?? 0,
          setPersi: numero(c[7]) ?? 0,
          puntiFatti: numero(c[9]),
          puntiSubiti: numero(c[10]),
        });
      });
    if (righe.length) {
      classifiche.push({
        campionatoId: CSEN_CAMPIONATO_ID,
        girone,
        titolo: girone ? `Girone ${girone}` : 'Classifica',
        fonteUrl,
        righe,
      });
    }
  });
  return classifiche;
}

/** Loghi dalla pagina Squadre: <img src="/Squadre/Logo/2?v=…" alt="Logo BONGIO AZUL">. */
export function parseLoghiCsen(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const loghi = new Map<string, string>();
  $('img[src*="/Squadre/Logo/"]').each((_, img) => {
    const nome = pulisciSpazi(($(img).attr('alt') ?? '').replace(/^Logo\s+/i, ''));
    const src = $(img).attr('src');
    if (nome && src) loghi.set(nome, new URL(src, BASE).toString());
  });
  return loghi;
}

/** Squadre della pagina Squadre con l'id della pagina rosa (/Squadre/Dettaglio/<id>). */
export function parseSquadreCsen(html: string): { nome: string; id: string; url: string }[] {
  const $ = cheerio.load(html);
  return $('.squadra-card')
    .toArray()
    .map((card) => {
      const href = $(card).find('a[href*="/Squadre/Dettaglio/"]').attr('href') ?? '';
      return { nome: pulisciSpazi($(card).find('.card-title').text()), id: /Dettaglio\/(\d+)/.exec(href)?.[1] ?? '', url: new URL(href || '/', BASE).toString() };
    })
    .filter((s) => s.nome && s.id);
}

/** Rosa: una <tr class="rosa-riga"> per giocatore, con i dati negli attributi data-*. */
export function parseRosaCsen(html: string) {
  const $ = cheerio.load(html);
  return $('tr.rosa-riga')
    .toArray()
    .map((tr) => {
      const r = $(tr);
      const foto = r.attr('data-foto');
      return {
        numero: pulisciSpazi(r.attr('data-numero') ?? '') || null,
        nome: pulisciSpazi(r.attr('data-nome') ?? ''),
        cognome: pulisciSpazi(r.attr('data-cognome') ?? ''),
        ruolo: pulisciSpazi(r.attr('data-ruolo') ?? '') || null,
        foto: foto ? new URL(foto, BASE).toString() : null,
      };
    })
    .filter((a) => a.nome || a.cognome);
}

export const URL_SQUADRE_CSEN = `${BASE}/Squadre`;

export function campionatoCsen(stagione: string, gironi: string[]): CampionatoGrezzo {
  return {
    id: CSEN_CAMPIONATO_ID,
    nome: 'Misto CSEN Parma',
    nomeBreve: 'Misto CSEN',
    livello: 'provinciale',
    federazione: 'CSEN',
    genere: 'misto',
    categoria: 'Open misto',
    stagione,
    fonte: 'csen',
    fonteUrl: `${BASE}/Calendario`,
    gironi,
  };
}

export const fonteCsen: Fonte = {
  id: 'csen',
  nome: 'CSEN Parma – Torneo misto',
  abilitata: true,
  minimoPartite: 10,
  async esegui(ctx) {
    const urlCal = `${BASE}/Calendario`;
    const urlClass = `${BASE}/Classifica`;
    const cal = parseCalendarioCsen(await scarica(urlCal), urlCal);
    const classifiche = parseClassificaCsen(await scarica(urlClass), urlClass);
    // I loghi sono un di più: se la pagina Squadre non risponde, calendario e classifiche valgono comunque.
    const loghi = await scarica(`${BASE}/Squadre`)
      .then(parseLoghiCsen)
      .catch(() => new Map<string, string>());
    const conLogo = (s: { nome: string; logoUrl?: string | null }) => {
      const url = loghi.get(s.nome);
      if (url) s.logoUrl = url;
    };
    cal.partite.forEach((p) => (conLogo(p.casa), conLogo(p.ospite)));
    classifiche.forEach((c) => c.righe.forEach((r) => conLogo(r.squadra)));
    ctx.log(
      `CSEN: ${cal.partite.length} partite, ${classifiche.length} classifiche, ${loghi.size} loghi (stagione ${cal.stagione})`,
    );
    const snap: Snapshot = {
      fonte: 'csen',
      aggiornatoIl: new Date().toISOString(),
      stagione: cal.stagione,
      filtroParma: false,
      campionati: [campionatoCsen(cal.stagione, cal.gironi)],
      partite: cal.partite,
      classifiche,
    };
    return snap;
  },
};

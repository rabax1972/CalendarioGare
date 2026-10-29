import * as cheerio from 'cheerio';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, TTL_SCOPERTA_MS } from '../config.ts';
import { scarica } from '../http.ts';
import { dataIso, numero, oraIso, parziale, pulisciSpazi, separaProvincia, slug, titoloCase } from '../normalize.ts';
import type {
  CampionatoGrezzo,
  ClassificaGrezza,
  ContestoFonte,
  Fonte,
  PartitaGrezza,
  SquadraGrezza,
} from '../types.ts';

// Portale FIPAV del Comitato Regionale Emilia-Romagna (vedi docs/FONTI.md §3).
const BASE = 'https://crer.portalefipav.net';
const PAGINA = `${BASE}/risultati-classifiche.aspx?PId=29422`;
const COMITATO_ID = '35';

export interface GironeCrer {
  cid: string;
  etichetta: string;
}

export interface IndiceCrer {
  stId: string;
  stagione: string;
  gironi: GironeCrer[];
}

export function urlGironeCrer(stId: string, cid: string): string {
  return `${BASE}/risultati-classifiche.aspx?ComitatoId=${COMITATO_ID}&StId=${stId}&DataDa=&StatoGara=&CId=${cid}&SId=&PId=29422&btFiltro=CERCA`;
}

export function urlClassificaCrer(cid: string): string {
  return `${BASE}/classifica.aspx?CId=${cid}`;
}

/** Legge stagione corrente ed elenco gironi dalla pagina principale. */
export function parseIndiceCrer(html: string): IndiceCrer {
  const $ = cheerio.load(html);
  const st = $('select[name="StId"] option[selected]').first();
  const stId = st.attr('value') ?? '';
  const m = /(\d{4})\s*\/\s*(\d{4})/.exec(st.text());
  const stagione = m ? `${m[1]}/${m[2].slice(2)}` : '';
  const gironi: GironeCrer[] = [];
  $('select[name="CId"] option').each((_, o) => {
    const cid = $(o).attr('value') ?? '';
    const etichetta = pulisciSpazi($(o).text());
    // Il gruppo "CAMPIONATI NAZIONALI" contiene solo le gare nazionali giocate in ER: non è completo.
    if (!cid || /nazional/i.test(etichetta)) return;
    gironi.push({ cid, etichetta });
  });
  return { stId, stagione, gironi };
}

interface Categoria {
  id: string;
  nome: string;
  nomeBreve: string;
  categoria: string;
  genere: 'maschile' | 'femminile' | 'misto';
  girone: string | null;
}

/** "CM Gir. A" → Serie C maschile, girone A; "17FB" → Under 17 femminile, girone B. */
export function interpretaEtichettaCrer(etichetta: string): Categoria {
  const e = pulisciSpazi(etichetta).toUpperCase();
  const genereDa = (g: string) => (g === 'F' ? 'femminile' : g === 'M' ? 'maschile' : 'misto') as Categoria['genere'];
  let m = /^([A-Z0-9]{1,2}?)([MFX])\s+GIR\.?\s*(\w+)$/.exec(e);
  if (m) {
    const serie = m[1];
    const genere = genereDa(m[2]);
    const categoria = /^\d$/.test(serie) ? `${serie}ª Divisione` : `Serie ${serie}`;
    return {
      id: `crer-${slug(categoria)}-${m[2].toLowerCase()}`,
      nome: `${categoria} ${genere}`,
      nomeBreve: `${serie} ${m[2]}`,
      categoria,
      genere,
      girone: m[3],
    };
  }
  m = /^(\d{2})([MFX])\s*([A-Z0-9]?)$/.exec(e);
  if (m) {
    const genere = genereDa(m[2]);
    return {
      id: `crer-u${m[1]}-${m[2].toLowerCase()}`,
      nome: `Under ${m[1]} ${genere} regionale`,
      nomeBreve: `U${m[1]} ${m[2]} reg.`,
      categoria: `Under ${m[1]}`,
      genere,
      girone: m[3] || null,
    };
  }
  const genere = /\bF\b|FEMM/.test(e) ? 'femminile' : /\bM\b|MASCH/.test(e) ? 'maschile' : 'misto';
  return { id: `crer-${slug(e)}`, nome: etichetta, nomeBreve: etichetta.slice(0, 10), categoria: etichetta, genere, girone: null };
}

function squadraDaCella($: cheerio.CheerioAPI, td: cheerio.Cheerio<any>): SquadraGrezza {
  const nome = pulisciSpazi(td.text());
  const logo = td.find('img').attr('src') ?? '';
  const idSoc = /LogoS(\d+)/.exec(logo)?.[1] ?? /Societa\/img\/(\d+)\//.exec(logo)?.[1] ?? null;
  return {
    nome,
    societa: pulisciSpazi(td.attr('title') ?? '') || null,
    provincia: separaProvincia(nome).provincia,
    idSocietaFonte: idSoc,
  };
}

/** Il tooltip info contiene HTML: palestra in <b>, poi "COMUNE PR", poi indirizzo. */
export function interpretaInfoPalestra(titoloHtml: string | undefined) {
  if (!titoloHtml) return { palestra: null, comune: null, provincia: null, indirizzo: null };
  const $ = cheerio.load(titoloHtml);
  const p = $('p').first();
  const palestra = pulisciSpazi(p.find('b').first().text()) || null;
  const righe = (p.html() ?? '')
    .split(/<br\s*\/?>/i)
    .slice(1)
    .map((r) => pulisciSpazi(cheerio.load(r).text()))
    .filter(Boolean);
  const loc = separaProvincia(righe[0] ?? '');
  return {
    palestra,
    comune: loc.nome ? titoloCase(loc.nome) : null,
    provincia: loc.provincia,
    indirizzo: righe[1] ? titoloCase(righe[1]) : null,
  };
}

export function parseGironeCrer(html: string, fonteUrl: string) {
  const $ = cheerio.load(html);
  const partite: PartitaGrezza[] = [];
  const etichette = new Set<string>();

  $('table.tbl-risultati').each((_, table) => {
    const etichetta = pulisciSpazi($(table).find('caption').first().contents().first().text());
    if (/nazional/i.test(etichetta)) return;
    etichette.add(etichetta);
    const cat = interpretaEtichettaCrer(etichetta);

    $(table)
      .find('tbody > tr')
      .each((__, tr) => {
        const td = $(tr).children('td');
        if (td.length < 8) return;
        const idGara = /Risultato_(\d+)/.exec(td.eq(5).attr('id') ?? '')?.[1];
        if (!idGara) return;
        const testoData = pulisciSpazi(td.eq(2).text());
        const data = dataIso(testoData);
        const ora = oraIso(testoData.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/, ''));
        const ris = /^(\d+)\s*-\s*(\d+)$/.exec(pulisciSpazi(td.eq(5).text()));
        // toArray() e non .map() di cheerio, che appiattirebbe le coppie.
        const set = td
          .eq(6)
          .find('.parziali')
          .toArray()
          .map((s) => parziale($(s).text()))
          .filter((p): p is [number, number] => p !== null);
        const titoloStato = ($(td.eq(7)).find('[id^="StatoGara_"] img').attr('title') ?? '').toLowerCase();
        const info = interpretaInfoPalestra(td.eq(7).find('img[alt="info"]').attr('title'));

        let stato: PartitaGrezza['stato'] = ris ? 'giocata' : 'da_giocare';
        if (!ris && (/rinvi|sospes|da definire|recuper/.test(titoloStato) || !data)) stato = 'rinviata';

        partite.push({
          id: `crer-${idGara}`,
          campionatoId: cat.id,
          girone: cat.girone,
          giornata: numero(pulisciSpazi(td.eq(1).text())),
          numeroGara: pulisciSpazi(td.eq(0).text()) || null,
          data,
          ora,
          palestra: info.palestra,
          indirizzo: info.indirizzo,
          comune: info.comune,
          casa: squadraDaCella($, td.eq(3)),
          ospite: squadraDaCella($, td.eq(4)),
          set,
          punteggio: ris ? { casa: Number(ris[1]), ospite: Number(ris[2]) } : null,
          stato,
          ...(/spostat|variat/.test(titoloStato) ? { spostata: { data: null, ora: null } } : {}),
          risultatoUfficiale: /omologat/.test(titoloStato),
          fonteUrl,
          provinciaPalestra: info.provincia,
        });
      });
  });
  return { partite, etichette: [...etichette] };
}

export function parseClassificaCrer(html: string, etichetta: string, fonteUrl: string): ClassificaGrezza | null {
  const $ = cheerio.load(html);
  const cat = interpretaEtichettaCrer(etichetta);
  const righe: ClassificaGrezza['righe'] = [];
  $('table.tbl-classifica tr').each((_, tr) => {
    const td = $(tr).children('td');
    if (td.length < 11) return;
    const c = td.map((__, x) => pulisciSpazi($(x).text())).get();
    righe.push({
      posizione: numero(c[0]) ?? righe.length + 1,
      squadra: squadraDaCella($, td.eq(1)),
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
  if (!righe.length) return null;
  return {
    campionatoId: cat.id,
    girone: cat.girone,
    titolo: cat.girone ? `${cat.nome} – girone ${cat.girone}` : cat.nome,
    fonteUrl,
    righe,
  };
}

export function campionatoCrer(etichetta: string, stagione: string, gironi: string[]): CampionatoGrezzo {
  const cat = interpretaEtichettaCrer(etichetta);
  return {
    id: cat.id,
    nome: cat.nome,
    nomeBreve: cat.nomeBreve,
    livello: 'regionale',
    federazione: 'FIPAV',
    genere: cat.genere,
    categoria: cat.categoria,
    stagione,
    fonte: 'crer',
    fonteUrl: PAGINA,
    gironi,
  };
}

interface StatoScoperta {
  stId: string;
  chiaveConfig: string;
  quando: number;
  gironiParma: string[];
}

const FILE_SCOPERTA = path.join(CACHE_DIR, 'scoperta-crer.json');

async function leggiScoperta(): Promise<StatoScoperta | null> {
  try {
    return JSON.parse(await readFile(FILE_SCOPERTA, 'utf8'));
  } catch {
    return null;
  }
}

function contieneParma(partite: PartitaGrezza[], ctx: ContestoFonte) {
  return partite.some((p) => ctx.isParma(p.casa, p.provinciaPalestra) || ctx.isParma(p.ospite));
}

export const fonteCrer: Fonte = {
  id: 'crer',
  nome: 'FIPAV Emilia-Romagna – campionati regionali',
  abilitata: true,
  minimoPartite: 10,
  async esegui(ctx) {
    const indice = parseIndiceCrer(await scarica(PAGINA));
    if (!indice.stId || !indice.gironi.length) throw new Error('Indice campionati regionali vuoto: struttura cambiata?');

    const precedente = await leggiScoperta();
    const scopertaValida =
      precedente &&
      precedente.stId === indice.stId &&
      precedente.chiaveConfig === ctx.chiaveConfig &&
      Date.now() - precedente.quando < TTL_SCOPERTA_MS;

    const daScaricare = scopertaValida
      ? indice.gironi.filter((g) => precedente.gironiParma.includes(g.cid))
      : indice.gironi;
    ctx.log(
      `CRER: stagione ${indice.stagione} (StId ${indice.stId}), ${indice.gironi.length} gironi, ` +
        (scopertaValida ? `scarico i ${daScaricare.length} con squadre di Parma` : 'scoperta completa'),
    );

    const partite: PartitaGrezza[] = [];
    const classifiche: ClassificaGrezza[] = [];
    const gironiParma: GironeCrer[] = [];
    for (const g of daScaricare) {
      const url = urlGironeCrer(indice.stId, g.cid);
      const { partite: pg } = parseGironeCrer(await scarica(url), url);
      if (!contieneParma(pg, ctx)) continue;
      gironiParma.push(g);
      partite.push(...pg);
      const urlC = urlClassificaCrer(g.cid);
      const cl = parseClassificaCrer(await scarica(urlC), g.etichetta, urlC);
      if (cl) classifiche.push(cl);
    }

    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(
      FILE_SCOPERTA,
      JSON.stringify({
        stId: indice.stId,
        chiaveConfig: ctx.chiaveConfig,
        quando: scopertaValida ? precedente.quando : Date.now(),
        gironiParma: gironiParma.map((g) => g.cid),
      } satisfies StatoScoperta),
    );

    const perCampionato = new Map<string, { etichetta: string; gironi: string[] }>();
    for (const g of gironiParma) {
      const cat = interpretaEtichettaCrer(g.etichetta);
      const voce = perCampionato.get(cat.id) ?? { etichetta: g.etichetta, gironi: [] };
      if (cat.girone) voce.gironi.push(cat.girone);
      perCampionato.set(cat.id, voce);
    }

    return {
      fonte: 'crer',
      aggiornatoIl: new Date().toISOString(),
      stagione: indice.stagione,
      filtroParma: true,
      campionati: [...perCampionato.values()].map((v) => campionatoCrer(v.etichetta, indice.stagione, v.gironi)),
      partite,
      classifiche,
    };
  },
};

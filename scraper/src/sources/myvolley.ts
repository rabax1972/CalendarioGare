import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, TTL_SCOPERTA_MS, etichettaStagione, stagioneCorrente } from '../config.ts';
import { scaricaJson } from '../http.ts';
import { dataIso, numero, oraIso, pulisciSpazi, titoloCase } from '../normalize.ts';
import type { CampionatoGrezzo, ClassificaGrezza, ContestoFonte, Fonte, PartitaGrezza, SquadraGrezza } from '../types.ts';

// JSON pubblici usati da federvolley.it/campionati/serie-a-b (vedi docs/FONTI.md §4).
const BASE = 'https://media.myvolley.net/public/json';
const PAGINA_FEDERVOLLEY = 'https://www.federvolley.it/campionati/serie-a-b';

/** Serie nazionali considerate (le coppe sono escluse). */
export const SERIE_NAZIONALI = ['A1', 'A2', 'A3', 'B', 'B1', 'B2'];

// Solo i campi che usiamo: il feed contiene anche contatti e nomi di referenti e arbitri, da non ripubblicare.
export interface TeamMv {
  id: string;
  name: string;
  logo?: string;
  city?: string;
  province?: string;
  cod_aff_societa?: string;
}

export interface MatchMv {
  id: string;
  giornata?: string;
  date?: string;
  time?: string;
  impianto?: { denominazione?: string; indirizzo?: string; localita?: string; provincia?: string };
  'lat-stadium'?: string;
  'lng-stadium'?: string;
  played?: boolean;
  ris_ufficiale?: string;
  'team1-setwin'?: number;
  'team2-setwin'?: number;
  pt_a?: number[];
  pt_b?: number[];
  team1: TeamMv;
  team2: TeamMv;
}

export interface CalendarioMv {
  data: { title: string; season: string; matches: MatchMv[] };
}

export interface ClassificaMv {
  data: {
    serie: string;
    sesso: string;
    girone: string;
    teams: {
      position: number;
      team: TeamMv;
      points: number;
      played: number;
      won: number;
      lost: number;
      sets_won: number;
      sets_lost: number;
      points_won?: number;
      points_lost?: number;
    }[];
  };
}

interface VoceIndice {
  path: string;
  series: string;
  sex: string;
  girone: string;
}

export interface GironeMv {
  anno: string;
  serie: string;
  sesso: string;
  girone: string;
}

const percorso = (g: GironeMv) => `${g.anno}/${g.serie}/${g.sesso}/${g.girone}`;
export const urlFedervolley = (g: GironeMv) => `${PAGINA_FEDERVOLLEY}#calendario/${percorso(g)}`;

export function squadraMv(t: TeamMv): SquadraGrezza {
  return {
    nome: pulisciSpazi(t.name),
    comune: t.city ? titoloCase(t.city) : null,
    provincia: t.province || null,
    codiceSocieta: t.cod_aff_societa || null,
    // "fallback.png" è il segnaposto generico del feed.
    ...(t.logo && !/fallback\.png$/i.test(t.logo) ? { logoUrl: t.logo } : {}),
  };
}

export function campionatoMv(g: GironeMv, gironi: string[]): CampionatoGrezzo {
  const genere = g.sesso === 'F' ? 'femminile' : 'maschile';
  return {
    id: `naz-${g.serie.toLowerCase()}-${g.sesso.toLowerCase()}`,
    nome: `Serie ${g.serie} ${genere}`,
    nomeBreve: `${g.serie} ${g.sesso}`,
    livello: 'nazionale',
    federazione: 'FIPAV',
    genere,
    categoria: `Serie ${g.serie}`,
    stagione: etichettaStagione(Number(g.anno)),
    fonte: 'myvolley',
    fonteUrl: PAGINA_FEDERVOLLEY,
    gironi: gironi.filter((x) => x !== 'U'),
  };
}

const eRiposo = (t: TeamMv) => !t?.name || t.id === '9999';

export function convertiCalendarioMv(cal: CalendarioMv, g: GironeMv): PartitaGrezza[] {
  const camp = campionatoMv(g, []);
  const fonteUrl = urlFedervolley(g);
  return cal.data.matches
    .filter((m) => !eRiposo(m.team1) && !eRiposo(m.team2))
    .map((m) => {
      const data = m.date ? dataIso(m.date) : null;
      const pa = m.pt_a ?? [];
      const pb = m.pt_b ?? [];
      const set = pa
        .map((a, i) => [Number(a), Number(pb[i])] as [number, number])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a + b > 0);
      const giocata = Boolean(m.played) && (m['team1-setwin'] != null || set.length > 0);
      const lat = numero(m['lat-stadium']);
      const lon = numero(m['lng-stadium']);
      const imp = m.impianto ?? {};
      return {
        id: `naz-${percorso(g).replace(/\//g, '-')}-${m.id}`.toLowerCase(),
        campionatoId: camp.id,
        girone: g.girone === 'U' ? null : g.girone,
        giornata: numero(m.giornata),
        numeroGara: m.id,
        data,
        ora: oraIso(m.time),
        palestra: imp.denominazione ? pulisciSpazi(imp.denominazione) : null,
        indirizzo: imp.indirizzo ? titoloCase(pulisciSpazi(imp.indirizzo.replace(/\s+-\s+[A-Z]{2}$/, ''))) : null,
        comune: imp.localita ? titoloCase(imp.localita) : null,
        ...(lat != null && lon != null ? { lat, lon } : {}),
        casa: squadraMv(m.team1),
        ospite: squadraMv(m.team2),
        set,
        punteggio: giocata ? { casa: Number(m['team1-setwin'] ?? 0), ospite: Number(m['team2-setwin'] ?? 0) } : null,
        stato: giocata ? 'giocata' : data ? 'da_giocare' : 'rinviata',
        risultatoUfficiale: m.ris_ufficiale === '1',
        fonteUrl,
        provinciaPalestra: imp.provincia ?? null,
      } satisfies PartitaGrezza;
    });
}

export function convertiClassificaMv(cl: ClassificaMv, g: GironeMv): ClassificaGrezza {
  const camp = campionatoMv(g, []);
  return {
    campionatoId: camp.id,
    girone: g.girone === 'U' ? null : g.girone,
    titolo: g.girone === 'U' ? camp.nome : `${camp.nome} – girone ${g.girone}`,
    fonteUrl: `${PAGINA_FEDERVOLLEY}#classifica/${percorso(g)}`,
    righe: cl.data.teams
      .filter((t) => !eRiposo(t.team))
      .map((t) => ({
        posizione: t.position,
        squadra: squadraMv(t.team),
        punti: t.points,
        giocate: t.played,
        vinte: t.won,
        perse: t.lost,
        setVinti: t.sets_won,
        setPersi: t.sets_lost,
        puntiFatti: t.points_won ?? null,
        puntiSubiti: t.points_lost ?? null,
      })),
  };
}

/** Elenca i gironi indoor della stagione leggendo l'indice paginato. */
async function elencaGironi(anno: string): Promise<GironeMv[]> {
  const indice = await scaricaJson<{ pages?: { path_index: string }[]; calendars?: VoceIndice[] }>(
    `${BASE}/${anno}/index.json`,
    { maxEtaCacheMs: 0 },
  );
  const voci: VoceIndice[] = [...(indice.calendars ?? [])];
  for (const p of indice.pages ?? []) {
    const pagina = await scaricaJson<{ calendars?: VoceIndice[] }>(`${BASE}/${p.path_index}`, { maxEtaCacheMs: 0 });
    voci.push(...(pagina.calendars ?? []));
  }
  const visti = new Set<string>();
  return voci
    .filter((v) => SERIE_NAZIONALI.includes(v.series))
    .map((v) => ({ anno, serie: v.series, sesso: v.sex, girone: v.girone }))
    .filter((g) => !visti.has(percorso(g)) && visti.add(percorso(g)));
}

interface StatoScoperta {
  anno: string;
  chiaveConfig: string;
  quando: number;
  gironiParma: GironeMv[];
}

const FILE_SCOPERTA = path.join(CACHE_DIR, 'scoperta-myvolley.json');

async function leggiScoperta(): Promise<StatoScoperta | null> {
  try {
    return JSON.parse(await readFile(FILE_SCOPERTA, 'utf8'));
  } catch {
    return null;
  }
}

async function scopriGironiParma(anno: string, ctx: ContestoFonte): Promise<GironeMv[]> {
  const gironi = await elencaGironi(anno);
  if (!gironi.length) throw new Error(`Nessun girone nazionale nell'indice ${anno}`);
  const trovati: GironeMv[] = [];
  for (const g of gironi) {
    const cl = await scaricaJson<ClassificaMv>(`${BASE}/${percorso(g)}/classifica.json`, { maxEtaCacheMs: 0 });
    if (cl.data.teams.some((t) => !eRiposo(t.team) && ctx.isParma(squadraMv(t.team)))) trovati.push(g);
  }
  ctx.log(`myvolley: ${gironi.length} gironi nazionali, con squadre di Parma: ${trovati.map(percorso).join(', ') || 'nessuno'}`);
  return trovati;
}

export const fonteMyvolley: Fonte = {
  id: 'myvolley',
  nome: 'FIPAV – campionati nazionali (federvolley.it)',
  abilitata: true,
  minimoPartite: 0, // può legittimamente non esserci nessuna squadra di Parma
  async esegui(ctx) {
    const anno = String(stagioneCorrente());
    const prec = await leggiScoperta();
    const valida =
      prec && prec.anno === anno && prec.chiaveConfig === ctx.chiaveConfig && Date.now() - prec.quando < TTL_SCOPERTA_MS;
    const gironiParma = valida ? prec.gironiParma : await scopriGironiParma(anno, ctx);
    if (!valida) {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(
        FILE_SCOPERTA,
        JSON.stringify({ anno, chiaveConfig: ctx.chiaveConfig, quando: Date.now(), gironiParma } satisfies StatoScoperta),
      );
    }

    const partite: PartitaGrezza[] = [];
    const classifiche: ClassificaGrezza[] = [];
    const perCampionato = new Map<string, { g: GironeMv; gironi: string[] }>();
    for (const g of gironiParma) {
      const cal = await scaricaJson<CalendarioMv>(`${BASE}/${percorso(g)}/calendario.json`, { maxEtaCacheMs: 0 });
      partite.push(...convertiCalendarioMv(cal, g));
      const cl = await scaricaJson<ClassificaMv>(`${BASE}/${percorso(g)}/classifica.json`, { maxEtaCacheMs: 0 });
      classifiche.push(convertiClassificaMv(cl, g));
      const id = campionatoMv(g, []).id;
      const voce = perCampionato.get(id) ?? { g, gironi: [] };
      voce.gironi.push(g.girone);
      perCampionato.set(id, voce);
    }
    ctx.log(`myvolley: ${partite.length} partite in ${gironiParma.length} gironi`);

    return {
      fonte: 'myvolley',
      aggiornatoIl: new Date().toISOString(),
      stagione: etichettaStagione(Number(anno)),
      filtroParma: true,
      campionati: [...perCampionato.values()].map((v) => campionatoMv(v.g, v.gironi)),
      partite,
      classifiche,
    };
  },
};

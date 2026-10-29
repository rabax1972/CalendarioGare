// Sigle delle province italiane: servono a riconoscere il suffisso "… PR" nei nomi squadra.
export const PROVINCE = new Set(
  (
    'AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS ' +
    'KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI ' +
    'SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV SM'
  ).split(' '),
);

/** Forme giuridiche e sigle che non distinguono una squadra dall'altra. */
const PAROLE_IGNORATE = new Set([
  'ASD', 'SSD', 'APD', 'ASS', 'POL', 'SRL', 'ARL', 'RL', 'SSDRL', 'SSDARL', 'US', 'AS', 'GS', 'AD', 'DIL', 'DILETTANTISTICA',
  'ASSOCIAZIONE', 'SPORTIVA', 'SOCIETA',
]);

export function pulisciSpazi(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function senzaAccenti(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Separa l'eventuale sigla provincia finale: "GALAXY COLLECCHIO PR" → { nome: "GALAXY COLLECCHIO", provincia: "PR" }. */
export function separaProvincia(nome: string): { nome: string; provincia: string | null } {
  const pulito = pulisciSpazi(nome);
  const m = /^(.*\S)\s+([A-Z]{2})$/.exec(pulito);
  if (m && PROVINCE.has(m[2])) return { nome: m[1], provincia: m[2] };
  return { nome: pulito, provincia: null };
}

/**
 * Chiave di confronto tra nomi squadra di fonti diverse:
 * maiuscole, senza accenti e punteggiatura, senza forme giuridiche e sigla provincia.
 */
export function chiaveSquadra(nome: string): string {
  const base = senzaAccenti(separaProvincia(nome).nome).toUpperCase();
  const parole = base
    .split(' ')
    // Sigle puntate: "A.S.D." → "ASD", così non restano lettere sparse.
    .map((t) => (/^([A-Z]\.)+[A-Z]?\.?$/.test(t) ? t.replace(/\./g, '') : t))
    .join(' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((p) => p && !PAROLE_IGNORATE.has(p));
  return parole.join(' ') || pulisciSpazi(base);
}

const parole = (s: string) => new Set(chiaveSquadra(s).split(' ').filter((p) => p.length > 1));

/** Abbina un nome a quello più simile di un elenco: uguale dopo la normalizzazione o con molte parole in comune. */
export function abbina<T extends { nome: string }>(nome: string, elenco: T[]): T | null {
  const chiave = chiaveSquadra(nome);
  const esatto = elenco.find((x) => chiaveSquadra(x.nome) === chiave);
  if (esatto) return esatto;
  const a = parole(nome);
  const punteggi = elenco
    .map((x) => {
      const b = parole(x.nome);
      const comuni = [...a].filter((p) => b.has(p)).length;
      return { x, p: comuni / Math.max(1, Math.min(a.size, b.size)) };
    })
    .sort((u, v) => v.p - u.p);
  // Serve una somiglianza alta e nessun pari merito: meglio nessun abbinamento che uno sbagliato.
  if (punteggi[0]?.p >= 0.75 && (punteggi.length < 2 || punteggi[1].p < punteggi[0].p)) return punteggi[0].x;
  return null;
}

export function slug(s: string): string {
  return senzaAccenti(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "27/10/2026" o "27/10/26" → "2026-10-27". */
export function dataIso(testo: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(testo);
  if (!m) return null;
  let anno = Number(m[3]);
  if (anno < 100) anno += 2000;
  const mese = Number(m[2]);
  const giorno = Number(m[1]);
  if (!anno || mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/** "20:00", "19.00", "9.30" → "20:00" / "19:00" / "09:30". */
export function oraIso(testo: string | null | undefined): string | null {
  if (!testo) return null;
  const m = /(\d{1,2})[:.](\d{2})/.exec(testo);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  if (h === 0 && min === 0) return null; // 00:00 = orario non definito
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function numero(testo: string | null | undefined): number | null {
  if (testo == null) return null;
  const pulito = String(testo).replace(',', '.').trim();
  if (!/^-?\d+(\.\d+)?$/.test(pulito)) return null;
  return Number(pulito);
}

/** Parziali "25-20" → [25, 20]. */
export function parziale(testo: string): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(testo);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function titoloCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'’(/-])(\p{L})/gu, (_, p, c: string) => p + c.toUpperCase());
}

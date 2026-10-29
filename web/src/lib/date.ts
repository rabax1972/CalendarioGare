// Tutte le date dei dati sono locali italiane (YYYY-MM-DD): si confrontano come stringhe.
const TZ = 'Europe/Rome';

export function oggiIso(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function utc(iso: string): Date {
  const [y, m, g] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, g));
}

export function aggiungiGiorni(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domenica … 6 = sabato */
export function giornoSettimana(iso: string): number {
  return utc(iso).getUTCDay();
}

export type Periodo = 'oggi' | 'weekend' | 'settimana' | 'tutte';

export const PERIODI: { id: Periodo; etichetta: string }[] = [
  { id: 'oggi', etichetta: 'Oggi' },
  { id: 'weekend', etichetta: 'Weekend' },
  { id: 'settimana', etichetta: '7 giorni' },
  { id: 'tutte', etichetta: 'Tutte' },
];

/** Intervallo di date [da, a] (a = null: senza limite). Il weekend è sabato e domenica. */
export function intervallo(periodo: Periodo, oggi = oggiIso()): { da: string; a: string | null } {
  switch (periodo) {
    case 'oggi':
      return { da: oggi, a: oggi };
    case 'weekend': {
      const g = giornoSettimana(oggi);
      if (g === 6) return { da: oggi, a: aggiungiGiorni(oggi, 1) };
      if (g === 0) return { da: oggi, a: oggi };
      const sabato = aggiungiGiorni(oggi, 6 - g);
      return { da: sabato, a: aggiungiGiorni(sabato, 1) };
    }
    case 'settimana':
      return { da: oggi, a: aggiungiGiorni(oggi, 6) };
    default:
      return { da: oggi, a: null };
  }
}

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtGiornoAnno = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const fmtBreve = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function dataLunga(iso: string, oggi = oggiIso()): string {
  const fmt = iso.slice(0, 4) === oggi.slice(0, 4) ? fmtGiorno : fmtGiornoAnno;
  return fmt.format(utc(iso));
}

export function dataBreve(iso: string): string {
  return fmtBreve.format(utc(iso));
}

/** "Oggi", "Domani", "Ieri" o niente. */
export function giornoRelativo(iso: string, oggi = oggiIso()): string | null {
  if (iso === oggi) return 'Oggi';
  if (iso === aggiungiGiorni(oggi, 1)) return 'Domani';
  if (iso === aggiungiGiorni(oggi, -1)) return 'Ieri';
  return null;
}

export function titoloGiorno(iso: string, oggi = oggiIso()): string {
  const rel = giornoRelativo(iso, oggi);
  const lunga = dataLunga(iso, oggi);
  return rel ? `${rel} · ${lunga}` : lunga.charAt(0).toUpperCase() + lunga.slice(1);
}

/** Momento dell'ultimo aggiornamento in forma leggibile. */
export function quando(timestamp: string, ora = new Date()): string {
  const d = new Date(timestamp);
  const giorno = oggiIso(d);
  const hhmm = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
  const rel = giornoRelativo(giorno, oggiIso(ora));
  if (rel) return `${rel.toLowerCase()} alle ${hhmm}`;
  return `${dataBreve(giorno)} alle ${hhmm}`;
}

/** Ore trascorse da un timestamp. */
export function oreDa(timestamp: string, ora = new Date()): number {
  return (ora.getTime() - new Date(timestamp).getTime()) / 3_600_000;
}

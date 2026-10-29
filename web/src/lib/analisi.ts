import type { Campionato, Partita, Squadra } from '../../../shared/model.ts';
import { aggiungiGiorni, dataBreve, giornoRelativo, intervallo, oggiIso } from './date.ts';

interface Contesto {
  squadra: Map<string, Squadra>;
  campionato: Map<string, Campionato>;
}

/**
 * Derby: due squadre di Parma una contro l'altra in un campionato regionale o nazionale. Nei provinciali (CSEN) sono tutte
 * di Parma, quindi lì non è una notizia.
 */
export function isDerby(p: Partita, d: Contesto): boolean {
  const c = d.campionato.get(p.campionatoId);
  if (!c || c.livello === 'provinciale') return false;
  return !!d.squadra.get(p.casa)?.parmense && !!d.squadra.get(p.ospite)?.parmense;
}

export interface Esito {
  partitaId: string;
  vinta: boolean;
  avversario: string;
  /** Set della squadra e dell'avversario. */
  set: [number, number];
  data: string;
}

/** Ultimi risultati della squadra, dal più vecchio al più recente. */
export function forma(squadraId: string, partite: Partita[], d: Pick<Contesto, 'squadra'>, quante = 5): Esito[] {
  return partite
    .filter((p) => p.stato === 'giocata' && p.punteggio && p.data && (p.casa === squadraId || p.ospite === squadraId))
    .sort((a, b) => b.data!.localeCompare(a.data!) || (b.ora ?? '').localeCompare(a.ora ?? ''))
    .slice(0, quante)
    .reverse()
    .map((p) => {
      const inCasa = p.casa === squadraId;
      const fatti = inCasa ? p.punteggio!.casa : p.punteggio!.ospite;
      const subiti = inCasa ? p.punteggio!.ospite : p.punteggio!.casa;
      return {
        partitaId: p.id,
        vinta: fatti > subiti,
        avversario: d.squadra.get(inCasa ? p.ospite : p.casa)?.nome ?? '?',
        set: [fatti, subiti],
        data: p.data!,
      };
    });
}

/** Vittorie (positivo) o sconfitte (negativo) consecutive più recenti. */
export function serie(esiti: Esito[]): number {
  if (!esiti.length) return 0;
  const ultima = esiti[esiti.length - 1].vinta;
  let n = 0;
  for (let i = esiti.length - 1; i >= 0 && esiti[i].vinta === ultima; i--) n++;
  return ultima ? n : -n;
}

export interface Riepilogo {
  /** "weekend": sabato e domenica in arrivo (o in corso); "settimana": i prossimi 7 giorni, se nel weekend non si gioca. */
  periodo: 'weekend' | 'settimana';
  da: string;
  a: string;
  gare: number;
  /** Gare in casa di una squadra di Parma, cioè giocate in provincia. */
  inCasa: number;
  derby: number;
  campionati: number;
}

export function riepilogoWeekend(partite: Partita[], d: Contesto, oggi = oggiIso()): Riepilogo {
  const calcola = (periodo: 'weekend' | 'settimana'): Riepilogo => {
    const { da, a } = intervallo(periodo, oggi);
    const gare = partite.filter((p) => p.data && p.data >= da && p.data <= a! && p.stato !== 'rinviata');
    return {
      periodo,
      da,
      a: a!,
      gare: gare.length,
      inCasa: gare.filter((p) => d.squadra.get(p.casa)?.parmense).length,
      derby: gare.filter((p) => isDerby(p, d)).length,
      campionati: new Set(gare.map((p) => p.campionatoId)).size,
    };
  };
  const weekend = calcola('weekend');
  return weekend.gare ? weekend : calcola('settimana');
}

/** Prossima gara (non ancora giocata, con data) di una delle squadre indicate. */
export function prossimaGara(partite: Partita[], squadre: string[], adesso = new Date()): Partita | null {
  const oggi = oggiIso(adesso);
  const ora = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(adesso);
  const ids = new Set(squadre);
  return (
    partite
      .filter(
        (p) =>
          p.stato === 'da_giocare' &&
          p.data &&
          (ids.has(p.casa) || ids.has(p.ospite)) &&
          (p.data > oggi || (p.data === oggi && (!p.ora || p.ora >= ora))),
      )
      .sort((a, b) => a.data!.localeCompare(b.data!) || (a.ora ?? '').localeCompare(b.ora ?? ''))[0] ?? null
  );
}

/** "Oggi alle 18:00", "Domani alle 18:00", "Tra 3 giorni · sab 7 nov, 18:00". */
export function contoAllaRovescia(p: Partita, oggi = oggiIso()): string {
  if (!p.data) return 'Data da definire';
  const alle = p.ora ? ` alle ${p.ora}` : '';
  const rel = giornoRelativo(p.data, oggi);
  if (rel) return `${rel}${alle}`;
  let giorni = 0;
  for (let g = oggi; g < p.data && giorni < 400; g = aggiungiGiorni(g, 1)) giorni++;
  return `Tra ${giorni} giorni · ${dataBreve(p.data)}${p.ora ? `, ${p.ora}` : ''}`;
}

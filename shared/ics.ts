// Calendario iCalendar (RFC 5545) delle gare di una squadra: la build ne scrive uno per ogni squadra di Parma in
// data/calendari/<id>.ics. Chi si iscrive vede le gare nel calendario del telefono, aggiornate a ogni pubblicazione.

import type { Campionato, Partita, Squadra } from './model.ts';

const DURATA_ORE = 2;

/** Istante UTC di una data e ora locali italiane (tiene conto dell'ora legale). */
export function utcDaRoma(data: string, ora: string): Date {
  const [y, m, g] = data.split('-').map(Number);
  const [h, mi] = ora.split(':').map(Number);
  const voluto = Date.UTC(y, m - 1, g, h, mi);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let t = voluto;
  // Due passaggi bastano anche a cavallo del cambio d'ora.
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
    t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - voluto;
  }
  return new Date(t);
}

const formatoUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function testo(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Righe lunghe spezzate a 75 byte, come vuole il formato (le continuazioni iniziano con uno spazio). */
function piega(riga: string): string {
  const out: string[] = [];
  let corrente = '';
  for (const ch of riga) {
    const limite = out.length ? 74 : 75;
    if (Buffer.byteLength(corrente + ch) > limite) {
      out.push(corrente);
      corrente = ch;
    } else corrente += ch;
  }
  out.push(corrente);
  return out.join('\r\n ');
}

export interface OpzioniIcs {
  squadra: Squadra;
  partite: Partita[];
  campionati: Map<string, Campionato>;
  nomeSquadra: (id: string) => string;
  /** Momento della generazione dei dati (DTSTAMP): stabile tra una build e l'altra se i dati non cambiano. */
  generatoIl: string;
}

export function calendarioSquadra({ squadra, partite, campionati, nomeSquadra, generatoIl }: OpzioniIcs): string {
  const stamp = formatoUtc(new Date(generatoIl));
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Volley Parma//Calendario gare//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${testo(`Volley Parma – ${squadra.nome}`)}`,
    'X-WR-TIMEZONE:Europe/Rome',
    // Suggerimento ai calendari iscritti: ricontrollare ogni 6 ore.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const p of partite.filter((x) => (x.casa === squadra.id || x.ospite === squadra.id) && x.data)) {
    const c = campionati.get(p.campionatoId);
    const casa = nomeSquadra(p.casa);
    const ospite = nomeSquadra(p.ospite);
    const risultato = p.stato === 'giocata' && p.punteggio ? ` ${p.punteggio.casa}-${p.punteggio.ospite} ` : ' – ';
    const prefisso = p.stato === 'rinviata' ? 'RINVIATA: ' : '';
    const titolo = `${prefisso}${casa}${risultato}${ospite}${c ? ` (${c.nomeBreve})` : ''}`;
    const descrizione = [
      c?.nome,
      [p.girone && `Girone ${p.girone}`, p.giornata != null && `Giornata ${p.giornata}`].filter(Boolean).join(' · '),
      p.set.length ? `Parziali: ${p.set.map(([a, b]) => `${a}-${b}`).join(', ')}` : '',
      `Fonte: ${p.fonteUrl}`,
    ].filter(Boolean).join('\n');
    const luogo = [p.palestra, p.indirizzo, p.comune].filter(Boolean).join(', ');
    righe.push('BEGIN:VEVENT', `UID:${p.id}@volley-parma`, `DTSTAMP:${stamp}`);
    if (p.ora) {
      const inizio = utcDaRoma(p.data!, p.ora);
      righe.push(`DTSTART:${formatoUtc(inizio)}`, `DTEND:${formatoUtc(new Date(inizio.getTime() + DURATA_ORE * 3600_000))}`);
    } else {
      // Ora non nota: evento di tutto il giorno.
      const [y, m, g] = p.data!.split('-').map(Number);
      const dopo = new Date(Date.UTC(y, m - 1, g + 1)).toISOString().slice(0, 10);
      righe.push(`DTSTART;VALUE=DATE:${p.data!.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${dopo.replace(/-/g, '')}`);
    }
    righe.push(`SUMMARY:${testo(titolo)}`, `DESCRIPTION:${testo(descrizione)}`);
    if (luogo) righe.push(`LOCATION:${testo(luogo)}`);
    if (p.lat != null && p.lon != null) righe.push(`GEO:${p.lat};${p.lon}`);
    if (p.stato === 'rinviata') righe.push('STATUS:CANCELLED');
    righe.push('END:VEVENT');
  }
  righe.push('END:VCALENDAR');
  return righe.map(piega).join('\r\n') + '\r\n';
}

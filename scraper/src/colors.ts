import { createHash } from 'node:crypto';
import type { Campionato } from '../../shared/model.ts';
import type { CampionatoGrezzo } from './types.ts';

/**
 * Palette accessibile: "chiaro" regge testo bianco (contrasto ≥ 4.5:1, anche su sfondo #f6f7f9);
 * "scuro" regge testo #111827 nel tema scuro. Verifica in scraper/test/colors.test.ts.
 */
export const PALETTE: { nome: string; chiaro: string; scuro: string }[] = [
  { nome: 'blu', chiaro: '#1d4ed8', scuro: '#93c5fd' },
  { nome: 'rosso', chiaro: '#b91c1c', scuro: '#fca5a5' },
  { nome: 'verde', chiaro: '#15803d', scuro: '#86efac' },
  { nome: 'ambra', chiaro: '#92400e', scuro: '#fcd34d' },
  { nome: 'viola', chiaro: '#7e22ce', scuro: '#d8b4fe' },
  { nome: 'petrolio', chiaro: '#0f766e', scuro: '#5eead4' },
  { nome: 'magenta', chiaro: '#be185d', scuro: '#f9a8d4' },
  { nome: 'arancio', chiaro: '#c2410c', scuro: '#fdba74' },
  { nome: 'indaco', chiaro: '#4338ca', scuro: '#a5b4fc' },
  { nome: 'oliva', chiaro: '#4d7c0f', scuro: '#bef264' },
  { nome: 'ciano', chiaro: '#0e7490', scuro: '#67e8f9' },
  { nome: 'bordeaux', chiaro: '#9f1239', scuro: '#fda4af' },
  { nome: 'fucsia', chiaro: '#a21caf', scuro: '#f0abfc' },
  { nome: 'smeraldo', chiaro: '#047857', scuro: '#6ee7b7' },
  { nome: 'cielo', chiaro: '#0369a1', scuro: '#7dd3fc' },
  { nome: 'ocra', chiaro: '#854d0e', scuro: '#fde047' },
  { nome: 'prugna', chiaro: '#6b21a8', scuro: '#c4b5fd' },
  { nome: 'grafite', chiaro: '#44403c', scuro: '#d6d3d1' },
];

const PREDEFINITI: Record<string, string> = { 'fipav-parma': 'grafite' };
const ORDINE_LIVELLO = { provinciale: 0, regionale: 1, nazionale: 2 } as const;

function hash(s: string): number {
  return createHash('sha1').update(s).digest().readUInt32BE(0);
}

/**
 * Assegna un colore a ogni campionato in modo deterministico: indice dato dall'hash dell'id,
 * con scorrimento al primo colore libero. Aggiungere un campionato non cambia i colori degli altri,
 * salvo collisioni. `override` (da data/colori.json) forza il nome di un colore della palette.
 */
export function assegnaColori(campionati: CampionatoGrezzo[], override: Record<string, string> = {}): Campionato[] {
  const forzati = { ...PREDEFINITI, ...override };
  const usati = new Set<number>();
  const scelti = new Map<string, number>();

  for (const c of campionati) {
    const i = PALETTE.findIndex((p) => p.nome === forzati[c.id]);
    if (i >= 0) {
      scelti.set(c.id, i);
      usati.add(i);
    }
  }
  const ordinati = [...campionati]
    .filter((c) => !scelti.has(c.id))
    .sort((a, b) => ORDINE_LIVELLO[a.livello] - ORDINE_LIVELLO[b.livello] || a.id.localeCompare(b.id));
  // "grafite" resta per le schede senza dati; si usa solo se la palette è esaurita.
  const disponibili = PALETTE.length - 1;
  for (const c of ordinati) {
    let i = hash(c.id) % disponibili;
    for (let n = 0; n < disponibili && usati.has(i); n++) i = (i + 1) % disponibili;
    scelti.set(c.id, i);
    usati.add(i);
  }

  return campionati.map((c) => {
    const p = PALETTE[scelti.get(c.id)!];
    return { ...c, colore: p.chiaro, coloreScuro: p.scuro };
  });
}

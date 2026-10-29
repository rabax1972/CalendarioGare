// Parole che non aiutano a riconoscere la squadra nelle iniziali.
const IGNORATE = new Set(['ASD', 'SSD', 'APD', 'POL', 'US', 'GS', 'AS', 'VOLLEY', 'PALLAVOLO', 'VOLLEYBALL', 'BALL', 'SRL', 'DI', 'DE', 'DEL', 'LA', 'IL']);

/** Due caratteri per il monogramma: "ISOMEC GREEN INZANI" → "IG", "CUS 3" → "C3". */
export function iniziali(nome: string): string {
  const parole = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(' ')
    // Sigle puntate: "A.S.D." → "ASD".
    .map((t) => (/^([A-Z]\.)+[A-Z]?\.?$/.test(t) ? t.replace(/\./g, '') : t))
    .join(' ')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const utili = parole.filter((p) => !IGNORATE.has(p));
  const scelte = utili.length ? utili : parole;
  if (!scelte.length) return '?';
  if (scelte.length === 1) return scelte[0].slice(0, 2);
  return scelte[0][0] + scelte[1][0];
}

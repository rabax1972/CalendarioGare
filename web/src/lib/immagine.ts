import type { Campionato, Partita, Squadra } from '../../../shared/model.ts';
import { dataLunga } from './date.ts';
import { iniziali } from './iniziali.ts';

// Card 1080×1080 della gara da condividere (WhatsApp, Instagram): risultato con parziali, oppure locandina della prossima
// gara. Disegnata nel browser su canvas, con loghi e colore del campionato: niente server.

const LATO = 1080;
const FONT = '"Barlow Condensed", system-ui, sans-serif';

interface Dati {
  p: Partita;
  campionato: Campionato | undefined;
  casa: Squadra | undefined;
  ospite: Squadra | undefined;
  /** Indirizzo dell'app, in fondo all'immagine. */
  sito: string;
}

async function caricaLogo(s: Squadra | undefined): Promise<HTMLImageElement | null> {
  if (!s?.logo) return null;
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}data/${s.logo}`;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Righe che stanno in `larghezza`, al massimo `max` (l'ultima con i puntini se serve). */
function aCapo(ctx: CanvasRenderingContext2D, testo: string, larghezza: number, max: number): string[] {
  const righe: string[] = [];
  let riga = '';
  for (const parola of testo.split(/\s+/)) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (ctx.measureText(prova).width <= larghezza || !riga) riga = prova;
    else {
      righe.push(riga);
      riga = parola;
    }
  }
  if (riga) righe.push(riga);
  if (righe.length > max) {
    const tenute = righe.slice(0, max);
    let ultima = tenute[max - 1];
    while (ctx.measureText(`${ultima}…`).width > larghezza && ultima.length > 1) ultima = ultima.slice(0, -1);
    tenute[max - 1] = `${ultima}…`;
    return tenute;
  }
  return righe;
}

function stemma(ctx: CanvasRenderingContext2D, s: Squadra | undefined, logo: HTMLImageElement | null, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.restore();
  if (logo) {
    const lato = r * 1.36;
    const scala = Math.min(lato / logo.naturalWidth, lato / logo.naturalHeight);
    const w = logo.naturalWidth * scala;
    const h = logo.naturalHeight * scala;
    ctx.drawImage(logo, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.fillStyle = '#111827';
    ctx.font = `700 ${r * 0.8}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iniziali(s?.nome ?? '?'), x, y + r * 0.04);
  }
}

export async function creaImmagine({ p, campionato, casa, ospite, sito }: Dati): Promise<Blob> {
  await Promise.all([document.fonts.load(`700 80px ${FONT}`), document.fonts.load(`600 40px ${FONT}`)]).catch(() => {});
  const [logoCasa, logoOspite] = await Promise.all([caricaLogo(casa), caricaLogo(ospite)]);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LATO;
  const ctx = canvas.getContext('2d')!;
  const colore = campionato?.colore ?? '#1d4ed8';

  // Sfondo: colore del campionato che scurisce verso il basso, con due fasce chiare in diagonale (la rete).
  ctx.fillStyle = colore;
  ctx.fillRect(0, 0, LATO, LATO);
  const ombra = ctx.createLinearGradient(0, 0, 0, LATO);
  ombra.addColorStop(0, 'rgba(0,0,0,0)');
  ombra.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = ombra;
  ctx.fillRect(0, 0, LATO, LATO);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  ctx.translate(LATO / 2, LATO / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.fillRect(-LATO, -260, LATO * 2, 90);
  ctx.fillRect(-LATO, 200, LATO * 2, 40);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';

  // Intestazione
  const giocata = p.stato === 'giocata' && p.punteggio;
  const etichetta = giocata ? 'RISULTATO FINALE' : p.stato === 'rinviata' ? 'GARA RINVIATA' : 'PROSSIMA GARA';
  ctx.textAlign = 'left';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('VOLLEY PARMA', 70, 100);
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.85;
  ctx.fillText(etichetta, LATO - 70, 100);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = `600 46px ${FONT}`;
  const sottotitolo = [campionato?.nome, p.giornata != null ? `Giornata ${p.giornata}` : null].filter(Boolean).join(' · ');
  ctx.fillText(aCapo(ctx, sottotitolo, LATO - 140, 1)[0] ?? '', LATO / 2, 180);

  // Squadre
  const yStemma = 380;
  stemma(ctx, casa, logoCasa, 250, yStemma, 120);
  stemma(ctx, ospite, logoOspite, LATO - 250, yStemma, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 50px ${FONT}`;
  for (const [s, x] of [[casa, 250], [ospite, LATO - 250]] as const) {
    aCapo(ctx, (s?.nome ?? '?').toUpperCase(), 380, 3).forEach((r, i) => ctx.fillText(r, x, yStemma + 190 + i * 54));
  }

  // Centro: punteggio o orario
  if (giocata) {
    ctx.font = `700 190px ${FONT}`;
    ctx.fillText(`${p.punteggio!.casa}-${p.punteggio!.ospite}`, LATO / 2, yStemma + 66);
  } else {
    ctx.font = `700 120px ${FONT}`;
    ctx.fillText(p.ora ?? 'VS', LATO / 2, yStemma + 44);
  }

  // Parziali
  if (p.set.length) {
    ctx.font = `600 44px ${FONT}`;
    ctx.globalAlpha = 0.95;
    ctx.fillText(p.set.map(([a, b]) => `${a}-${b}`).join('   '), LATO / 2, 820);
    ctx.globalAlpha = 1;
  }

  // Quando e dove
  ctx.font = `600 40px ${FONT}`;
  const quando = p.data ? dataLunga(p.data) : 'Data da definire';
  const dove = [p.palestra, p.comune].filter(Boolean).join(', ');
  ctx.fillText(aCapo(ctx, quando.charAt(0).toUpperCase() + quando.slice(1), LATO - 140, 1)[0], LATO / 2, 900);
  if (dove) {
    ctx.globalAlpha = 0.85;
    ctx.fillText(aCapo(ctx, dove, LATO - 140, 1)[0], LATO / 2, 952);
    ctx.globalAlpha = 1;
  }

  // Piede
  ctx.font = `600 32px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(sito, LATO / 2, LATO - 40);
  ctx.globalAlpha = 1;

  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Immagine non creata'))), 'image/png'));
}

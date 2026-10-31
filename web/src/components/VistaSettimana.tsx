import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Partita } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { aggiungiGiorni, dataLunga, oggiIso } from '../lib/date.ts';
import { link } from '../lib/router.ts';
import { comprimi, disponi, fasciaOraria, giorniDellaSettimana, lunedi } from '../lib/settimana.ts';
import { Icona, stileTinta } from './ui.tsx';

const ALTEZZA_ORA = 56;
/** Larghezza minima di una corsia: compatta quando il giorno è chiuso, leggibile quando è allargato. */
const LARGHEZZA_CORSIA = 56;
const LARGHEZZA_CORSIA_APERTA = 104;
/** Gare affiancate al massimo prima del blocco "+N". */
const MAX_CORSIE = 3;

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'short', timeZone: 'UTC' });
const fmtMese = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMeseAnno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function titoloSettimana(lun: string): string {
  const dom = aggiungiGiorni(lun, 6);
  if (lun.slice(0, 7) === dom.slice(0, 7)) return `${Number(lun.slice(8))} – ${fmtMeseAnno.format(utc(dom))}`;
  return `${fmtMese.format(utc(lun))} – ${fmtMeseAnno.format(utc(dom))}`;
}

/** Minuti trascorsi dalla mezzanotte, ora italiana: posizione della linea "adesso". */
function adesso(): number {
  const [h, m] = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Rome' })
    .format(new Date())
    .split(':')
    .map(Number);
  return h * 60 + m;
}

function Evento({ p, stile }: { p: Partita; stile?: CSSProperties }) {
  const d = useDati();
  const c = d.campionato.get(p.campionatoId);
  const casa = d.squadra.get(p.casa)?.nome ?? '?';
  const ospite = d.squadra.get(p.ospite)?.nome ?? '?';
  const giocata = p.stato === 'giocata' && p.punteggio;
  const descrizione =
    `${dataLunga(p.data!)}${p.ora ? ` alle ${p.ora}` : ''}: ${casa} contro ${ospite}, ${c?.nome ?? ''}` +
    (giocata ? `, finita ${p.punteggio!.casa}-${p.punteggio!.ospite}` : '') +
    (p.stato === 'rinviata' ? ', rinviata' : '');
  return (
    <a
      className={`sett-evento tinta${p.stato === 'rinviata' ? ' rinviata' : ''}${giocata ? ' giocata' : ''}`}
      style={{ ...stileTinta(c), ...stile }}
      href={link('partita', p.id)}
      aria-label={descrizione}
      title={descrizione}
    >
      <span className="sett-evento-testa">
        {p.ora && <span>{p.ora}</span>}
        {giocata ? (
          <strong>
            {p.punteggio!.casa}-{p.punteggio!.ospite}
          </strong>
        ) : (
          <span className="sett-evento-camp">{c?.nomeBreve}</span>
        )}
      </span>
      <span className="sett-evento-nome">{casa}</span>
      <span className="sett-evento-nome">{ospite}</span>
    </a>
  );
}

interface Props {
  partite: Partita[];
  lun: string;
  onLun: (lun: string) => void;
}

export function VistaSettimana({ partite, lun, onLun }: Props) {
  const oggi = oggiIso();
  const giorni = giorniDellaSettimana(lun);
  const scorri = useRef<HTMLDivElement>(null);
  const [ora, setOra] = useState(adesso);
  // Giorni allargati con il blocco "+N": mostrano tutte le gare affiancate.
  const [aperti, setAperti] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setOra(adesso()), 60_000);
    return () => clearInterval(t);
  }, []);

  const settimana = partite.filter((p) => p.data && p.data >= giorni[0] && p.data <= giorni[6]);
  const [daOra, aOra] = fasciaOraria(settimana);
  const perGiorno = giorni.map((g) => {
    const delGiorno = settimana.filter((p) => p.data === g);
    const tutti = disponi(delGiorno);
    const aperto = aperti.has(g);
    const { visibili, altre } = aperto ? { visibili: tutti, altre: [] } : comprimi(tutti, MAX_CORSIE);
    const corsie = Math.max(1, ...visibili.map((b) => b.corsie));
    const larghezza = corsie * (aperto && corsie > MAX_CORSIE ? LARGHEZZA_CORSIA_APERTA : LARGHEZZA_CORSIA);
    return { g, blocchi: visibili, altre, aperto: aperto && corsie > MAX_CORSIE, larghezza, senzaOra: delGiorno.filter((p) => !p.ora) };
  });
  const colonne = perGiorno.map(({ larghezza }) => `minmax(${larghezza}px, 1fr)`);
  const alterna = (g: string) =>
    setAperti((prima) => {
      const dopo = new Set(prima);
      if (!dopo.delete(g)) dopo.add(g);
      return dopo;
    });
  const posizione = (inizio: number, fine: number, corsia: number, corsie: number): CSSProperties => ({
    top: ((inizio - daOra * 60) / 60) * ALTEZZA_ORA,
    height: ((Math.min(fine, aOra * 60) - inizio) / 60) * ALTEZZA_ORA - 2,
    left: `calc(${(corsia / corsie) * 100}% + 1px)`,
    width: `calc(${100 / corsie}% - 3px)`,
  });
  const conSenzaOra = perGiorno.some((x) => x.senzaOra.length);

  // Su schermi stretti la griglia scorre in orizzontale: si parte dal giorno di oggi, o dal lunedì.
  useEffect(() => {
    setAperti(new Set());
    const el = scorri.current?.querySelector<HTMLElement>('.sett-testa.oggi');
    if (scorri.current) scorri.current.scrollLeft = el ? el.offsetLeft - 48 : 0;
  }, [lun]);

  return (
    <section className="settimana" aria-label={`Settimana ${titoloSettimana(lun)}`}>
      <div className="sett-nav">
        <button type="button" className="pulsante icona-sola" aria-label="Settimana precedente" onClick={() => onLun(aggiungiGiorni(lun, -7))}>
          <Icona nome="indietro" />
        </button>
        <button type="button" className="pulsante icona-sola" aria-label="Settimana successiva" onClick={() => onLun(aggiungiGiorni(lun, 7))}>
          <Icona nome="avanti" />
        </button>
        <h2 className="sett-titolo" aria-live="polite">
          {titoloSettimana(lun)}
        </h2>
        <button type="button" className="pulsante secondario" disabled={lun === lunedi(oggi)} onClick={() => onLun(lunedi(oggi))}>
          Oggi
        </button>
      </div>

      <div className="sett-scorri" ref={scorri}>
        <div className="sett-griglia" style={{ gridTemplateColumns: `48px ${colonne.join(' ')}` }}>
          <div className="sett-angolo" />
          {giorni.map((g) => (
            <div key={g} className={`sett-testa${g === oggi ? ' oggi' : ''}${g < oggi ? ' passato' : ''}`}>
              <span className="sett-testa-giorno">{fmtGiorno.format(utc(g)).replace('.', '')}</span>
              <span className="sett-testa-numero">{Number(g.slice(8))}</span>
            </div>
          ))}

          {conSenzaOra && (
            <>
              <div className="sett-etichetta-ora sett-senza-ora-etichetta">Ora n.d.</div>
              {perGiorno.map(({ g, senzaOra }) => (
                <div key={g} className="sett-senza-ora">
                  {senzaOra.map((p) => (
                    <Evento key={p.id} p={p} />
                  ))}
                </div>
              ))}
            </>
          )}

          <div className="sett-ore" style={{ height: (aOra - daOra) * ALTEZZA_ORA }}>
            {Array.from({ length: aOra - daOra }, (_, i) => (
              <span key={i} className="sett-etichetta-ora" style={{ top: i * ALTEZZA_ORA }}>
                {String(daOra + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {perGiorno.map(({ g, blocchi, altre, aperto }) => (
            <div
              key={g}
              className={`sett-colonna${g === oggi ? ' oggi' : ''}`}
              style={{ height: (aOra - daOra) * ALTEZZA_ORA, backgroundSize: `100% ${ALTEZZA_ORA}px` }}
            >
              {blocchi.map((b) => (
                <Evento key={b.p.id} p={b.p} stile={posizione(b.inizio, b.fine, b.corsia, b.corsie)} />
              ))}
              {altre.map((a) => (
                <button
                  key={a.inizio}
                  type="button"
                  className="sett-altre"
                  style={posizione(a.inizio, a.fine, a.corsia, a.corsie)}
                  aria-label={`Altre ${a.quante} gare: mostra tutte le gare di ${dataLunga(g, oggi)}`}
                  onClick={() => alterna(g)}
                >
                  +{a.quante}
                </button>
              ))}
              {aperto && (
                <button type="button" className="sett-chiudi" aria-label={`Restringi ${dataLunga(g, oggi)}`} onClick={() => alterna(g)}>
                  <Icona nome="chiudi" />
                </button>
              )}
              {g === oggi && ora >= daOra * 60 && ora < aOra * 60 && (
                <div className="sett-adesso" style={{ top: ((ora - daOra * 60) / 60) * ALTEZZA_ORA }} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
      {!settimana.length && <p className="nota sett-vuota">Nessuna gara in questa settimana.</p>}
    </section>
  );
}

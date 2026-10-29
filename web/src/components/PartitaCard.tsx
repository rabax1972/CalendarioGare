import type { Partita } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { dataBreve, oggiIso } from '../lib/date.ts';
import { usePreferiti } from '../lib/preferiti.ts';
import { link } from '../lib/router.ts';
import { Stemma } from './Stemma.tsx';
import { BadgeCampionato, Icona, stileTinta } from './ui.tsx';

export function StatoPartita({ p }: { p: Partita }) {
  const oggi = oggiIso();
  if (p.stato === 'rinviata') return <span className="stato stato-rinviata">{p.data ? 'Rinviata' : 'Data da definire'}</span>;
  if (p.stato === 'da_giocare' && p.data && p.data < oggi) return <span className="stato stato-attesa">Risultato non disponibile</span>;
  if (p.spostata) return <span className="stato stato-spostata">Spostata</span>;
  return null;
}

export function testoSpostata(p: Partita): string | null {
  if (!p.spostata) return null;
  if (!p.spostata.data) return 'Data o orario modificati rispetto al calendario originale';
  return `Prima era ${dataBreve(p.spostata.data)}${p.spostata.ora ? ` alle ${p.spostata.ora}` : ''}`;
}

export function PartitaCard({ p, mostraData = false }: { p: Partita; mostraData?: boolean }) {
  const d = useDati();
  const { seguita } = usePreferiti();
  const c = d.campionato.get(p.campionatoId);
  const casa = d.squadra.get(p.casa);
  const ospite = d.squadra.get(p.ospite);
  const giocata = p.stato === 'giocata' && p.punteggio;
  const vinceCasa = giocata && p.punteggio!.casa > p.punteggio!.ospite;
  const vinceOspite = giocata && p.punteggio!.ospite > p.punteggio!.casa;
  const spostata = testoSpostata(p);

  const quando = [mostraData && p.data ? dataBreve(p.data) : null, p.ora].filter(Boolean).join(' · ');

  return (
    <a className="card partita tinta" style={stileTinta(c)} href={link('partita', p.id)}>
      <div className="partita-testa">
        <BadgeCampionato c={c} />
        {p.girone && <span className="dettaglio">Gir. {p.girone}</span>}
        {p.giornata != null && <span className="dettaglio">G{p.giornata}</span>}
        <StatoPartita p={p} />
        <span className="partita-ora">{giocata ? (mostraData && p.data ? dataBreve(p.data) : '') : quando || '—'}</span>
      </div>
      <div className="partita-squadre">
        {[
          { s: casa, set: p.punteggio?.casa, vince: vinceCasa },
          { s: ospite, set: p.punteggio?.ospite, vince: vinceOspite },
        ].map(({ s, set, vince }, i) => (
          <div key={i} className={`riga-squadra${vince ? ' vince' : ''}${s?.parmense ? ' parmense' : ''}`}>
            <Stemma squadra={s} />
            <span className="nome-squadra">
              {s && seguita(s.id) && (
                <span className="stellina">
                  <Icona nome="stella" piena />
                </span>
              )}
              {i === 1 && <span className="sr-only">contro </span>}
              {s?.nome ?? '?'}
            </span>
            {giocata && (
              <span className="set-vinti">
                <span className="sr-only">set vinti: </span>
                {set}
              </span>
            )}
          </div>
        ))}
      </div>
      {(p.palestra || p.comune || spostata) && (
        <div className="partita-piede">
          {spostata && <span className="nota-spostata">{spostata}</span>}
          {(p.palestra || p.comune) && <span>{[p.palestra, p.comune].filter(Boolean).join(' · ')}</span>}
        </div>
      )}
    </a>
  );
}

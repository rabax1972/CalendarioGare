import { ArticoloCard } from '../components/ArticoloCard.tsx';
import { Forma } from '../components/Forma.tsx';
import { ListaPerGiorno } from '../components/ListaPerGiorno.tsx';
import { RosaSquadra } from '../components/RosaSquadra.tsx';
import { Stemma } from '../components/Stemma.tsx';
import { BadgeCampionato, Icona, PulsanteSegui, Vuoto, stileTinta } from '../components/ui.tsx';
import { forma, serie } from '../lib/analisi.ts';
import { useDati } from '../lib/dati.tsx';
import { oggiIso } from '../lib/date.ts';
import { link } from '../lib/router.ts';

/** Iscrizione al calendario della squadra (data/calendari/<id>.ics, generato dalla build). */
function MenuCalendario({ id }: { id: string }) {
  const url = new URL(`${import.meta.env.BASE_URL}data/calendari/${id}.ics`, location.href).href;
  const webcal = url.replace(/^https?:/, 'webcal:');
  return (
    <details className="menu-calendario">
      <summary className="segui">
        <Icona nome="calendario" /> Aggiungi al calendario
      </summary>
      <div className="menu-calendario-voci">
        <a href={webcal}>iPhone, Mac e Outlook</a>
        <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">
          Google Calendar <Icona nome="esterno" />
        </a>
        <a href={url} download={`${id}.ics`}>
          Scarica il file .ics
        </a>
        <p className="nota">Con l'iscrizione le gare si aggiornano da sole, anche quando cambiano data o orario.</p>
      </div>
    </details>
  );
}

export function Squadra({ id }: { id: string }) {
  const d = useDati();
  const s = d.squadra.get(id);
  if (!s) {
    return (
      <Vuoto titolo="Squadra non trovata">
        <p>Potrebbe non essere più presente nei dati di questa stagione.</p>
        <a className="pulsante secondario" href={link('squadre')}>
          Tutte le squadre
        </a>
      </Vuoto>
    );
  }
  const oggi = oggiIso();
  const sue = d.partite.filter((p) => p.casa === id || p.ospite === id);
  const prossime = sue.filter((p) => p.stato !== 'giocata' && (p.data === null || p.data >= oggi));
  const giocate = sue
    .filter((p) => !prossime.includes(p))
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const classifiche = d.classifiche.filter((c) => c.righe.some((r) => r.squadraId === id));
  const c = d.campionato.get(s.campionati[0]);
  const rosa = d.rosa.get(id);
  const articoli = d.rassegna?.articoli.filter((a) => a.squadre.includes(id)) ?? [];
  const inSerie = serie(forma(id, d.partite, d));

  return (
    <article className="scheda-squadra">
      <header className="testata testata-squadra tinta" style={stileTinta(c)}>
        <Stemma squadra={s} misura="grande" />
        <div>
          <div className="testata-badge">
            {s.campionati.map((cid) => (
              <BadgeCampionato key={cid} c={d.campionato.get(cid)} esteso />
            ))}
          </div>
          <h1>{s.nome}</h1>
          <p className="sotto">{[s.societa && s.societa !== s.nome ? s.societa : null, s.comune].filter(Boolean).join(' · ')}</p>
          <p className="forma-squadra">
            <Forma squadraId={s.id} etichetta />
            {Math.abs(inSerie) >= 2 && (
              <span className="serie">
                {Math.abs(inSerie)} {inSerie > 0 ? 'vittorie' : 'sconfitte'} di fila
              </span>
            )}
          </p>
          <div className="azioni-squadra">
            <PulsanteSegui id={s.id} nome={s.nome} />
            {s.parmense && <MenuCalendario id={s.id} />}
            {rosa && (
              <button
                type="button"
                className="segui"
                onClick={() => document.getElementById('titolo-rosa')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Icona nome="squadre" /> Rosa ({rosa.atleti.length})
              </button>
            )}
          </div>
        </div>
      </header>

      {classifiche.map((cl) => {
        const riga = cl.righe.find((r) => r.squadraId === id)!;
        return (
          <a
            key={`${cl.campionatoId}-${cl.girone}`}
            className="card riassunto-classifica"
            href={link('classifiche', cl.campionatoId, cl.girone ?? '')}
          >
            <span className="posizione">{riga.posizione}°</span>
            <span>
              in classifica · {cl.titolo}
              <span className="sotto">
                {riga.punti} punti · {riga.giocate} giocate · {riga.vinte} vinte · {riga.perse} perse
              </span>
            </span>
          </a>
        );
      })}

      <h2 className="titolo-sezione">Prossime gare</h2>
      {prossime.length ? <ListaPerGiorno partite={prossime} giorniIniziali={6} /> : <p className="nota">Nessuna gara in programma.</p>}

      <h2 className="titolo-sezione">Risultati</h2>
      {giocate.length ? (
        <ListaPerGiorno partite={giocate} giorniIniziali={6} etichettaAltri="Mostra risultati precedenti" />
      ) : (
        <p className="nota">Nessuna gara giocata finora.</p>
      )}

      {articoli.length > 0 && (
        <>
          <h2 className="titolo-sezione">Rassegna stampa</h2>
          <div className="lista-card">
            {articoli.slice(0, 4).map((a) => (
              <ArticoloCard key={a.id} a={a} conData />
            ))}
          </div>
          {articoli.length > 4 && (
            <a className="pulsante secondario largo" href={link('rassegna', id)}>
              Tutti gli articoli ({articoli.length})
            </a>
          )}
        </>
      )}

      {rosa && <RosaSquadra rosa={rosa} />}
    </article>
  );
}

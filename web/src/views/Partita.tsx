import { useState } from 'react';
import type { Partita as TPartita } from '../../../shared/model.ts';
import { StatoPartita, testoSpostata } from '../components/PartitaCard.tsx';
import { Stemma } from '../components/Stemma.tsx';
import { BadgeCampionato, Icona, PulsanteSegui, Vuoto, stileTinta } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { dataBreve, titoloGiorno } from '../lib/date.ts';
import { link } from '../lib/router.ts';

function urlMappa(p: TPartita): string | null {
  if (p.lat != null && p.lon != null) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  const q = [p.palestra, p.indirizzo, p.comune].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function Partita({ id }: { id: string }) {
  const d = useDati();
  const [avviso, setAvviso] = useState<string | null>(null);
  const p = d.partita.get(id);
  if (!p) {
    return (
      <Vuoto titolo="Gara non trovata">
        <p>Potrebbe essere stata tolta dal calendario della fonte.</p>
        <a className="pulsante secondario" href={link('')}>
          Prossime gare
        </a>
      </Vuoto>
    );
  }
  const c = d.campionato.get(p.campionatoId);
  const casa = d.squadra.get(p.casa);
  const ospite = d.squadra.get(p.ospite);
  const mappa = urlMappa(p);
  const spostata = testoSpostata(p);
  const quando = p.data ? `${titoloGiorno(p.data)}${p.ora ? `, ore ${p.ora}` : ''}` : 'Data da definire';

  async function condividi() {
    const titolo = `${casa?.nome ?? ''} – ${ospite?.nome ?? ''}`;
    const risultato = p!.punteggio ? ` (${p!.punteggio.casa}-${p!.punteggio.ospite})` : '';
    const testo = `${c?.nome ?? ''}: ${titolo}${risultato}. ${quando}${p!.palestra ? `, ${p!.palestra}` : ''}${p!.comune ? ` (${p!.comune})` : ''}`;
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: titolo, text: testo, url });
        return;
      }
      await navigator.clipboard.writeText(`${testo}\n${url}`);
      setAvviso('Dettagli della gara copiati negli appunti');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setAvviso('Condivisione non riuscita');
    }
  }

  return (
    <article className="scheda-partita">
      <header className="testata tinta" style={stileTinta(c)}>
        <div className="testata-badge">
          <BadgeCampionato c={c} esteso />
          <StatoPartita p={p} />
        </div>
        <p className="sotto">
          {[p.girone && `Girone ${p.girone}`, p.giornata != null && `Giornata ${p.giornata}`, p.numeroGara && `Gara n. ${p.numeroGara}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <h1 className="sr-only">
          {casa?.nome} contro {ospite?.nome}
        </h1>
        <div className="tabellone">
          {[
            { s: casa, ruolo: 'Casa' },
            { s: ospite, ruolo: 'Ospite' },
          ].map(({ s, ruolo }, i) => (
            <div key={ruolo} className={`tabellone-squadra ${i === 0 ? 'lato-casa' : 'lato-ospite'}`}>
              <Stemma squadra={s} misura="grande" />
              {s ? (
                <a href={link('squadra', s.id)} className="nome-squadra">
                  {s.nome}
                </a>
              ) : (
                <span className="nome-squadra">?</span>
              )}
              <span className="ruolo">{ruolo}</span>
              {s?.parmense && <PulsanteSegui id={s.id} nome={s.nome} compatto />}
            </div>
          ))}
          <div className="tabellone-centro">
            {p.punteggio ? (
              <span className="punteggio-grande">
                {p.punteggio.casa}
                <span aria-hidden="true">–</span>
                <span className="sr-only"> a </span>
                {p.punteggio.ospite}
              </span>
            ) : (
              <>
                <span className="ora-grande">{p.ora ?? '—'}</span>
                {p.data && <span className="sotto">{dataBreve(p.data)}</span>}
              </>
            )}
          </div>
        </div>
      </header>

      {p.set.length > 0 && (
        <section aria-labelledby="titolo-set">
          <h2 id="titolo-set" className="titolo-sezione">
            Parziali
          </h2>
          <div className="tabella-scorrevole" tabIndex={0} role="region" aria-labelledby="titolo-set">
            <table className="parziali">
              <thead>
                <tr>
                  <th scope="col" className="sinistra">
                    Squadra
                  </th>
                  {p.set.map((_, i) => (
                    <th key={i} scope="col">
                      {i + 1}° set
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[casa, ospite].map((s, lato) => (
                  <tr key={lato}>
                    <th scope="row" className="sinistra">
                      {s?.nome}
                    </th>
                    {p.set.map((set, i) => (
                      <td key={i} className={set[lato] > set[1 - lato] ? 'vinto' : undefined}>
                        {set[lato]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.risultatoUfficiale === false && <p className="nota">Risultato non ancora omologato.</p>}
        </section>
      )}

      <dl className="dettagli">
        <div>
          <dt>
            <Icona nome="orologio" /> Quando
          </dt>
          <dd>
            {quando}
            {spostata && <span className="nota-spostata">{spostata}</span>}
          </dd>
        </div>
        <div>
          <dt>
            <Icona nome="mappa" /> Dove
          </dt>
          <dd>
            {p.palestra ?? 'Palestra non indicata'}
            {(p.indirizzo || p.comune) && <span className="sotto">{[p.indirizzo, p.comune].filter(Boolean).join(', ')}</span>}
            {mappa && (
              <a href={mappa} target="_blank" rel="noopener noreferrer" className="link-icona">
                Apri in Google Maps <Icona nome="esterno" />
              </a>
            )}
          </dd>
        </div>
      </dl>

      <div className="azioni-partita">
        <button type="button" className="pulsante primario" onClick={condividi}>
          <Icona nome="condividi" /> Condividi
        </button>
        <a className="pulsante secondario" href={p.fonteUrl} target="_blank" rel="noopener noreferrer">
          Vedi alla fonte <Icona nome="esterno" />
        </a>
      </div>
      <p className="avviso-inline" role="status" aria-live="polite">
        {avviso}
      </p>
    </article>
  );
}

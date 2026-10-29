import { Stemma } from '../components/Stemma.tsx';
import { BadgeCampionato, Icona, TitoloPagina, Vuoto, stileTinta } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { usePreferiti } from '../lib/preferiti.ts';
import { link } from '../lib/router.ts';

export function Classifiche({ campionatoId, girone }: { campionatoId?: string; girone?: string }) {
  const d = useDati();
  const { seguita } = usePreferiti();

  if (campionatoId) {
    const c = d.campionato.get(campionatoId);
    const cl = d.classifiche.find((x) => x.campionatoId === campionatoId && (x.girone ?? '') === (girone ?? ''));
    if (!c || !cl) {
      return (
        <Vuoto titolo="Classifica non disponibile">
          <a className="pulsante secondario" href={link('classifiche')}>
            Tutte le classifiche
          </a>
        </Vuoto>
      );
    }
    return (
      <article>
        <a className="indietro" href={link('classifiche')}>
          <Icona nome="indietro" /> Classifiche
        </a>
        <header className="testata tinta" style={stileTinta(c)}>
          <BadgeCampionato c={c} />
          <h1>{cl.titolo}</h1>
        </header>
        <div className="tabella-scorrevole" tabIndex={0} role="region" aria-label={`Classifica ${cl.titolo}`}>
          <table className="classifica">
            <thead>
              <tr>
                <th scope="col">
                  <abbr title="Posizione">#</abbr>
                </th>
                <th scope="col" className="sinistra">
                  Squadra
                </th>
                <th scope="col">
                  <abbr title="Punti">Pt</abbr>
                </th>
                <th scope="col">
                  <abbr title="Gare giocate">G</abbr>
                </th>
                <th scope="col">
                  <abbr title="Vinte">V</abbr>
                </th>
                <th scope="col">
                  <abbr title="Perse">P</abbr>
                </th>
                <th scope="col">
                  <abbr title="Set vinti">SV</abbr>
                </th>
                <th scope="col">
                  <abbr title="Set persi">SP</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {cl.righe.map((r) => {
                const s = d.squadra.get(r.squadraId);
                return (
                  <tr key={r.squadraId} className={`${s?.parmense ? 'parmense' : ''}${seguita(r.squadraId) ? ' seguita' : ''}`}>
                    <td>{r.posizione}</td>
                    <th scope="row" className="sinistra">
                      <span className="cella-squadra">
                        <Stemma squadra={s} />
                        {s ? <a href={link('squadra', s.id)}>{r.nome}</a> : r.nome}
                      </span>
                      {seguita(r.squadraId) && (
                        <span className="stellina" aria-label="(seguita)">
                          <Icona nome="stella" piena />
                        </span>
                      )}
                    </th>
                    <td className="punti">{r.punti}</td>
                    <td>{r.giocate}</td>
                    <td>{r.vinte}</td>
                    <td>{r.perse}</td>
                    <td>{r.setVinti}</td>
                    <td>{r.setPersi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="nota">
          In grassetto le squadre di Parma e provincia.{' '}
          <a href={cl.fonteUrl} target="_blank" rel="noopener noreferrer">
            Classifica alla fonte <Icona nome="esterno" />
          </a>
        </p>
      </article>
    );
  }

  const conClassifica = d.campionati.filter((c) => d.classifiche.some((cl) => cl.campionatoId === c.id));
  const esterni = d.campionati.filter((c) => c.soloLinkEsterno);

  return (
    <>
      <TitoloPagina>Classifiche</TitoloPagina>
      {conClassifica.length === 0 && <Vuoto titolo="Nessuna classifica disponibile" />}
      <ul className="lista-classifiche">
        {conClassifica.flatMap((c) =>
          d.classifiche
            .filter((cl) => cl.campionatoId === c.id)
            .map((cl) => {
              const parmensi = cl.righe.filter((r) => d.squadra.get(r.squadraId)?.parmense).length;
              return (
                <li key={`${c.id}-${cl.girone}`}>
                  <a className="card tinta voce-classifica" style={stileTinta(c)} href={link('classifiche', c.id, cl.girone ?? '')}>
                    <BadgeCampionato c={c} />
                    <span>
                      {cl.titolo}
                      <span className="sotto">
                        {cl.righe.length} squadre{c.livello !== 'provinciale' ? ` · ${parmensi} di Parma` : ''}
                      </span>
                    </span>
                  </a>
                </li>
              );
            }),
        )}
      </ul>
      {esterni.map((c) => (
        <div key={c.id} className="card tinta voce-classifica esterna" style={stileTinta(c)}>
          <BadgeCampionato c={c} />
          <span>
            {c.nome}
            <span className="sotto">{c.nota}</span>
            <a href={c.fonteUrl} target="_blank" rel="noopener noreferrer">
              Apri fipavonline.it <Icona nome="esterno" />
            </a>
          </span>
        </div>
      ))}
    </>
  );
}

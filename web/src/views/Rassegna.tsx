import { useMemo, useState } from 'react';
import type { Articolo } from '../../../shared/model.ts';
import { ArticoloCard, squadreCitate } from '../components/ArticoloCard.tsx';
import { TitoloPagina, Vuoto } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { quando, titoloGiorno } from '../lib/date.ts';
import { usePreferiti } from '../lib/preferiti.ts';
import { link, vai } from '../lib/router.ts';

const GIORNI_INIZIALI = 14;

function perGiorno(articoli: Articolo[]): [string, Articolo[]][] {
  const gruppi = new Map<string, Articolo[]>();
  for (const a of articoli) gruppi.set(a.data, [...(gruppi.get(a.data) ?? []), a]);
  return [...gruppi];
}

/** Rassegna stampa; con `squadraId` mostra solo gli articoli che citano quella squadra. */
export function Rassegna({ squadraId }: { squadraId?: string }) {
  const d = useDati();
  const { preferiti } = usePreferiti();
  const [solo, setSolo] = useState<'tutte' | 'mie'>('tutte');
  const [limite, setLimite] = useState(GIORNI_INIZIALI);
  const r = d.rassegna;

  // Squadre citate almeno una volta, per il filtro (una voce per società, come nelle card).
  const citate = useMemo(() => {
    const voci = new Map<string, string>();
    for (const a of r?.articoli ?? []) for (const s of squadreCitate(a, d)) voci.set(s.id, s.nome);
    return [...voci].sort((x, y) => x[1].localeCompare(y[1], 'it'));
  }, [r, d]);

  const articoli = useMemo(() => {
    let lista = r?.articoli ?? [];
    if (squadraId) {
      // La voce del filtro rappresenta tutta la società: vale ogni squadra con la stessa società.
      const s = d.squadra.get(squadraId);
      const ids = new Set(d.squadre.filter((x) => x.id === squadraId || (s?.societa && x.societa === s.societa)).map((x) => x.id));
      lista = lista.filter((a) => a.squadre.some((id) => ids.has(id)));
    }
    if (solo === 'mie') lista = lista.filter((a) => a.squadre.some((id) => preferiti.includes(id)));
    return lista;
  }, [r, d, squadraId, solo, preferiti]);

  if (!r) {
    return (
      <>
        <TitoloPagina>Rassegna stampa</TitoloPagina>
        <Vuoto titolo="Rassegna non disponibile">
          <p>Gli articoli non sono ancora stati raccolti. Riprova dopo il prossimo aggiornamento dei dati.</p>
        </Vuoto>
      </>
    );
  }

  const gruppi = perGiorno(articoli);
  const testate = r.testate.map((t) => t.nome).join(', ');

  return (
    <>
      <TitoloPagina>Rassegna stampa</TitoloPagina>
      <div className="filtri-rassegna">
        <div className="chips" role="group" aria-label="Quali articoli">
          <button type="button" className="chip" aria-pressed={solo === 'tutte'} onClick={() => setSolo('tutte')}>
            Tutti
          </button>
          <button type="button" className="chip" aria-pressed={solo === 'mie'} onClick={() => setSolo('mie')}>
            Le mie squadre
          </button>
        </div>
        <label className="campo">
          <span className="sr-only">Squadra</span>
          <select value={squadraId ?? ''} onChange={(e) => (e.target.value ? vai('rassegna', e.target.value) : vai('rassegna'))}>
            <option value="">Tutte le squadre</option>
            {citate.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {gruppi.length === 0 ? (
        <Vuoto titolo="Nessun articolo">
          <p>
            {solo === 'mie' && !preferiti.length
              ? 'Non segui ancora nessuna squadra: tocca la stella nella pagina di una squadra.'
              : 'Non ci sono articoli di questa stagione per la scelta fatta.'}
          </p>
        </Vuoto>
      ) : (
        <>
          {gruppi.slice(0, limite).map(([giorno, lista]) => (
            <section key={giorno} className="giorno" aria-labelledby={`r-${giorno}`}>
              <h2 id={`r-${giorno}`} className="titolo-giorno">
                {titoloGiorno(giorno)}
                <span className="conteggio">
                  {lista.length} {lista.length === 1 ? 'articolo' : 'articoli'}
                </span>
              </h2>
              <div className="lista-card">
                {lista.map((a) => (
                  <ArticoloCard key={a.id} a={a} />
                ))}
              </div>
            </section>
          ))}
          {gruppi.length > limite && (
            <button type="button" className="pulsante secondario largo" onClick={() => setLimite((l) => l + GIORNI_INIZIALI)}>
              Mostra articoli precedenti ({gruppi.length - limite} giorni)
            </button>
          )}
        </>
      )}

      <p className="nota nota-fonte">
        Stagione {r.stagione} · aggiornata {quando(r.aggiornataIl)}. Titoli e link da {testate}: gli articoli si leggono sul
        sito della testata. <a href={link('info')}>Perché mancano altre testate</a>
      </p>
    </>
  );
}

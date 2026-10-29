import { useState } from 'react';
import type { Partita } from '../../../shared/model.ts';
import { titoloGiorno } from '../lib/date.ts';
import { perGiorno } from '../lib/filtri.ts';
import { PartitaCard } from './PartitaCard.tsx';

interface Props {
  partite: Partita[];
  /** Quanti giorni mostrare prima del pulsante "mostra altri". */
  giorniIniziali?: number;
  etichettaAltri?: string;
}

export function ListaPerGiorno({ partite, giorniIniziali = 14, etichettaAltri = 'Mostra altri giorni' }: Props) {
  const [limite, setLimite] = useState(giorniIniziali);
  const gruppi = perGiorno(partite);
  const visibili = gruppi.slice(0, limite);
  return (
    <>
      {visibili.map(([giorno, lista]) => (
        <section key={giorno ?? 'nd'} className="giorno" aria-labelledby={`g-${giorno ?? 'nd'}`}>
          <h2 id={`g-${giorno ?? 'nd'}`} className="titolo-giorno">
            {giorno ? titoloGiorno(giorno) : 'Da riprogrammare'}
            <span className="conteggio">
              {lista.length} {lista.length === 1 ? 'gara' : 'gare'}
            </span>
          </h2>
          <div className="lista-card">
            {lista.map((p) => (
              <PartitaCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ))}
      {gruppi.length > limite && (
        <button type="button" className="pulsante secondario largo" onClick={() => setLimite((l) => l + giorniIniziali)}>
          {etichettaAltri} ({gruppi.length - limite})
        </button>
      )}
    </>
  );
}

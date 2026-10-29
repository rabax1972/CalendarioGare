import { forma } from '../lib/analisi.ts';
import { useDati } from '../lib/dati.tsx';
import { dataBreve } from '../lib/date.ts';

/** Ultimi 5 risultati come pallini V/P, dal più vecchio al più recente. */
export function Forma({ squadraId, etichetta = false }: { squadraId: string; etichetta?: boolean }) {
  const d = useDati();
  const esiti = forma(squadraId, d.partite, d);
  if (!esiti.length) return null;
  const descrizione = esiti.map((e) => (e.vinta ? 'vinta' : 'persa')).join(', ');
  return (
    <span className="forma" role="img" aria-label={`Ultime ${esiti.length} gare, dalla più vecchia: ${descrizione}`}>
      {etichetta && (
        <span className="forma-etichetta" aria-hidden="true">
          Forma
        </span>
      )}
      {esiti.map((e) => (
        <span
          key={e.partitaId}
          className={`forma-pallino ${e.vinta ? 'vinta' : 'persa'}`}
          title={`${dataBreve(e.data)} · ${e.set[0]}-${e.set[1]} con ${e.avversario}`}
          aria-hidden="true"
        >
          {e.vinta ? 'V' : 'P'}
        </span>
      ))}
    </span>
  );
}

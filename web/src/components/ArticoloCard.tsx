import type { Articolo } from '../../../shared/model.ts';
import type { Dati } from '../lib/dati.tsx';
import { useDati } from '../lib/dati.tsx';
import { dataBreve } from '../lib/date.ts';
import { link } from '../lib/router.ts';
import { Icona } from './ui.tsx';

/**
 * Squadre citate, una voce per società: un articolo sull'Energy Volley non elenca tutte le sue squadre.
 * Il link porta alla prima squadra della società.
 */
export function squadreCitate(a: Articolo, d: Dati): { id: string; nome: string }[] {
  const gruppi = new Map<string, string[]>();
  for (const id of a.squadre) {
    const s = d.squadra.get(id);
    if (!s) continue;
    const chiave = s.societa ?? s.nome;
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), id]);
  }
  return [...gruppi].map(([societa, ids]) => ({ id: ids[0], nome: ids.length > 1 ? societa : d.squadra.get(ids[0])!.nome }));
}

export function ArticoloCard({ a, conData = false }: { a: Articolo; conData?: boolean }) {
  const d = useDati();
  const testata = d.rassegna?.testate.find((t) => t.id === a.testata);
  const squadre = squadreCitate(a, d);
  return (
    <article className="card articolo">
      <p className="articolo-testa">
        <span className="articolo-fonte">
          {testata?.nome ?? a.testata}
          {a.video && (
            <span className="etichetta-video">
              <Icona nome="video" /> Servizio TG
            </span>
          )}
        </span>
        {(conData || a.ora) && (
          <span className="dettaglio">
            {conData ? dataBreve(a.data) : ''}
            {conData && a.ora ? ' · ' : ''}
            {a.ora}
          </span>
        )}
      </p>
      <h3 className="articolo-titolo">
        <a href={a.url} target="_blank" rel="noopener noreferrer">
          {a.titolo}
          <span className="sr-only"> (si apre sul sito di {testata?.nome ?? 'origine'})</span>
          <Icona nome="esterno" />
        </a>
      </h3>
      {a.estratto && <p className="articolo-estratto">{a.estratto}</p>}
      {squadre.length > 0 && (
        <ul className="articolo-squadre" aria-label="Squadre citate">
          {squadre.map((s) => (
            <li key={s.id}>
              <a href={link('squadra', s.id)}>{s.nome}</a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

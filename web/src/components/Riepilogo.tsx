import { contoAllaRovescia, prossimaGara, riepilogoWeekend } from '../lib/analisi.ts';
import { useDati } from '../lib/dati.tsx';
import { dataBreve, type Periodo } from '../lib/date.ts';
import { usePreferiti } from '../lib/preferiti.ts';
import { link } from '../lib/router.ts';
import { Stemma } from './Stemma.tsx';
import { BadgeCampionato, Icona, stileTinta } from './ui.tsx';

/** Testata della home: il weekend a colpo d'occhio e la prossima gara delle squadre seguite. */
export function Riepilogo({ onPeriodo }: { onPeriodo: (p: Periodo) => void }) {
  const d = useDati();
  const { preferiti } = usePreferiti();
  const r = riepilogoWeekend(d.partite, d);
  const prossima = preferiti.length ? prossimaGara(d.partite, preferiti) : null;

  return (
    <section className="riepilogo" aria-labelledby="titolo-riepilogo">
      <div className="riepilogo-weekend">
        <p className="riepilogo-sopra">
          {r.periodo === 'weekend' ? 'Questo weekend a Parma' : 'Prossimi 7 giorni a Parma'}
          <span>
            {dataBreve(r.da)} – {dataBreve(r.a)}
          </span>
        </p>
        <h2 id="titolo-riepilogo" className="sr-only">
          Riepilogo
        </h2>
        {r.gare ? (
          <dl className="numeri">
            <div>
              <dt>gare</dt>
              <dd>{r.gare}</dd>
            </div>
            <div>
              <dt>in provincia</dt>
              <dd>{r.inCasa}</dd>
            </div>
            <div className={r.derby ? 'con-derby' : undefined}>
              <dt>derby</dt>
              <dd>{r.derby}</dd>
            </div>
          </dl>
        ) : (
          <p className="riepilogo-vuoto">Nessuna gara in programma: pausa dei campionati.</p>
        )}
        {r.gare > 0 && (
          <button type="button" className="riepilogo-azione" onClick={() => onPeriodo(r.periodo)}>
            Vedi {r.periodo === 'weekend' ? 'le gare del weekend' : 'le gare della settimana'} <Icona nome="avanti" />
          </button>
        )}
      </div>

      {prossima ? (
        <ProssimaGara id={prossima.id} />
      ) : (
        !preferiti.length && (
          <a className="card invito-segui" href={link('squadre')}>
            <Icona nome="stella" />
            <span>
              <strong>Segui le tue squadre</strong>
              <span className="sotto">Qui comparirà la loro prossima gara, con il conto alla rovescia.</span>
            </span>
          </a>
        )
      )}
    </section>
  );
}

function ProssimaGara({ id }: { id: string }) {
  const d = useDati();
  const { seguita } = usePreferiti();
  const p = d.partita.get(id)!;
  const c = d.campionato.get(p.campionatoId);
  const casa = d.squadra.get(p.casa);
  const ospite = d.squadra.get(p.ospite);
  const mia = seguita(p.casa) ? casa : ospite;
  return (
    <a className="card prossima tinta" style={stileTinta(c)} href={link('partita', p.id)}>
      <span className="prossima-sopra">
        <Icona nome="stella" piena /> La prossima di {mia?.nome}
      </span>
      <span className="prossima-quando">{contoAllaRovescia(p)}</span>
      <span className="prossima-sfida">
        <Stemma squadra={casa} misura="medio" />
        <span className="prossima-nomi">
          <span>{casa?.nome}</span>
          <span className="vs">contro</span>
          <span>{ospite?.nome}</span>
        </span>
        <Stemma squadra={ospite} misura="medio" />
      </span>
      <span className="prossima-sotto">
        <BadgeCampionato c={c} />
        {[p.palestra, p.comune].filter(Boolean).join(' · ')}
      </span>
    </a>
  );
}

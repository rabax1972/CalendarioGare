import { useState } from 'react';
import type { Atleta, Campionato, Rosa } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { dataBreve } from '../lib/date.ts';
import { iniziali } from '../lib/iniziali.ts';
import { link } from '../lib/router.ts';
import { Icona, stileTinta } from './ui.tsx';

const STAFF = /coach|allenat|staff|dirigent|scout|medic|fisioter|preparat|team manager/i;

function Figurina({ a, c }: { a: Atleta; c: Campionato | undefined }) {
  const [rotta, setRotta] = useState(false);
  return (
    <li className="figurina tinta" style={stileTinta(c)}>
      <span className="figurina-foto">
        {a.foto && !rotta ? (
          // La foto resta sul sito della fonte: niente referrer, caricamento solo quando serve.
          <img src={a.foto} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} />
        ) : (
          <span className="figurina-iniziali" aria-hidden="true">
            {iniziali(`${a.nome} ${a.cognome}`)}
          </span>
        )}
        {a.numero && (
          <span className="figurina-numero">
            <span className="sr-only">numero </span>
            {a.numero}
          </span>
        )}
      </span>
      <span className="figurina-nome">
        {a.nome} <strong>{a.cognome}</strong>
      </span>
      {a.ruolo && <span className="sotto">{a.ruolo}</span>}
    </li>
  );
}

export function RosaSquadra({ rosa }: { rosa: Rosa }) {
  const d = useDati();
  const s = d.squadra.get(rosa.squadraId);
  const c = s ? d.campionato.get(s.campionati[0]) : undefined;
  const staff = rosa.atleti.filter((a) => !a.numero && a.ruolo && STAFF.test(a.ruolo));
  const atleti = rosa.atleti.filter((a) => !staff.includes(a));
  const contatto = d.meta.contattoPrivacy;

  return (
    <section aria-labelledby="titolo-rosa">
      <h2 id="titolo-rosa" className="titolo-sezione">
        Rosa <span className="conteggio">{atleti.length} {atleti.length === 1 ? 'atleta' : 'atleti'}</span>
      </h2>
      <ul className="griglia-rosa">
        {atleti.map((a, i) => (
          <Figurina key={`${a.cognome}-${a.nome}-${i}`} a={a} c={c} />
        ))}
      </ul>
      {staff.length > 0 && (
        <>
          <h3 className="etichetta-mini">Staff</h3>
          <ul className="griglia-rosa">
            {staff.map((a, i) => (
              <Figurina key={`staff-${i}`} a={a} c={c} />
            ))}
          </ul>
        </>
      )}
      <p className="nota">
        Fonte: {rosa.fonte}, aggiornata {dataBreve(rosa.aggiornata)}.{' '}
        {rosa.fotoNascoste > 0 &&
          `${rosa.fotoNascoste === 1 ? 'Una foto non è mostrata' : `${rosa.fotoNascoste} foto non sono mostrate`} per tutela dei minori o su richiesta. `}
        <a href={rosa.fonteUrl} target="_blank" rel="noopener noreferrer" className="link-icona">
          Rosa alla fonte <Icona nome="esterno" />
        </a>
      </p>
      <p className="nota">
        Sei in questa rosa e non vuoi comparire?{' '}
        {contatto ? (
          <a href={contatto.includes('@') && !contatto.startsWith('mailto:') ? `mailto:${contatto}` : contatto}>Chiedi la rimozione</a>
        ) : (
          <a href={link('info')}>Come chiedere la rimozione</a>
        )}
        .
      </p>
    </section>
  );
}

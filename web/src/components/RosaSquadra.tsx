import { useEffect, useRef, useState } from 'react';
import type { Atleta, Campionato, Rosa } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { dataBreve } from '../lib/date.ts';
import { iniziali } from '../lib/iniziali.ts';
import { link } from '../lib/router.ts';
import { Icona, stileTinta } from './ui.tsx';

const STAFF = /coach|allenat|staff|dirigent|scout|medic|fisioter|preparat|team manager/i;

function FotoAtleta({ a, grande = false }: { a: Atleta; grande?: boolean }) {
  const [rotta, setRotta] = useState(false);
  // Nella scheda si chiede alla LVF il formato più grande della pagina profilo.
  const src = a.foto && grande ? a.foto.replace(/heightImg=\d+/, 'heightImg=254') : a.foto;
  return src && !rotta ? (
    // La foto resta sul sito della fonte: niente referrer, caricamento solo quando serve.
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} />
  ) : (
    <span className="figurina-iniziali" aria-hidden="true">
      {iniziali(`${a.nome} ${a.cognome}`)}
    </span>
  );
}

function Figurina({ a, c, onApri }: { a: Atleta; c: Campionato | undefined; onApri: (a: Atleta) => void }) {
  const contenuto = (
    <>
      <span className="figurina-foto">
        <FotoAtleta a={a} />
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
    </>
  );
  return (
    <li className="figurina tinta" style={stileTinta(c)}>
      {a.scheda ? (
        <button type="button" className="figurina-apri" onClick={() => onApri(a)} aria-haspopup="dialog">
          {contenuto}
        </button>
      ) : (
        contenuto
      )}
    </li>
  );
}

function DialogoAtleta({ a, c, fonte, onChiudi }: { a: Atleta | null; c: Campionato | undefined; fonte: string; onChiudi: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (a && !dlg.open) dlg.showModal();
    if (!a && dlg.open) dlg.close();
  }, [a]);
  const s = a?.scheda;

  return (
    <dialog
      ref={ref}
      className="dialogo tinta"
      style={stileTinta(c)}
      aria-labelledby="titolo-atleta"
      onClose={onChiudi}
      onClick={(e) => e.target === ref.current && onChiudi()}
    >
      {a && s && (
        <>
          <div className="dialogo-testa">
            <span className="etichetta-mini">Scheda atleta</span>
            <button type="button" className="icona-pulsante" onClick={onChiudi} aria-label="Chiudi scheda">
              <Icona nome="chiudi" />
            </button>
          </div>
          <div className="dialogo-corpo">
            <div className="scheda-atleta-testa">
              <span className="figurina-foto scheda-atleta-foto">
                <FotoAtleta a={a} grande />
                {a.numero && (
                  <span className="figurina-numero">
                    <span className="sr-only">numero </span>
                    {a.numero}
                  </span>
                )}
              </span>
              <div>
                <h2 id="titolo-atleta" className="scheda-atleta-nome">
                  {a.nome} <strong>{a.cognome}</strong>
                </h2>
                {a.ruolo && <p className="sotto">{a.ruolo}</p>}
              </div>
            </div>
            {(s.altezza || s.nazionalita) && (
              <dl className="scheda-atleta-dati">
                {s.altezza && (
                  <div>
                    <dt>Altezza</dt>
                    <dd>{s.altezza} cm</dd>
                  </div>
                )}
                {s.nazionalita && (
                  <div>
                    <dt>Nazionalità sportiva</dt>
                    <dd>{s.nazionalita}</dd>
                  </div>
                )}
              </dl>
            )}
            {s.carriera.length > 0 && (
              <>
                <h3 className="etichetta-mini">Carriera</h3>
                <table className="scheda-atleta-carriera">
                  <thead>
                    <tr>
                      <th scope="col">Stagione</th>
                      <th scope="col">Serie</th>
                      <th scope="col">Squadra</th>
                      <th scope="col">
                        <abbr title="Numero di maglia">N.</abbr>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.carriera.map((r, i) => (
                      <tr key={i}>
                        <td>{r.stagione.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1/$2')}</td>
                        <td>{r.serie}</td>
                        <td>{r.squadra}</td>
                        <td>{r.numero ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p className="nota">
              Fonte: {fonte}.{' '}
              <a href={s.profilo} target="_blank" rel="noopener noreferrer" className="link-icona">
                Profilo e statistiche <Icona nome="esterno" />
              </a>
            </p>
          </div>
        </>
      )}
    </dialog>
  );
}

export function RosaSquadra({ rosa }: { rosa: Rosa }) {
  const d = useDati();
  const s = d.squadra.get(rosa.squadraId);
  const c = s ? d.campionato.get(s.campionati[0]) : undefined;
  const staff = rosa.atleti.filter((a) => !a.numero && a.ruolo && STAFF.test(a.ruolo));
  const atleti = rosa.atleti.filter((a) => !staff.includes(a));
  const contatto = d.meta.contattoPrivacy;
  const [aperta, setAperta] = useState<Atleta | null>(null);

  return (
    <section aria-labelledby="titolo-rosa">
      <h2 id="titolo-rosa" className="titolo-sezione">
        Rosa <span className="conteggio">{atleti.length} {atleti.length === 1 ? 'atleta' : 'atleti'}</span>
      </h2>
      <ul className="griglia-rosa">
        {atleti.map((a, i) => (
          <Figurina key={`${a.cognome}-${a.nome}-${i}`} a={a} c={c} onApri={setAperta} />
        ))}
      </ul>
      {staff.length > 0 && (
        <>
          <h3 className="etichetta-mini">Staff</h3>
          <ul className="griglia-rosa">
            {staff.map((a, i) => (
              <Figurina key={`staff-${i}`} a={a} c={c} onApri={setAperta} />
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
      <DialogoAtleta a={aperta} c={c} fonte={rosa.fonte} onChiudi={() => setAperta(null)} />
    </section>
  );
}

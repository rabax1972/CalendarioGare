import { useEffect, useRef } from 'react';
import { useDati } from '../lib/dati.tsx';
import { link } from '../lib/router.ts';
import { Icona, stileTinta } from './ui.tsx';

const TITOLI = { provinciale: 'Provinciali', regionale: 'Regionali (solo gare con squadre di Parma)', nazionale: 'Nazionali (solo gare con squadre di Parma)' };

export function ElencoLegenda() {
  const d = useDati();
  return (
    <>
      {(['provinciale', 'regionale', 'nazionale'] as const).map((livello) => {
        const lista = d.campionati.filter((c) => c.livello === livello);
        if (!lista.length) return null;
        return (
          <section key={livello} className="legenda-gruppo">
            <h3>{TITOLI[livello]}</h3>
            <ul className="legenda">
              {lista.map((c) => (
                <li key={c.id} className="tinta" style={stileTinta(c)}>
                  <span className="badge tinta" style={stileTinta(c)}>
                    {c.nomeBreve}
                  </span>
                  <span>
                    {c.nome}
                    <span className="sotto">
                      {c.federazione}
                      {c.gironi.length ? ` · gironi ${c.gironi.join(', ')}` : ''}
                      {c.soloLinkEsterno ? ' · solo sul sito della fonte' : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function DialogoLegenda({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (aperto && !dlg.open) dlg.showModal();
    if (!aperto && dlg.open) dlg.close();
  }, [aperto]);

  return (
    <dialog ref={ref} className="dialogo" aria-labelledby="titolo-legenda" onClose={onChiudi} onClick={(e) => e.target === ref.current && onChiudi()}>
      <div className="dialogo-testa">
        <h2 id="titolo-legenda">Legenda colori</h2>
        <button type="button" className="icona-pulsante" onClick={onChiudi} aria-label="Chiudi legenda">
          <Icona nome="chiudi" />
        </button>
      </div>
      <div className="dialogo-corpo">
        <ElencoLegenda />
        <p className="nota">
          <a href={link('info')} onClick={onChiudi}>
            Fonti dei dati e stato degli aggiornamenti
          </a>
        </p>
      </div>
    </dialog>
  );
}

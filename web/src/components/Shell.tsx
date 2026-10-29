import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStatoDati } from '../lib/dati.tsx';
import { oreDa, quando } from '../lib/date.ts';
import { link } from '../lib/router.ts';
import { DialogoLegenda } from './Legenda.tsx';
import { Icona } from './ui.tsx';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const su = () => setOnline(true);
    const giu = () => setOnline(false);
    window.addEventListener('online', su);
    window.addEventListener('offline', giu);
    return () => {
      window.removeEventListener('online', su);
      window.removeEventListener('offline', giu);
    };
  }, []);
  return online;
}

export function Intestazione() {
  const { dati } = useStatoDati();
  const [legenda, setLegenda] = useState(false);
  const online = useOnline();
  const meta = dati?.meta;
  const problemi = meta?.fonti.filter((f) => f.abilitata && !f.ok) ?? [];
  const vecchi = meta ? oreDa(meta.generatoIl) > 12 : false;

  return (
    <header className="intestazione">
      <div className="intestazione-riga">
        <a href={link('')} className="logo">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="28" height="28" />
          <span>Volley Parma</span>
        </a>
        <div className="intestazione-azioni">
          {dati && (
            <button type="button" className="icona-pulsante" onClick={() => setLegenda(true)} aria-label="Legenda colori dei campionati">
              <Icona nome="legenda" />
            </button>
          )}
          <a className="icona-pulsante" href={link('info')} aria-label="Informazioni e fonti dei dati">
            <Icona nome="info" />
          </a>
        </div>
      </div>
      {meta && (
        <p className={`aggiornamento${problemi.length || vecchi ? ' avviso' : ''}`}>
          {!online && <strong>Offline · </strong>}
          Dati aggiornati {quando(meta.generatoIl)}
          {(problemi.length > 0 || vecchi) && (
            <>
              {' · '}
              <a href={link('info')}>
                {problemi.length ? `${problemi.length === 1 ? 'una fonte' : `${problemi.length} fonti`} non aggiornat${problemi.length === 1 ? 'a' : 'e'}` : 'dati non recenti'}
              </a>
            </>
          )}
        </p>
      )}
      {dati && <DialogoLegenda aperto={legenda} onChiudi={() => setLegenda(false)} />}
    </header>
  );
}

const VOCI = [
  { percorso: '', etichetta: 'Gare', icona: 'calendario' },
  { percorso: 'risultati', etichetta: 'Risultati', icona: 'risultati' },
  { percorso: 'mie', etichetta: 'Le mie', icona: 'stella' },
  { percorso: 'classifiche', etichetta: 'Classifiche', icona: 'classifica' },
  { percorso: 'squadre', etichetta: 'Squadre', icona: 'squadre' },
  { percorso: 'rassegna', etichetta: 'Stampa', icona: 'giornale' },
] as const;

export function Navigazione({ attiva }: { attiva: string }) {
  return (
    <nav className="navigazione" aria-label="Sezioni">
      {VOCI.map((v) => {
        const corrente = attiva === v.percorso;
        return (
          <a key={v.percorso} href={link(v.percorso)} aria-current={corrente ? 'page' : undefined}>
            <Icona nome={v.icona} piena={corrente && v.icona === 'stella'} />
            <span>{v.etichetta}</span>
          </a>
        );
      })}
    </nav>
  );
}

/** Avvisi del service worker: nuova versione disponibile, app pronta offline. */
export function AvvisiPwa() {
  const {
    needRefresh: [nuovaVersione, setNuovaVersione],
    offlineReady: [prontaOffline, setProntaOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Controlla aggiornamenti dell'app ogni ora mentre è aperta.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!prontaOffline) return;
    const t = setTimeout(() => setProntaOffline(false), 5000);
    return () => clearTimeout(t);
  }, [prontaOffline, setProntaOffline]);

  if (!nuovaVersione && !prontaOffline) return null;
  return (
    <div className="avviso-pwa" role="status" aria-live="polite">
      {nuovaVersione ? (
        <>
          <span>Nuova versione disponibile.</span>
          <button type="button" className="pulsante primario" onClick={() => updateServiceWorker(true)}>
            Aggiorna
          </button>
          <button type="button" className="pulsante secondario" onClick={() => setNuovaVersione(false)}>
            Più tardi
          </button>
        </>
      ) : (
        <span>App pronta: funziona anche offline con gli ultimi dati scaricati.</span>
      )}
    </div>
  );
}

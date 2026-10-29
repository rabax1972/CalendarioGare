import { useEffect, useRef } from 'react';
import { AvvisiPwa, Intestazione, Navigazione } from './components/Shell.tsx';
import { Vuoto } from './components/ui.tsx';
import { DatiProvider, useStatoDati } from './lib/dati.tsx';
import { useRotta } from './lib/router.ts';
import { Classifiche } from './views/Classifiche.tsx';
import { Info } from './views/Info.tsx';
import { MieSquadre } from './views/MieSquadre.tsx';
import { Partita } from './views/Partita.tsx';
import { Prossime } from './views/Prossime.tsx';
import { Rassegna } from './views/Rassegna.tsx';
import { Risultati } from './views/Risultati.tsx';
import { Squadra } from './views/Squadra.tsx';
import { Squadre } from './views/Squadre.tsx';

function Pagina({ rotta }: { rotta: string[] }) {
  const [sezione, a, b] = rotta;
  switch (sezione) {
    case undefined:
      return <Prossime />;
    case 'risultati':
      return <Risultati />;
    case 'mie':
      return <MieSquadre />;
    case 'classifiche':
      return <Classifiche campionatoId={a} girone={b} />;
    case 'squadre':
      return <Squadre />;
    case 'squadra':
      return <Squadra id={a} />;
    case 'partita':
      return <Partita id={a} />;
    case 'rassegna':
      return <Rassegna squadraId={a} />;
    case 'info':
      return <Info />;
    default:
      return <Vuoto titolo="Pagina non trovata" />;
  }
}

/** Sezione evidenziata nella barra: le pagine di dettaglio appartengono alla sezione da cui si arriva più spesso. */
function sezioneAttiva(rotta: string[]): string {
  const s = rotta[0] ?? '';
  if (s === 'squadra') return 'squadre';
  if (s === 'partita') return '';
  return s;
}

function Contenuto() {
  const { dati, errore, ricarica } = useStatoDati();
  const rotta = useRotta();
  const main = useRef<HTMLElement>(null);
  const chiave = rotta.join('/');

  useEffect(() => {
    window.scrollTo(0, 0);
    // Al cambio pagina il focus va sul contenuto, così chi usa lettori di schermo sente la nuova pagina.
    if (chiave) main.current?.focus({ preventScroll: true });
  }, [chiave]);

  return (
    <>
      <a className="salta" href="#contenuto">
        Vai al contenuto
      </a>
      <Intestazione />
      <main id="contenuto" ref={main} tabIndex={-1}>
        {dati ? (
          <Pagina key={chiave} rotta={rotta} />
        ) : errore ? (
          <Vuoto titolo="Impossibile caricare i dati">
            <p>
              {navigator.onLine
                ? 'Il server non ha risposto. Riprova tra poco.'
                : "Sei offline e su questo dispositivo non ci sono ancora dati salvati: apri l'app almeno una volta con la connessione."}
            </p>
            <button type="button" className="pulsante primario" onClick={ricarica}>
              Riprova
            </button>
          </Vuoto>
        ) : (
          <div className="caricamento" role="status">
            Caricamento delle gare…
          </div>
        )}
      </main>
      <Navigazione attiva={sezioneAttiva(rotta)} />
      <AvvisiPwa />
    </>
  );
}

export function App() {
  return (
    <DatiProvider>
      <Contenuto />
    </DatiProvider>
  );
}

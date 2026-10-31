import { useMemo, useState } from 'react';
import { BarraFiltri } from '../components/BarraFiltri.tsx';
import { ListaPerGiorno } from '../components/ListaPerGiorno.tsx';
import { Riepilogo } from '../components/Riepilogo.tsx';
import { Icona, TitoloPagina, Vuoto } from '../components/ui.tsx';
import { VistaSettimana } from '../components/VistaSettimana.tsx';
import { useDati } from '../lib/dati.tsx';
import { aggiungiGiorni, intervallo, oggiIso, type Periodo } from '../lib/date.ts';
import { applicaFiltri, quantiFiltri, statoFiltri } from '../lib/filtri.ts';
import { link } from '../lib/router.ts';
import { lunedi } from '../lib/settimana.ts';
import { creaStato } from '../lib/storage.ts';

const statoPeriodo = creaStato<Periodo>('volley-parma:periodo', 'settimana');
type Vista = 'lista' | 'settimana';
const statoVista = creaStato<Vista>('volley-parma:vista', 'lista');

function SceltaVista({ vista, onVista }: { vista: Vista; onVista: (v: Vista) => void }) {
  return (
    <div className="segmenti scelta-vista" role="group" aria-label="Visualizzazione">
      <button type="button" className="segmento" aria-pressed={vista === 'lista'} onClick={() => onVista('lista')}>
        <Icona nome="legenda" />
        Lista
      </button>
      <button type="button" className="segmento" aria-pressed={vista === 'settimana'} onClick={() => onVista('settimana')}>
        <Icona nome="calendario" />
        Settimana
      </button>
    </div>
  );
}

export function Prossime() {
  const d = useDati();
  const [periodo, setPeriodo] = statoPeriodo.usa();
  const [filtri] = statoFiltri.usa();
  const [vista, setVista] = statoVista.usa();
  const oggi = oggiIso();
  const [lun, setLun] = useState(() => lunedi(oggi));

  // Nella settimana si vedono anche le gare già giocate, con il risultato, come in un calendario.
  const settimana = useMemo(() => {
    const dom = aggiungiGiorni(lun, 6);
    return applicaFiltri(
      d.partite.filter((p) => p.data !== null && p.data >= lun && p.data <= dom),
      filtri,
      d,
    );
  }, [d, filtri, lun]);

  const partite = useMemo(() => {
    const { da, a } = intervallo(periodo, oggi);
    const future = d.partite.filter(
      (p) => p.stato !== 'giocata' && p.data !== null && p.data >= da && (a === null || p.data <= a),
    );
    // Le gare rinviate senza nuova data restano visibili in fondo, nel gruppo "Da riprogrammare".
    const senzaData = periodo === 'tutte' ? d.partite.filter((p) => p.data === null && p.stato !== 'giocata') : [];
    return applicaFiltri([...future, ...senzaData], filtri, d);
  }, [d, periodo, filtri, oggi]);

  const fipav = d.campionati.find((c) => c.soloLinkEsterno);

  return (
    <>
      <Riepilogo
        onPeriodo={(p) => {
          setVista('lista');
          setPeriodo(p);
        }}
      />
      <TitoloPagina azioni={<SceltaVista vista={vista} onVista={setVista} />}>
        {vista === 'settimana' ? 'Calendario' : 'Prossime gare'}
      </TitoloPagina>
      {vista === 'settimana' ? (
        <>
          <BarraFiltri totale={settimana.length} />
          <VistaSettimana partite={settimana} lun={lun} onLun={setLun} />
        </>
      ) : (
        <>
          <BarraFiltri periodo={periodo} onPeriodo={setPeriodo} totale={partite.length} />
          {partite.length ? (
            <ListaPerGiorno partite={partite} />
          ) : (
            <Vuoto titolo={periodo === 'oggi' ? 'Nessuna gara oggi' : periodo === 'weekend' ? 'Nessuna gara nel weekend' : 'Nessuna gara in programma'}>
              {quantiFiltri(filtri) > 0 && <p>Prova a togliere qualche filtro.</p>}
              {periodo !== 'tutte' && (
                <button type="button" className="pulsante secondario" onClick={() => setPeriodo('tutte')}>
                  Mostra tutte le prossime gare
                </button>
              )}
            </Vuoto>
          )}
        </>
      )}
      {fipav && (
        <p className="nota nota-fonte">
          I campionati provinciali FIPAV (Divisioni e giovanili) non sono inclusi:{' '}
          <a href={link('info')}>perché</a> ·{' '}
          <a href={fipav.fonteUrl} target="_blank" rel="noopener noreferrer">
            consultali su fipavonline.it
          </a>
        </p>
      )}
    </>
  );
}

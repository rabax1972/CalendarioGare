import { useMemo } from 'react';
import { BarraFiltri } from '../components/BarraFiltri.tsx';
import { ListaPerGiorno } from '../components/ListaPerGiorno.tsx';
import { Riepilogo } from '../components/Riepilogo.tsx';
import { TitoloPagina, Vuoto } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { intervallo, oggiIso, type Periodo } from '../lib/date.ts';
import { applicaFiltri, quantiFiltri, statoFiltri } from '../lib/filtri.ts';
import { link } from '../lib/router.ts';
import { creaStato } from '../lib/storage.ts';

const statoPeriodo = creaStato<Periodo>('volley-parma:periodo', 'settimana');

export function Prossime() {
  const d = useDati();
  const [periodo, setPeriodo] = statoPeriodo.usa();
  const [filtri] = statoFiltri.usa();
  const oggi = oggiIso();

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
      <Riepilogo onPeriodo={setPeriodo} />
      <TitoloPagina>Prossime gare</TitoloPagina>
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

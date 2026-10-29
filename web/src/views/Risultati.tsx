import { useMemo } from 'react';
import { BarraFiltri } from '../components/BarraFiltri.tsx';
import { ListaPerGiorno } from '../components/ListaPerGiorno.tsx';
import { TitoloPagina, Vuoto } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { oggiIso } from '../lib/date.ts';
import { applicaFiltri, statoFiltri } from '../lib/filtri.ts';

export function Risultati() {
  const d = useDati();
  const [filtri] = statoFiltri.usa();
  const oggi = oggiIso();

  const partite = useMemo(() => {
    // Gare giocate più quelle già passate senza risultato (segnalate come "risultato non disponibile").
    const passate = d.partite.filter((p) => p.data !== null && (p.stato === 'giocata' || p.data < oggi) && p.data <= oggi);
    return applicaFiltri(passate, filtri, d).sort(
      (a, b) => b.data!.localeCompare(a.data!) || (a.ora ?? '').localeCompare(b.ora ?? ''),
    );
  }, [d, filtri, oggi]);

  return (
    <>
      <TitoloPagina>Risultati</TitoloPagina>
      <BarraFiltri totale={partite.length} />
      {partite.length ? (
        <ListaPerGiorno partite={partite} giorniIniziali={10} etichettaAltri="Mostra giorni precedenti" />
      ) : (
        <Vuoto titolo="Nessun risultato">
          <p>Non ci sono ancora gare giocate per i campionati e i filtri scelti.</p>
        </Vuoto>
      )}
    </>
  );
}

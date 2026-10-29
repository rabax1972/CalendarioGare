import { useMemo } from 'react';
import { ListaPerGiorno } from '../components/ListaPerGiorno.tsx';
import { PartitaCard } from '../components/PartitaCard.tsx';
import { Stemma } from '../components/Stemma.tsx';
import { BadgeCampionato, PulsanteSegui, TitoloPagina, Vuoto } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { aggiungiGiorni, oggiIso } from '../lib/date.ts';
import { usePreferiti } from '../lib/preferiti.ts';
import { link } from '../lib/router.ts';

export function MieSquadre() {
  const d = useDati();
  const { preferiti } = usePreferiti();
  const oggi = oggiIso();
  const squadre = preferiti.map((id) => d.squadra.get(id)).filter((s) => s !== undefined);
  const mancanti = preferiti.length - squadre.length;

  const prossime = useMemo(() => {
    const set = new Set(preferiti);
    const limite = aggiungiGiorni(oggi, 30);
    return d.partite.filter(
      (p) => (set.has(p.casa) || set.has(p.ospite)) && p.stato !== 'giocata' && p.data !== null && p.data >= oggi && p.data <= limite,
    );
  }, [d, preferiti, oggi]);

  if (!squadre.length) {
    return (
      <>
        <TitoloPagina>Le mie squadre</TitoloPagina>
        <Vuoto titolo="Non segui ancora nessuna squadra">
          <p>Segui le tue squadre per avere qui prossime gare e ultimi risultati. Le scelte restano salvate su questo dispositivo.</p>
          <a className="pulsante primario" href={link('squadre')}>
            Scegli le squadre
          </a>
        </Vuoto>
      </>
    );
  }

  return (
    <>
      <TitoloPagina>Le mie squadre</TitoloPagina>
      {mancanti > 0 && (
        <p className="nota">
          {mancanti === 1 ? 'Una squadra seguita non è' : `${mancanti} squadre seguite non sono`} più presenti nei dati (es. cambio di stagione).
        </p>
      )}
      <div className="griglia-mie">
        {squadre.map((s) => {
          const sue = d.partite.filter((p) => p.casa === s.id || p.ospite === s.id);
          const prossima = sue.find((p) => p.stato !== 'giocata' && p.data !== null && p.data >= oggi);
          const ultima = sue.filter((p) => p.stato === 'giocata').at(-1);
          return (
            <section key={s.id} className="mia-squadra" aria-labelledby={`mia-${s.id}`}>
              <div className="mia-testa">
                <Stemma squadra={s} misura="medio" />
                <div className="mia-nome">
                  <h2 id={`mia-${s.id}`}>
                    <a href={link('squadra', s.id)}>{s.nome}</a>
                  </h2>
                  <BadgeCampionato c={d.campionato.get(s.campionati[0])} esteso />
                </div>
                <PulsanteSegui id={s.id} nome={s.nome} compatto />
              </div>
              {ultima && (
                <>
                  <h3 className="etichetta-mini">Ultimo risultato</h3>
                  <PartitaCard p={ultima} mostraData />
                </>
              )}
              <h3 className="etichetta-mini">Prossima gara</h3>
              {prossima ? <PartitaCard p={prossima} mostraData /> : <p className="nota">Nessuna gara in programma.</p>}
            </section>
          );
        })}
      </div>
      <h2 className="titolo-sezione">Calendario dei prossimi 30 giorni</h2>
      {prossime.length ? <ListaPerGiorno partite={prossime} /> : <p className="nota">Nessuna gara nei prossimi 30 giorni.</p>}
    </>
  );
}

import { ElencoLegenda } from '../components/Legenda.tsx';
import { Icona, TitoloPagina } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { quando } from '../lib/date.ts';

const SITI: Record<string, { url: string; etichetta: string }> = {
  csen: { url: 'https://www.volleymistocsenparma.it/Calendario', etichetta: 'volleymistocsenparma.it' },
  'fipav-parma': { url: 'https://fipavonline.it/main/tutti_i_campionati/08038', etichetta: 'fipavonline.it' },
  crer: { url: 'https://crer.portalefipav.net/risultati-classifiche.aspx?PId=29422', etichetta: 'crer.portalefipav.net' },
  myvolley: { url: 'https://www.federvolley.it/campionati/serie-a-b', etichetta: 'federvolley.it' },
};

export function Info() {
  const d = useDati();
  return (
    <>
      <TitoloPagina>Informazioni</TitoloPagina>

      <section className="blocco" aria-labelledby="t-fonti">
        <h2 id="t-fonti">Fonti dei dati · stagione {d.meta.stagione}</h2>
        <p>
          Dati aggiornati {quando(d.meta.generatoIl)}. Lo scraper controlla le fonti ogni 2 ore.
        </p>
        <ul className="fonti">
          {d.meta.fonti.map((f) => (
            <li key={f.id} className={f.abilitata ? (f.ok ? 'ok' : 'errore') : 'spenta'}>
              <strong>{f.nome}</strong>
              <span className="sotto">
                {!f.abilitata
                  ? 'Non inclusa'
                  : f.ok
                    ? `Aggiornata ${f.ultimoSuccesso ? quando(f.ultimoSuccesso) : ''} · ${f.partite} gare lette`
                    : `Ultimo aggiornamento non riuscito${f.ultimoSuccesso ? `: dati fermi a ${quando(f.ultimoSuccesso)}` : ''}`}
              </span>
              {SITI[f.id] && (
                <a href={SITI[f.id].url} target="_blank" rel="noopener noreferrer" className="link-icona">
                  {SITI[f.id].etichetta} <Icona nome="esterno" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="blocco" aria-labelledby="t-fipav">
        <h2 id="t-fipav">Perché mancano i campionati provinciali FIPAV</h2>
        <p>
          Calendari e risultati dei campionati provinciali FIPAV Parma (Divisioni, Under, Open misto) sono pubblicati solo su
          fipavonline.it, i cui termini vietano la raccolta automatica dei dati. Finché non ci sarà un'autorizzazione, li trovi
          solo sul sito ufficiale.
        </p>
        <p>
          <a href={SITI['fipav-parma'].url} target="_blank" rel="noopener noreferrer" className="link-icona">
            Campionati FIPAV Parma su fipavonline.it <Icona nome="esterno" />
          </a>
        </p>
      </section>

      <section className="blocco" aria-labelledby="t-rassegna">
        <h2 id="t-rassegna">Rassegna stampa</h2>
        <p>
          Gli articoli arrivano dai feed RSS di testate che non vietano la lettura automatica
          {d.rassegna ? ` (${d.rassegna.testate.map((t) => t.nome).join(', ')})` : ''}. Dell'articolo si mostrano solo titolo,
          data e qualche riga iniziale, con il link alla testata.
        </p>
        <p>
          Gazzetta di Parma, SportParma, ParmaToday, ParmaDaily e VolleyNews non sono inclusi: i loro termini o le loro
          protezioni non consentono la raccolta automatica. I loro articoli possono comparire solo se aggiunti a mano.
        </p>
      </section>

      <section className="blocco" aria-labelledby="t-filtro">
        <h2 id="t-filtro">Regionali e nazionali: solo squadre di Parma</h2>
        <p>
          Dei campionati regionali e nazionali sono mostrate solo le gare in cui gioca almeno una squadra di Parma o provincia,
          riconosciuta dal codice della società, dalla sigla «PR» o dall'elenco delle squadre provinciali.
        </p>
      </section>

      <section className="blocco" aria-labelledby="t-legenda">
        <h2 id="t-legenda">Legenda colori</h2>
        <ElencoLegenda />
      </section>

      <section className="blocco" aria-labelledby="t-privacy">
        <h2 id="t-privacy">Privacy</h2>
        <p>
          L'app non usa account né cookie di tracciamento. Le squadre seguite e i filtri restano salvati solo su questo
          dispositivo. I dati sulle gare sono quelli pubblici delle fonti: verifica sempre alla fonte per eventuali variazioni.
        </p>
        <p>
          <strong>Rose delle squadre.</strong> Per alcune squadre di Parma sono riportati nome, numero e ruolo degli atleti
          come pubblicati dal torneo CSEN Parma e dalla Lega Volley Femminile. Le foto non sono copiate: si caricano dal sito
          della fonte. Non vengono mai mostrate le foto di atleti minorenni, né quelle di chi non ha una data di nascita
          verificabile alla fonte. La data di nascita serve solo a questo controllo e non viene pubblicata.
        </p>
        <p>
          Vuoi togliere il tuo nome o la tua foto?{' '}
          {d.meta.contattoPrivacy ? (
            <>
              Scrivi a{' '}
              <a
                href={
                  d.meta.contattoPrivacy.includes('@') && !d.meta.contattoPrivacy.startsWith('mailto:')
                    ? `mailto:${d.meta.contattoPrivacy}`
                    : d.meta.contattoPrivacy
                }
              >
                {d.meta.contattoPrivacy.replace(/^mailto:/, '')}
              </a>
              : la richiesta viene applicata al successivo aggiornamento dei dati.
            </>
          ) : (
            'Chiedi la rimozione alla fonte (CSEN Parma o Lega Volley Femminile): al successivo aggiornamento i dati spariscono anche da qui.'
          )}
        </p>
      </section>
    </>
  );
}

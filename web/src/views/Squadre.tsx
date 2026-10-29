import { useMemo, useState } from 'react';
import { Stemma } from '../components/Stemma.tsx';
import { BadgeCampionato, PulsanteSegui, TitoloPagina, Vuoto, stileTinta } from '../components/ui.tsx';
import { useDati } from '../lib/dati.tsx';
import { link } from '../lib/router.ts';

function normalizza(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function Squadre() {
  const d = useDati();
  const [cerca, setCerca] = useState('');

  const gruppi = useMemo(() => {
    const q = normalizza(cerca.trim());
    const trovate = d.squadre.filter(
      (s) => s.parmense && (!q || normalizza(`${s.nome} ${s.comune ?? ''} ${s.societa ?? ''}`).includes(q)),
    );
    return d.campionati
      .filter((c) => !c.soloLinkEsterno)
      .map((c) => ({ c, squadre: trovate.filter((s) => s.campionati.includes(c.id)) }))
      .filter((g) => g.squadre.length);
  }, [d, cerca]);

  return (
    <>
      <TitoloPagina>Squadre di Parma e provincia</TitoloPagina>
      <label className="campo cerca">
        <span className="sr-only">Cerca squadra, società o comune</span>
        <input
          type="search"
          placeholder="Cerca squadra, società o comune"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          autoComplete="off"
        />
      </label>
      <p className="nota">Tocca la stella per seguire una squadra: la trovi in «Le mie».</p>
      {gruppi.length === 0 && <Vuoto titolo="Nessuna squadra trovata" />}
      {gruppi.map(({ c, squadre }) => (
        <section key={c.id} className="gruppo-squadre" aria-labelledby={`sq-${c.id}`}>
          <h2 id={`sq-${c.id}`} className="titolo-gruppo">
            <BadgeCampionato c={c} /> {c.nome}
          </h2>
          <ul className="lista-squadre">
            {squadre.map((s) => (
              <li key={s.id} className="tinta" style={stileTinta(c)}>
                <a href={link('squadra', s.id)}>
                  <Stemma squadra={s} misura="medio" />
                  <span>
                    <span className="nome-squadra">{s.nome}</span>
                    {s.comune && <span className="sotto">{s.comune}</span>}
                  </span>
                </a>
                <PulsanteSegui id={s.id} nome={s.nome} compatto />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

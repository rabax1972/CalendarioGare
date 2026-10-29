import { useId, useMemo, useState } from 'react';
import type { Genere, Livello } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { PERIODI, type Periodo } from '../lib/date.ts';
import { FILTRI_VUOTI, quantiFiltri, statoFiltri } from '../lib/filtri.ts';
import { Icona, stileTinta } from './ui.tsx';

const LIVELLI: { id: Livello; etichetta: string }[] = [
  { id: 'provinciale', etichetta: 'Provinciale' },
  { id: 'regionale', etichetta: 'Regionale' },
  { id: 'nazionale', etichetta: 'Nazionale' },
];

const GENERI: { id: Genere; etichetta: string }[] = [
  { id: 'femminile', etichetta: 'Femminile' },
  { id: 'maschile', etichetta: 'Maschile' },
  { id: 'misto', etichetta: 'Misto' },
];

function alterna<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

interface Props {
  periodo?: Periodo;
  onPeriodo?: (p: Periodo) => void;
  totale: number;
}

export function BarraFiltri({ periodo, onPeriodo, totale }: Props) {
  const d = useDati();
  const [filtri, setFiltri] = statoFiltri.usa();
  const [aperto, setAperto] = useState(false);
  const idPannello = useId();
  const n = quantiFiltri(filtri);

  const campionati = d.campionati.filter((c) => !c.soloLinkEsterno);
  const squadre = useMemo(() => d.squadre.filter((s) => s.parmense), [d.squadre]);
  const comuni = useMemo(
    () => [...new Set(squadre.map((s) => s.comune).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'it')),
    [squadre],
  );

  return (
    <div className="barra-filtri">
      <div className="barra-riga">
        {periodo && onPeriodo && (
          <div className="segmenti" role="group" aria-label="Periodo">
            {PERIODI.map((p) => (
              <button
                key={p.id}
                type="button"
                className="segmento"
                aria-pressed={periodo === p.id}
                onClick={() => onPeriodo(p.id)}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="barra-riga">
        <span className="conteggio" aria-live="polite">
          {totale} {totale === 1 ? 'gara' : 'gare'}
          {n ? ' con i filtri attivi' : ''}
        </span>
        <button
          type="button"
          className={`pulsante filtri-toggle${n ? ' attivo' : ''}`}
          aria-expanded={aperto}
          aria-controls={idPannello}
          onClick={() => setAperto((a) => !a)}
        >
          <Icona nome="filtro" />
          Filtri{n ? ` (${n})` : ''}
        </button>
      </div>

      <div id={idPannello} className="pannello-filtri" hidden={!aperto}>
        <fieldset>
          <legend>Campionato</legend>
          <div className="chips">
            {campionati.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip tinta"
                style={stileTinta(c)}
                aria-pressed={filtri.campionati.includes(c.id)}
                onClick={() => setFiltri((f) => ({ ...f, campionati: alterna(f.campionati, c.id) }))}
              >
                <span className="pallino" aria-hidden="true" />
                {c.nome}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Livello</legend>
          <div className="chips">
            {LIVELLI.map((l) => (
              <button
                key={l.id}
                type="button"
                className="chip"
                aria-pressed={filtri.livelli.includes(l.id)}
                onClick={() => setFiltri((f) => ({ ...f, livelli: alterna(f.livelli, l.id) }))}
              >
                {l.etichetta}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Genere</legend>
          <div className="chips">
            {GENERI.map((g) => (
              <button
                key={g.id}
                type="button"
                className="chip"
                aria-pressed={filtri.generi.includes(g.id)}
                onClick={() => setFiltri((f) => ({ ...f, generi: alterna(f.generi, g.id) }))}
              >
                {g.etichetta}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="campi">
          <label className="campo">
            <span>Squadra</span>
            <select
              value={filtri.squadra ?? ''}
              onChange={(e) => setFiltri((f) => ({ ...f, squadra: e.target.value || null }))}
            >
              <option value="">Tutte</option>
              {squadre.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({d.campionato.get(s.campionati[0])?.nomeBreve ?? ''})
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Comune</span>
            <select value={filtri.comune ?? ''} onChange={(e) => setFiltri((f) => ({ ...f, comune: e.target.value || null }))}>
              <option value="">Tutti</option>
              {comuni.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pannello-azioni">
          <button type="button" className="pulsante secondario" onClick={() => setFiltri(FILTRI_VUOTI)} disabled={!n}>
            Azzera filtri
          </button>
          <button type="button" className="pulsante primario" onClick={() => setAperto(false)}>
            Mostra {totale} {totale === 1 ? 'gara' : 'gare'}
          </button>
        </div>
      </div>
    </div>
  );
}

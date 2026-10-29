import { useState } from 'react';
import type { Squadra } from '../../../shared/model.ts';
import { useDati } from '../lib/dati.tsx';
import { iniziali } from '../lib/iniziali.ts';
import { stileTinta } from './ui.tsx';

type Misura = 'piccolo' | 'medio' | 'grande';

/** Logo della squadra, o monogramma colorato col campionato se il logo non c'è. Decorativo: il nome è sempre accanto. */
export function Stemma({ squadra, misura = 'piccolo' }: { squadra: Squadra | undefined; misura?: Misura }) {
  const d = useDati();
  const [rotto, setRotto] = useState(false);
  const c = squadra ? d.campionato.get(squadra.campionati[0]) : undefined;
  if (squadra?.logo && !rotto) {
    return (
      <span className={`stemma stemma-${misura} con-logo`} aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}data/${squadra.logo}`} alt="" loading="lazy" decoding="async" onError={() => setRotto(true)} />
      </span>
    );
  }
  return (
    <span className={`stemma stemma-${misura} monogramma tinta`} style={stileTinta(c)} aria-hidden="true">
      {iniziali(squadra?.nome ?? '?')}
    </span>
  );
}

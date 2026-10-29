import type { CSSProperties, ReactNode } from 'react';
import type { Campionato } from '../../../shared/model.ts';
import { usePreferiti } from '../lib/preferiti.ts';

/** Variabili CSS col colore del campionato; il CSS sceglie la variante chiara o scura. */
export function stileTinta(c: Campionato | undefined): CSSProperties {
  if (!c) return {};
  return { '--tinta-chiaro': c.colore, '--tinta-scuro': c.coloreScuro } as CSSProperties;
}

export function BadgeCampionato({ c, esteso = false }: { c: Campionato | undefined; esteso?: boolean }) {
  if (!c) return null;
  return (
    <span className="badge tinta" style={stileTinta(c)} title={c.nome}>
      {esteso ? c.nome : c.nomeBreve}
    </span>
  );
}

const PERCORSI: Record<string, string> = {
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  risultati: 'M4 19h16M7 15V9M12 15V5M17 15v-3',
  stella: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z',
  classifica: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3',
  squadre: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  filtro: 'M3 5h18M6 12h12M10 19h4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
  legenda: 'M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12',
  mappa: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  condividi: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  esterno: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  indietro: 'M15 18l-6-6 6-6',
  avanti: 'M9 18l6-6-6-6',
  video: 'M15 10l5-3v10l-5-3M4 6h11v12H4z',
  immagine: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  chiudi: 'M18 6 6 18M6 6l12 12',
  orologio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  giornale: 'M4 4h13v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4ZM17 8h3v11a2 2 0 0 1-4 0M8 8h5M8 12h5M8 16h3',
  attenzione: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
};

export function Icona({ nome, piena = false }: { nome: keyof typeof PERCORSI; piena?: boolean }) {
  return (
    <svg
      className="icona"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill={piena ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PERCORSI[nome]} />
    </svg>
  );
}

export function PulsanteSegui({ id, nome, compatto = false }: { id: string; nome: string; compatto?: boolean }) {
  const { seguita, segui } = usePreferiti();
  const attiva = seguita(id);
  return (
    <button
      type="button"
      className={`segui${attiva ? ' attiva' : ''}${compatto ? ' compatto' : ''}`}
      aria-pressed={attiva}
      aria-label={attiva ? `Smetti di seguire ${nome}` : `Segui ${nome}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        segui(id);
      }}
    >
      <Icona nome="stella" piena={attiva} />
      {!compatto && <span>{attiva ? 'Seguita' : 'Segui'}</span>}
    </button>
  );
}

export function Vuoto({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="vuoto" role="status">
      <p className="vuoto-titolo">{titolo}</p>
      {children}
    </div>
  );
}

export function TitoloPagina({ children, azioni }: { children: ReactNode; azioni?: ReactNode }) {
  return (
    <div className="titolo-pagina">
      <h1>{children}</h1>
      {azioni}
    </div>
  );
}

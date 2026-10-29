import type { Campionato, Partita, RigaClassifica } from '../../shared/model.ts';

/** Squadra così come appare alla fonte, prima di alias e normalizzazione. */
export interface SquadraGrezza {
  nome: string;
  societa?: string | null;
  comune?: string | null;
  /** Sigla provincia dichiarata dalla fonte (es. "PR"). */
  provincia?: string | null;
  /** Codice affiliazione FIPAV a 9 cifre (es. "080380063"). */
  codiceSocieta?: string | null;
  /** Identificativo della società nella fonte (es. id portalefipav). */
  idSocietaFonte?: string | null;
  /** URL del logo pubblicato dalla fonte (solo fonti che ne consentono l'uso, vedi docs/FONTI.md). */
  logoUrl?: string | null;
}

export interface PartitaGrezza extends Omit<Partita, 'casa' | 'ospite'> {
  casa: SquadraGrezza;
  ospite: SquadraGrezza;
  provinciaPalestra?: string | null;
}

export type CampionatoGrezzo = Omit<Campionato, 'colore' | 'coloreScuro'>;

export interface RigaClassificaGrezza extends Omit<RigaClassifica, 'squadraId' | 'nome'> {
  squadra: SquadraGrezza;
}

export interface ClassificaGrezza {
  campionatoId: string;
  girone: string | null;
  titolo: string;
  fonteUrl: string;
  righe: RigaClassificaGrezza[];
}

/** Ultimo risultato valido di una fonte, salvato in data/fonti/<id>.json. */
export interface Snapshot {
  fonte: string;
  aggiornatoIl: string;
  stagione: string;
  /** true per regionale/nazionale: tenere solo le gare con squadre di Parma. */
  filtroParma: boolean;
  campionati: CampionatoGrezzo[];
  partite: PartitaGrezza[];
  classifiche: ClassificaGrezza[];
}

export interface ContestoFonte {
  /** Riconosce una squadra parmense (usato nella scoperta dei gironi). */
  isParma: (s: SquadraGrezza, provinciaPalestraCasa?: string | null) => boolean;
  /** Chiave che invalida la cache di scoperta (cambia se cambiano alias o whitelist). */
  chiaveConfig: string;
  log: (msg: string) => void;
}

export interface Fonte {
  id: string;
  nome: string;
  abilitata: boolean;
  /** Numero minimo di partite atteso: sotto questa soglia il risultato è considerato anomalo. */
  minimoPartite: number;
  esegui: (ctx: ContestoFonte) => Promise<Snapshot>;
}

import type { FileWhitelist, TabellaAlias } from './alias.ts';
import { PREFISSO_CODICE_PARMA, PROVINCIA } from './config.ts';
import { separaProvincia } from './normalize.ts';
import type { SquadraGrezza } from './types.ts';

/**
 * Decide se una squadra è di Parma e provincia, e perché.
 * L'ordine dei controlli è quello del report: il primo che scatta è il motivo riportato.
 */
export class RiconoscitoreParma {
  private whitelist: Set<string>;
  private escluse: Set<string>;
  private codici: string[];
  private idCrer: Set<string>;

  constructor(
    private alias: TabellaAlias,
    wl: FileWhitelist,
    /** Chiavi delle squadre dei campionati provinciali (CSEN, FIPAV Parma). */
    private chiaviProvinciali: Set<string>,
  ) {
    const chiave = (n: string) => alias.risolvi(n).chiave;
    this.whitelist = new Set((wl.squadre ?? []).map(chiave));
    this.escluse = new Set((wl.escludi ?? []).map(chiave));
    this.codici = [PREFISSO_CODICE_PARMA, ...(wl.codiciSocieta ?? [])];
    this.idCrer = new Set((wl.idSocietaCrer ?? []).map(String));
  }

  /** Motivo per cui la squadra è parmense, oppure null. */
  motivo(s: SquadraGrezza, provinciaPalestraCasa?: string | null): string | null {
    const { chiave } = this.alias.risolvi(s.nome);
    if (this.escluse.has(chiave)) return null;
    if (this.whitelist.has(chiave)) return 'whitelist manuale';
    if (s.codiceSocieta && this.codici.some((c) => s.codiceSocieta!.startsWith(c))) return `codice società ${s.codiceSocieta}`;
    if (s.provincia === PROVINCIA) return 'provincia PR dichiarata dalla fonte';
    if (separaProvincia(s.nome).provincia === PROVINCIA) return 'sigla PR nel nome';
    if (s.idSocietaFonte && this.idCrer.has(s.idSocietaFonte)) return `società ${s.idSocietaFonte} (whitelist/portale regionale)`;
    if (this.chiaviProvinciali.has(chiave)) return 'presente nei campionati provinciali';
    // Solo se la fonte non dice da dove viene la squadra: una gara in campo neutro a Parma
    // (es. Cremonese al PalaRaschi) non rende parmense una squadra di un'altra provincia.
    if (provinciaPalestraCasa === PROVINCIA && !s.provincia && !s.codiceSocieta) return 'gioca in casa in provincia di Parma';
    return null;
  }

  isParma = (s: SquadraGrezza, provinciaPalestraCasa?: string | null) => this.motivo(s, provinciaPalestraCasa) !== null;

  /** Società del portale regionale con almeno una squadra già riconosciuta: vale per tutte le sue squadre. */
  aggiungiSocietaCrer(id: string) {
    this.idCrer.add(id);
  }
}

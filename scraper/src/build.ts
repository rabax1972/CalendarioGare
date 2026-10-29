import type { Campionato, Classifica, Partita, Squadra } from '../../shared/model.ts';
import { TabellaAlias, type Configurazione } from './alias.ts';
import { assegnaColori } from './colors.ts';
import { slug } from './normalize.ts';
import { RiconoscitoreParma } from './parma.ts';
import type { CampionatoGrezzo, PartitaGrezza, Snapshot, SquadraGrezza } from './types.ts';

export interface Risultato {
  campionati: Campionato[];
  squadre: Squadra[];
  partite: Partita[];
  classifiche: Classifica[];
  /** Report in Markdown delle squadre di Parma incluse nei campionati regionali e nazionali. */
  report: string;
  /** Logo da scaricare per ogni squadra: URL, oppure false se disattivato a mano negli alias. */
  candidatiLogo: Map<string, string | false>;
}

interface SquadraInCostruzione extends Squadra {
  comuniCasa: Map<string, number>;
  logoFonte: string | false | null;
}

/** Crea il riconoscitore partendo dalle squadre dei campionati provinciali. */
export function creaRiconoscitore(snapshots: Snapshot[], config: Configurazione): RiconoscitoreParma {
  const alias = new TabellaAlias(config.alias);
  const chiavi = new Set<string>();
  for (const s of snapshots.filter((x) => !x.filtroParma)) {
    for (const p of s.partite) {
      chiavi.add(alias.risolvi(p.casa.nome).chiave);
      chiavi.add(alias.risolvi(p.ospite.nome).chiave);
    }
  }
  return new RiconoscitoreParma(alias, config.whitelist, chiavi);
}

/** Mantiene l'informazione "spostata" confrontando con i dati della volta precedente. */
export function applicaSpostamenti(partite: Partita[], precedenti: Partita[]): void {
  const prima = new Map(precedenti.map((p) => [p.id, p]));
  for (const p of partite) {
    const old = prima.get(p.id);
    if (!old) continue;
    const originale = old.spostata?.data ? old.spostata : { data: old.data, ora: old.ora };
    const cambiata = old.data !== p.data || old.ora !== p.ora;
    if (p.spostata && !p.spostata.data && old.data) {
      // La fonte segnala lo spostamento ma non la data originale: la recuperiamo dallo storico.
      p.spostata = cambiata ? originale : (old.spostata ?? { data: null, ora: null });
    } else if (!p.spostata && cambiata && old.data && p.stato !== 'giocata') {
      p.spostata = originale;
    } else if (!p.spostata && old.spostata && (old.spostata.data !== p.data || old.spostata.ora !== p.ora)) {
      p.spostata = old.spostata;
    }
    if (p.spostata && p.spostata.data === p.data && p.spostata.ora === p.ora) delete p.spostata;
  }
}

export function costruisci(
  snapshots: Snapshot[],
  config: Configurazione,
  extraCampionati: CampionatoGrezzo[] = [],
  precedenti: Partita[] = [],
): Risultato {
  const alias = new TabellaAlias(config.alias);
  const parma = creaRiconoscitore(snapshots, config);

  // Prima passata: le società del portale regionale con almeno una squadra di Parma riconosciuta.
  for (const s of snapshots.filter((x) => x.filtroParma)) {
    for (const p of s.partite) {
      for (const [sq, prov] of [[p.casa, p.provinciaPalestra], [p.ospite, null]] as const) {
        if (sq.idSocietaFonte && s.fonte === 'crer' && parma.motivo(sq, prov)) parma.aggiungiSocietaCrer(sq.idSocietaFonte);
      }
    }
  }

  const squadre = new Map<string, SquadraInCostruzione>();
  const registra = (sq: SquadraGrezza, campionatoId: string): string => {
    const r = alias.risolvi(sq.nome);
    // Stesso nome in campionati diversi (es. Serie D maschile e Under 17 femminile) = squadre diverse.
    const id = `${slug(r.chiave) || slug(sq.nome)}--${campionatoId}`;
    let s = squadre.get(id);
    if (!s) {
      s = {
        id,
        nome: r.nome,
        societa: r.voce?.societa ?? sq.societa ?? null,
        comune: r.voce?.comune ?? sq.comune ?? null,
        parmense: false,
        campionati: [],
        comuniCasa: new Map(),
        logoFonte: r.voce?.logo ?? null,
      };
      squadre.set(id, s);
    }
    if (s.logoFonte === null && sq.logoUrl) s.logoFonte = sq.logoUrl;
    if (!s.societa && sq.societa) s.societa = sq.societa;
    if (!s.comune && (r.voce?.comune ?? sq.comune)) s.comune = r.voce?.comune ?? sq.comune ?? null;
    if (!s.campionati.includes(campionatoId)) s.campionati.push(campionatoId);
    return id;
  };

  const partite: Partita[] = [];
  const classifiche: Classifica[] = [];
  const campionatiUsati = new Map<string, CampionatoGrezzo>();
  const gironiUsati = new Set<string>();
  /** campionatoId → squadra parmense → motivo */
  const reportPerCampionato = new Map<string, Map<string, string>>();

  for (const snap of snapshots) {
    const campionatiSnap = new Map(snap.campionati.map((c) => [c.id, c]));
    for (const p of snap.partite) {
      const motivoCasa = parma.motivo(p.casa, p.provinciaPalestra);
      const motivoOspite = parma.motivo(p.ospite);
      if (snap.filtroParma && !motivoCasa && !motivoOspite) continue;
      const camp = campionatiSnap.get(p.campionatoId);
      if (!camp) continue;
      campionatiUsati.set(camp.id, camp);
      gironiUsati.add(`${p.campionatoId}|${p.girone ?? ''}`);

      const casa = registra(p.casa, p.campionatoId);
      const ospite = registra(p.ospite, p.campionatoId);
      for (const [id, motivo] of [[casa, motivoCasa], [ospite, motivoOspite]] as const) {
        if (!motivo) continue;
        squadre.get(id)!.parmense = true;
        if (snap.filtroParma) {
          const r = reportPerCampionato.get(p.campionatoId) ?? new Map<string, string>();
          if (!r.has(id)) r.set(id, motivo);
          reportPerCampionato.set(p.campionatoId, r);
        }
      }
      if (!snap.filtroParma) squadre.get(casa)!.parmense = squadre.get(ospite)!.parmense = true;
      if (p.comune) {
        const c = squadre.get(casa)!.comuniCasa;
        c.set(p.comune, (c.get(p.comune) ?? 0) + 1);
      }

      const { provinciaPalestra: _, casa: _c, ospite: _o, ...resto } = p;
      partite.push({ ...resto, casa, ospite });
    }

    for (const cl of snap.classifiche) {
      if (!gironiUsati.has(`${cl.campionatoId}|${cl.girone ?? ''}`)) continue;
      classifiche.push({
        campionatoId: cl.campionatoId,
        girone: cl.girone,
        titolo: cl.titolo,
        fonteUrl: cl.fonteUrl,
        righe: cl.righe.map(({ squadra, ...r }) => {
          const id = registra(squadra, cl.campionatoId);
          return { ...r, squadraId: id, nome: squadre.get(id)!.nome };
        }),
      });
    }
  }

  // Comune della squadra: quello dichiarato, altrimenti il più frequente tra le gare in casa.
  const candidatiLogo = new Map<string, string | false>();
  for (const s of squadre.values()) if (s.logoFonte !== null) candidatiLogo.set(s.id, s.logoFonte);
  const elencoSquadre: Squadra[] = [...squadre.values()]
    .map(({ comuniCasa, logoFonte, ...s }) => {
      if (!s.comune && comuniCasa.size) s.comune = [...comuniCasa.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return s;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  applicaSpostamenti(partite, precedenti);
  partite.sort(
    (a, b) =>
      (a.data ?? '9999').localeCompare(b.data ?? '9999') ||
      (a.ora ?? '99').localeCompare(b.ora ?? '99') ||
      a.id.localeCompare(b.id),
  );

  const campionatiGrezzi = [...campionatiUsati.values(), ...extraCampionati.filter((c) => !campionatiUsati.has(c.id))];
  const campionati = assegnaColori(campionatiGrezzi, config.colori);

  return {
    campionati,
    squadre: elencoSquadre,
    partite,
    classifiche,
    report: scriviReport(campionati, reportPerCampionato, squadre, snapshots),
    candidatiLogo,
  };
}

function scriviReport(
  campionati: Campionato[],
  perCampionato: Map<string, Map<string, string>>,
  squadre: Map<string, Squadra>,
  snapshots: Snapshot[],
): string {
  const righe = [
    '# Report squadre di Parma',
    '',
    'Squadre riconosciute come parmensi nei campionati regionali e nazionali, con il motivo.',
    'Per correggere: `data/whitelist-manuale.json` (aggiungere o escludere) e `data/alias.json` (nomi).',
    '',
  ];
  const filtrati = new Set(snapshots.filter((s) => s.filtroParma).flatMap((s) => s.campionati.map((c) => c.id)));
  for (const livello of ['regionale', 'nazionale'] as const) {
    righe.push(`## ${livello === 'regionale' ? 'Regionale' : 'Nazionale'}`, '');
    const lista = campionati.filter((c) => c.livello === livello && filtrati.has(c.id));
    if (!lista.length) righe.push('_Nessun campionato con squadre di Parma._', '');
    for (const c of lista) {
      righe.push(`### ${c.nome}${c.gironi.length ? ` (gironi ${c.gironi.join(', ')})` : ''}`, '');
      for (const [id, motivo] of perCampionato.get(c.id) ?? []) {
        righe.push(`- **${squadre.get(id)?.nome ?? id}** — ${motivo}`);
      }
      righe.push('');
    }
  }
  return righe.join('\n');
}

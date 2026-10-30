// Modello dati comune: lo scrive lo scraper in /data e lo legge la PWA.

export type Livello = 'provinciale' | 'regionale' | 'nazionale';
export type Federazione = 'FIPAV' | 'CSEN';
export type Genere = 'maschile' | 'femminile' | 'misto';
export type StatoPartita = 'da_giocare' | 'giocata' | 'rinviata';

export interface Campionato {
  id: string;
  nome: string;
  /** Etichetta corta per badge e filtri (es. "C M", "B2 F"). */
  nomeBreve: string;
  livello: Livello;
  federazione: Federazione;
  genere: Genere;
  categoria: string;
  /** Colore per il tema chiaro (testo bianco sopra). */
  colore: string;
  /** Colore per il tema scuro (testo scuro sopra). */
  coloreScuro: string;
  stagione: string;
  fonte: string;
  fonteUrl: string;
  gironi: string[];
  /** Campionato senza dati propri: si consulta solo alla fonte esterna. */
  soloLinkEsterno?: boolean;
  nota?: string;
  /** Zone della classifica (da data/zone-classifiche.json): posizioni da evidenziare. */
  zone?: ZoneClassifica;
}

export interface ZoneClassifica {
  /** Prime N posizioni: promozione diretta. */
  promozione?: number;
  /** Posizioni da…a (comprese): playoff. */
  playoff?: [number, number];
  /** Posizioni da…a (comprese): playout. */
  playout?: [number, number];
  /** Ultime N posizioni: retrocessione diretta. */
  retrocessione?: number;
}

export interface Squadra {
  id: string;
  nome: string;
  societa: string | null;
  comune: string | null;
  parmense: boolean;
  campionati: string[];
  /** Logo ridimensionato, percorso relativo a /data (es. "loghi/3f2a9c1b04de.webp"). */
  logo?: string;
}

export interface Partita {
  id: string;
  campionatoId: string;
  girone: string | null;
  giornata: number | null;
  numeroGara: string | null;
  /** Data locale (Europe/Rome) in formato YYYY-MM-DD; null se da definire. */
  data: string | null;
  /** Ora locale HH:MM. */
  ora: string | null;
  palestra: string | null;
  indirizzo: string | null;
  comune: string | null;
  lat?: number;
  lon?: number;
  /** Id squadra di casa (vedi squadre.json). */
  casa: string;
  ospite: string;
  /** Punteggi dei set nell'ordine [casa, ospite]. */
  set: [number, number][];
  /** Set vinti. */
  punteggio: { casa: number; ospite: number } | null;
  stato: StatoPartita;
  /** Presente se la gara è stata spostata: data e ora originali. */
  spostata?: { data: string | null; ora: string | null };
  risultatoUfficiale?: boolean;
  fonteUrl: string;
}

export interface RigaClassifica {
  posizione: number;
  squadraId: string;
  nome: string;
  punti: number;
  giocate: number;
  vinte: number;
  perse: number;
  setVinti: number;
  setPersi: number;
  puntiFatti: number | null;
  puntiSubiti: number | null;
  /** Posizione prima dell'ultima giornata giocata (per le frecce ▲▼), se nota. */
  posizionePrecedente?: number;
}

export interface Classifica {
  campionatoId: string;
  girone: string | null;
  titolo: string;
  righe: RigaClassifica[];
  fonteUrl: string;
}

export interface Atleta {
  numero: string | null;
  nome: string;
  cognome: string;
  ruolo: string | null;
  /**
   * URL della foto sul sito della fonte (non copiata: se la fonte la toglie, sparisce anche qui).
   * Sempre null per i minorenni e per chi è escluso in data/privacy.json.
   */
  foto: string | null;
}

/** Rosa di una squadra, solo per le squadre di Parma e solo dove la fonte la pubblica. */
export interface Rosa {
  squadraId: string;
  fonte: string;
  fonteUrl: string;
  aggiornata: string;
  atleti: Atleta[];
  /** Quante foto non sono mostrate per tutela dei minori o su richiesta. */
  fotoNascoste: number;
}

export interface StatoFonte {
  id: string;
  nome: string;
  ok: boolean;
  abilitata: boolean;
  ultimoSuccesso: string | null;
  ultimoTentativo: string | null;
  errore?: string;
  /** Per le fonti aggiornate fuori dal controllo automatico. */
  nota?: string;
  partite: number;
}

export interface Meta {
  generatoIl: string;
  stagione: string;
  fonti: StatoFonte[];
  /** Contatto per chiedere la rimozione dei propri dati dalle rose (da data/privacy.json). */
  contattoPrivacy?: string;
}

/** Articolo della rassegna stampa: solo titolo, link e un breve estratto. Il testo resta sul sito della testata. */
export interface Articolo {
  id: string;
  titolo: string;
  url: string;
  /** Id della testata (vedi Rassegna.testate). */
  testata: string;
  /** Data di pubblicazione locale (Europe/Rome), YYYY-MM-DD. */
  data: string;
  /** Ora locale HH:MM, se nota. */
  ora: string | null;
  estratto: string | null;
  /** Servizio video (es. TG di 12 TV Parma). */
  video?: boolean;
  /** Squadre di Parma citate (id di squadre.json). */
  squadre: string[];
}

export interface Testata {
  id: string;
  nome: string;
  url: string;
}

export interface Rassegna {
  aggiornataIl: string;
  stagione: string;
  testate: Testata[];
  /** Dal più recente. */
  articoli: Articolo[];
}

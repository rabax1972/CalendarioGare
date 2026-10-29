import { useSyncExternalStore } from 'react';

// Preferenze del singolo dispositivo in localStorage. Ogni accesso è protetto: in navigazione privata
// o con i dati del sito bloccati l'app deve funzionare lo stesso (senza ricordare le scelte).

function leggi<T>(chiave: string, iniziale: T): T {
  try {
    const v = localStorage.getItem(chiave);
    return v == null ? iniziale : (JSON.parse(v) as T);
  } catch {
    return iniziale;
  }
}

function scrivi(chiave: string, valore: unknown) {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    /* spazio esaurito o storage bloccato: pazienza */
  }
}

/** Valore condiviso tra componenti e sincronizzato con localStorage (anche tra schede). */
export function creaStato<T>(chiave: string, iniziale: T) {
  let valore = leggi(chiave, iniziale);
  const ascoltatori = new Set<() => void>();
  const notifica = () => ascoltatori.forEach((f) => f());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== chiave) return;
      valore = leggi(chiave, iniziale);
      notifica();
    });
  }

  const imposta = (nuovo: T | ((prima: T) => T)) => {
    valore = typeof nuovo === 'function' ? (nuovo as (p: T) => T)(valore) : nuovo;
    scrivi(chiave, valore);
    notifica();
  };
  const iscrivi = (f: () => void) => {
    ascoltatori.add(f);
    return () => ascoltatori.delete(f);
  };

  function usa(): [T, typeof imposta] {
    return [useSyncExternalStore(iscrivi, () => valore), imposta];
  }
  return { usa, imposta, get: () => valore };
}

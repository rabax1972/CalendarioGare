import { useSyncExternalStore } from 'react';

// Router su hash (#/percorso): funziona su qualsiasi hosting statico, anche in una sottocartella.

function percorso(): string[] {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ''))
    .split('?')[0]
    .split('/')
    .filter(Boolean);
}

let corrente = percorso();
const ascoltatori = new Set<() => void>();

window.addEventListener('hashchange', () => {
  corrente = percorso();
  ascoltatori.forEach((f) => f());
});

export function useRotta(): string[] {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      return () => ascoltatori.delete(f);
    },
    () => corrente,
  );
}

export function link(...parti: string[]): string {
  return '#/' + parti.map(encodeURIComponent).join('/');
}

export function vai(...parti: string[]) {
  location.hash = link(...parti);
}

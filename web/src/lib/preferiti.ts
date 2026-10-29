import { useCallback } from 'react';
import { creaStato } from './storage.ts';

const statoPreferiti = creaStato<string[]>('volley-parma:preferiti', []);

export function usePreferiti() {
  const [preferiti, imposta] = statoPreferiti.usa();
  const segui = useCallback(
    (id: string) => imposta((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [imposta],
  );
  const seguita = useCallback((id: string) => preferiti.includes(id), [preferiti]);
  return { preferiti, segui, seguita };
}

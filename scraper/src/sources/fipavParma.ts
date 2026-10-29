import type { CampionatoGrezzo, Fonte } from '../types.ts';

export const URL_FIPAV_PARMA = 'https://fipavonline.it/main/tutti_i_campionati/08038';

/**
 * Campionati provinciali FIPAV Parma.
 *
 * fipavonline.it vieta esplicitamente lo scraping (vedi docs/FONTI.md §1), quindi la fonte è disattivata
 * e nell'app compare solo una scheda che rimanda al sito. Se arriva un'autorizzazione scritta, va
 * implementato qui `esegui` (stesso schema di csen.ts) e messo `abilitata: true`.
 */
export const fonteFipavParma: Fonte = {
  id: 'fipav-parma',
  nome: 'FIPAV Parma – campionati provinciali',
  abilitata: false,
  minimoPartite: 10,
  async esegui() {
    throw new Error('Fonte non autorizzata: fipavonline.it non consente lo scraping');
  },
};

/** Schede mostrate quando la fonte è disattivata. */
export function campionatiSoloLink(stagione: string): CampionatoGrezzo[] {
  return [
    {
      id: 'fipav-parma',
      nome: 'Campionati provinciali FIPAV Parma',
      nomeBreve: 'FIPAV PR',
      livello: 'provinciale',
      federazione: 'FIPAV',
      genere: 'misto',
      categoria: 'Divisioni e giovanili',
      stagione,
      fonte: 'fipav-parma',
      fonteUrl: URL_FIPAV_PARMA,
      gironi: [],
      soloLinkEsterno: true,
      nota:
        'Calendari, risultati e classifiche dei campionati provinciali FIPAV (Divisioni, Under, Open misto) sono pubblicati solo su fipavonline.it, che non ne consente il riuso automatico.',
    },
  ];
}

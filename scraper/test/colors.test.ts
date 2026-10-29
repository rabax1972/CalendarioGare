import { describe, expect, it } from 'vitest';
import { PALETTE, assegnaColori } from '../src/colors.ts';

function luminanza(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrasto(a: string, b: string): number {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const camp = (id: string) => ({
  id,
  nome: id,
  nomeBreve: id,
  livello: 'regionale' as const,
  federazione: 'FIPAV' as const,
  genere: 'misto' as const,
  categoria: id,
  stagione: '',
  fonte: '',
  fonteUrl: '',
  gironi: [],
});

describe('palette accessibile', () => {
  it.each(PALETTE)('$nome: contrasto AA per il testo in entrambi i temi', (p) => {
    expect(contrasto(p.chiaro, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrasto(p.chiaro, '#f6f7f9')).toBeGreaterThanOrEqual(4.5);
    expect(contrasto(p.scuro, '#111827')).toBeGreaterThanOrEqual(4.5);
    expect(contrasto(p.scuro, '#0f1115')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('assegnazione colori', () => {
  it('è deterministica e indipendente dall’ordine', () => {
    const a = assegnaColori(['x', 'y', 'z'].map(camp));
    const b = assegnaColori(['z', 'x', 'y'].map(camp));
    const colore = (l: typeof a, id: string) => l.find((c) => c.id === id)!.colore;
    for (const id of ['x', 'y', 'z']) expect(colore(a, id)).toBe(colore(b, id));
  });

  it('dà colori diversi finché la palette basta', () => {
    const lista = assegnaColori(Array.from({ length: PALETTE.length - 1 }, (_, i) => camp(`c${i}`)));
    expect(new Set(lista.map((c) => c.colore)).size).toBe(PALETTE.length - 1);
  });

  it('rispetta le scelte manuali', () => {
    const [c] = assegnaColori([camp('x')], { x: 'verde' });
    expect(c.colore).toBe(PALETTE.find((p) => p.nome === 'verde')!.chiaro);
  });
});

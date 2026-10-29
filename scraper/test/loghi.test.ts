import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { normalizzaLogo } from '../src/loghi.ts';
import { abbina } from '../src/normalize.ts';
import { parseLoghiCsen } from '../src/sources/csen.ts';

describe('abbinamento nomi per i loghi', () => {
  const club = [
    { id: '1', nome: 'Club Italia' },
    { id: '2', nome: 'Caldaie Melgari Vbc Cremonese' },
    { id: '3', nome: 'Trasporti Bressan Offanengo' },
    { id: '4', nome: 'Erreci Busto Arsizio' },
  ];

  it('abbina nomi uguali dopo la normalizzazione (anche con sigla provincia)', () => {
    expect(abbina('CLUB ITALIA MI', club)?.id).toBe('1');
    expect(abbina('CALDAIE MELGARI VBC CREMONESE', club)?.id).toBe('2');
  });

  it('non abbina nomi con sponsor diversi: meglio il monogramma che un logo sbagliato', () => {
    expect(abbina('DRAGONS OFFANENGO', club)).toBeNull();
    expect(abbina('FUTURAGIOVANI BUSTO ARSIZIO', club)).toBeNull();
  });
});

describe('loghi CSEN', () => {
  it('legge nome e URL dalla pagina Squadre', () => {
    const html = '<img src="/Squadre/Logo/2?v=abc" alt="Logo BONGIO AZUL"><img src="/img/altro.png" alt="x">';
    expect([...parseLoghiCsen(html)]).toEqual([['BONGIO AZUL', 'https://www.volleymistocsenparma.it/Squadre/Logo/2?v=abc']]);
  });
});

describe('normalizzazione logo', () => {
  it('produce un WebP quadrato di 96 px con nome dato dal contenuto', async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#1d4ed8' } }).png().toBuffer();
    const a = await normalizzaLogo(png);
    const b = await normalizzaLogo(png);
    expect(a.nome).toMatch(/^[0-9a-f]{12}\.webp$/);
    expect(a.nome).toBe(b.nome);
    const meta = await sharp(a.webp).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 96, 96]);
  });

  it('scarta immagini minuscole (pixel di tracciamento, segnaposto)', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(normalizzaLogo(png)).rejects.toThrow();
  });
});

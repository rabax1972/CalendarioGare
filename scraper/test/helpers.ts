import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function fixture(nome: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${nome}`, import.meta.url)), 'utf8');
}

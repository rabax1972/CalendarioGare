import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { calendarioSquadra } from './shared/ics.ts';
import type { Campionato, Meta, Partita, Squadra } from './shared/model.ts';

const DATA_DIR = path.resolve(import.meta.dirname, 'data');
/** File di /data pubblicati con l'app (gli snapshot delle fonti e i file di configurazione restano fuori). */
const FILE_DATI = ['campionati.json', 'squadre.json', 'partite.json', 'classifiche.json', 'meta.json', 'rose.json', 'rassegna.json'];

/** Calendario .ics di ogni squadra di Parma (shared/ics.ts), generato dai JSON di /data: id squadra → contenuto. */
function calendari(): Map<string, string> {
  const leggi = <T,>(f: string) => JSON.parse(readFileSync(path.join(DATA_DIR, f), 'utf8')) as T;
  const squadre = leggi<Squadra[]>('squadre.json');
  const partite = leggi<Partita[]>('partite.json');
  const campionati = new Map(leggi<Campionato[]>('campionati.json').map((c) => [c.id, c]));
  const { generatoIl } = leggi<Meta>('meta.json');
  const nomi = new Map(squadre.map((s) => [s.id, s.nome]));
  const nomeSquadra = (id: string) => nomi.get(id) ?? id;
  return new Map(
    squadre
      .filter((s) => s.parmense)
      .map((s) => [s.id, calendarioSquadra({ squadra: s, partite, campionati, nomeSquadra, generatoIl })]),
  );
}

/** Serve /data in sviluppo e lo copia nella build: l'app legge solo questi JSON statici. */
function datiStatici(): Plugin {
  return {
    name: 'dati-statici',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ics = /\/data\/calendari\/([\w-]+)\.ics(\?.*)?$/.exec(req.url ?? '');
        if (ics) {
          const cal = calendari().get(ics[1]);
          res.statusCode = cal ? 200 : 404;
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
          return res.end(cal ?? '');
        }
        const json = /\/data\/([\w-]+\.json)(\?.*)?$/.exec(req.url ?? '');
        const logo = /\/data\/loghi\/([\w-]+\.webp)(\?.*)?$/.exec(req.url ?? '');
        const file = json && FILE_DATI.includes(json[1]) ? json[1] : logo ? `loghi/${logo[1]}` : null;
        if (!file) return next();
        try {
          res.setHeader('Content-Type', logo ? 'image/webp' : 'application/json; charset=utf-8');
          res.end(readFileSync(path.join(DATA_DIR, file)));
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
    generateBundle() {
      for (const f of FILE_DATI) {
        this.emitFile({ type: 'asset', fileName: `data/${f}`, source: readFileSync(path.join(DATA_DIR, f)) });
      }
      for (const [id, cal] of calendari()) this.emitFile({ type: 'asset', fileName: `data/calendari/${id}.ics`, source: cal });
      const dirLoghi = path.join(DATA_DIR, 'loghi');
      if (!existsSync(dirLoghi)) return;
      for (const f of readdirSync(dirLoghi).filter((x) => x.endsWith('.webp'))) {
        this.emitFile({ type: 'asset', fileName: `data/loghi/${f}`, source: readFileSync(path.join(dirLoghi, f)) });
      }
    },
  };
}

export default defineConfig({
  root: 'web',
  // Percorsi relativi: la build funziona in qualsiasi cartella (es. /calendariogare/), perché il router usa l'hash.
  // Su GitHub Pages la Action imposta comunque BASE_PATH.
  base: process.env.BASE_PATH ?? './',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [
    react(),
    datiStatici(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: './',
        name: 'Volley Parma – calendari e risultati',
        short_name: 'Volley Parma',
        description: 'Calendari, risultati e classifiche della pallavolo di Parma e provincia.',
        lang: 'it',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1d4ed8',
        background_color: '#f6f7f9',
        categories: ['sports'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        globIgnores: ['splash/**', 'data/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Loghi: il nome del file è l'hash del contenuto, quindi una copia in cache non è mai superata.
            urlPattern: ({ url }) => /\/data\/loghi\/[\w-]+\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'loghi',
              expiration: { maxEntries: 400, maxAgeSeconds: 120 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Dati: subito dalla cache (funziona offline), intanto si aggiorna in background.
            urlPattern: ({ url }) => /\/data\/[\w-]+\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dati-json',
              expiration: { maxEntries: 20 },
              // Avvisa l'app quando la copia in cache cambia, così ricarica i dati senza attendere la prossima apertura.
              broadcastUpdate: {
                channelName: 'aggiornamento-dati',
                options: { headersToCheck: ['etag', 'last-modified', 'content-length'] },
              },
            },
          },
        ],
      },
    }),
  ],
});

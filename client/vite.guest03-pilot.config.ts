import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config';

// Opt-in local server only. No files are copied into public or emitted at build time.
export default defineConfig(({ command }) => mergeConfig(base, {
  define: { 'import.meta.env.VITE_GUEST03_PILOT': JSON.stringify(command === 'serve' ? 'true' : 'false') },
  plugins: [{
    name: 'guest03-local-pilot', apply: 'serve' as const,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/__guest03-pilot/walk.png') return next();
        try {
          const bytes = await readFile(new URL('../character-assets/rigs/guest-03/three-head-216-v1/review/walk-sheet.png', import.meta.url));
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Guest03-SHA256', createHash('sha256').update(bytes).digest('hex'));
          res.end(bytes);
        } catch {
          res.statusCode = 503;
          res.end('Generate three-head-216-v1 before starting the pilot.');
        }
      });
    }
  }]
}));

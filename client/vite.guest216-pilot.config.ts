import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config';

// Opt-in development only: no public asset writes or build-time file emission.
export default defineConfig(({ command, mode }) => mergeConfig(base, {
  define: {
    'import.meta.env.VITE_GUEST216_PILOT': JSON.stringify(command === 'serve' ? 'true' : 'false'),
    'import.meta.env.VITE_GUEST216_RUNTIME_PILOT': JSON.stringify(command === 'serve' && mode === 'guest216-runtime' ? 'true' : 'false')
  },
  plugins: [{
    name: 'guest216-local-pilot', apply: 'serve' as const,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.split('?')[0].match(/^\/__guest216-pilot\/(guest-(?:0[1-9]|1[0-2]))(-runtime)?\.png$/);
        if (!match) return next();
        try {
          let asset = new URL(`../character-assets/rigs/${match[1]}/three-head-216-v1/review/walk-sheet.png`, import.meta.url);
          let expectedHash: string | undefined;
          if (match[2]) {
            const manifest = JSON.parse(await readFile(new URL('../character-assets/generated/three-head-216-v1/build-manifest.json', import.meta.url), 'utf8'));
            const entry = manifest.characters.find((c: { characterId: string }) => c.characterId === match[1]);
            if (!entry) throw new Error('Missing staging character');
            const output = entry.outputs.find((o: { file: string }) => o.file.endsWith('__walk-runtime.png'));
            if (!output) throw new Error('Missing staging walk');
            asset = new URL(`../character-assets/generated/three-head-216-v1/${entry.presetId}/${output.file}`, import.meta.url);
            expectedHash = output.sha256;
          }
          const bytes = await readFile(asset);
          if (expectedHash && createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Stale staging asset');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Guest216-SHA256', createHash('sha256').update(bytes).digest('hex'));
          res.end(bytes);
        } catch {
          res.statusCode = 503;
          res.end('Build 216px candidates before starting the pilot.');
        }
      });
    }
  }]
}));

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from '../client/node_modules/vite/dist/node/index.js';
import {assertStorybookClientQaFresh} from './lib/storybookClientQaFreshness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'character-assets/generated/storybook-client-qa-v1');
const server = await createServer({
  root: path.join(root, 'client'),
  configFile: path.join(root, 'client/vite.config.ts'),
  server: {host: '127.0.0.1', port: 4197, strictPort: true},
  plugins: [{
    name: 'storybook-local-qa-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
        if (!pathname.startsWith('/characters/generated/guests/')) return next();
        const relative = pathname.slice('/characters/generated/'.length);
        if (!/^guests\/(?:preview\/|portraits\/|world\/)?[a-z0-9_-]+\.png$/.test(relative)) {
          res.statusCode = 400; res.end('Invalid QA asset path'); return;
        }
        try {
          const bytes = await readFile(path.join(assets, relative));
          if(/^guests\/(?:preview\/)?[a-z0-9_-]+__(?:walk|idle)\.png$/.test(relative))await assertStorybookClientQaFresh(root,relative,bytes);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Character-QA', 'storybook-staging-not-production');
          res.setHeader('X-Asset-SHA256', createHash('sha256').update(bytes).digest('hex'));
          res.end(bytes);
        } catch (error) {
          res.statusCode = error.code==='ENOENT'?404:409; res.end('Missing or stale storybook QA asset; rebuild staging before visual review');
          console.error('QA asset unavailable:', relative, error.code);
        }
      });
    }
  }]
});
await server.listen();
console.log('Storybook actual-client QA: http://127.0.0.1:4197 (production files unchanged)');

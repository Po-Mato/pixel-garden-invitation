import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from '../client/node_modules/vite/dist/node/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const variant=process.argv[2]||'balanced-arms-four-direction-v2';
if(!['balanced-arms-four-direction-v2','balanced-shading-v3'].includes(variant))throw Error('Unknown candidate');
const port=variant==='balanced-shading-v3'?4202:4201;
const review=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/review',variant);
const staging=path.join(root,'character-assets/generated/storybook-client-qa-v1');
const server=await createServer({root:path.join(root,'client'),configFile:path.join(root,'client/vite.config.ts'),server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'isolated-guest01-arm-review',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(!pathname.startsWith('/characters/generated/guests/'))return next();
  const relative=pathname.slice('/characters/generated/'.length);
  if(!/^guests\/(?:preview\/|portraits\/|world\/)?[a-z0-9_-]+\.png$/.test(relative)){res.statusCode=400;res.end();return;}
  const match=relative.match(/^guests\/(preview\/)?feminine-long-wave-dress__(walk|idle)\.png$/);
  try{
    const bytes=await readFile(match?path.join(review,`${match[2]}${match[1]?'':'-runtime'}.png`):path.join(staging,relative));
    res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.setHeader('X-Character-QA',match?'guest01-balanced-candidate':'existing-staging');res.setHeader('X-Asset-SHA256',createHash('sha256').update(bytes).digest('hex'));res.end(bytes);
  }catch{res.statusCode=404;res.end('Missing isolated QA asset');}
});}}]});
await server.listen();console.log(`Isolated ${variant}: http://127.0.0.1:${port} — no public writes`);

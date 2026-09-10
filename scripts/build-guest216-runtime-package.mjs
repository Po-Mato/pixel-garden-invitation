import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateCharacterAssets} from './generate-character-assets.mjs';
const root=new URL('../',import.meta.url),output=new URL('character-assets/generated/three-head-216-runtime-package/',root);
// Exercise the real runtime packager against a dedicated candidate directory.
// Its replacement operation is restricted to this generated package, never public assets.
const count=await generateCharacterAssets({cutoutRoot:fileURLToPath(new URL('character-assets/generated/three-head-216-v1/',root)),outputRoot:fileURLToPath(output)});
const files=[];
async function scan(directory,prefix=''){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const relative=prefix+entry.name,url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())await scan(url,relative+'/');
  else files.push({file:relative,sha256:createHash('sha256').update(await readFile(url)).digest('hex')});
 }
}
await scan(output);
await writeFile(new URL('build-manifest.json',output),JSON.stringify({pipeline:'three-head-216-runtime-package',publicAssetsModified:false,productionIntegrated:false,count,files},null,2)+'\n');
console.log(`${count} assets packaged through the production generator into the separate candidate directory.`);

const load=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
const cache=new Map();
const asset=url=>{if(!cache.has(url))cache.set(url,load(url));return cache.get(url);};
const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const zoneControl=document.querySelector('#zone'),directionControl=document.querySelector('#direction'),frameControl=document.querySelector('#frame'),status=document.querySelector('#status'),grid=document.querySelector('#grid');
for(const z of DATA.zones)zoneControl.add(new Option(z.id,z.id));
const lum=rgb=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
function contrast(scene,alpha){
 const ratios=[],profiles=Object.fromEntries(Object.keys(DISPLAY_PROFILES).map(k=>[k,[]]));
 for(let y=0;y<72;y++)for(let x=0;x<48;x++){
  const o=(y*48+x)*4;if(alpha[o+3]<96)continue;
  const outside=[[-1,0],[1,0],[0,-1],[0,1]].filter(([dx,dy])=>x+dx>=0&&x+dx<48&&y+dy>=0&&y+dy<72&&alpha[((y+dy)*48+x+dx)*4+3]<32);
  if(!outside.length)continue;
  const a=lum([...scene.slice(o,o+3)]);
  for(const [id,adjust]of Object.entries(DISPLAY_PROFILES))profiles[id].push(Math.max(...outside.map(([dx,dy])=>{const n=((y+dy)*48+x+dx)*4,b=lum([...scene.slice(n,n+3)]),aa=adjust(a),bb=adjust(b);return(Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05);}))); 
  ratios.push({x,y,value:Math.max(...outside.map(([dx,dy])=>{const n=((y+dy)*48+x+dx)*4,b=lum([...scene.slice(n,n+3)]);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}))});
 }
 ratios.sort((a,b)=>a.value-b.value);return {value:ratios[Math.floor(ratios.length*.2)].value,samples:ratios,profiles:Object.fromEntries(Object.entries(profiles).map(([k,v])=>{v.sort((a,b)=>a-b);return[k,v[Math.floor(v.length*.2)]];}))};
}
async function render(z,c,row,frame){
 const canvas=make(84,104),ctx=canvas.getContext('2d',{willReadFrequently:true}),dx=42-z.position.x,dy=52-z.position.y;
 ctx.drawImage(await asset(z.background),dx,dy);
 for(const p of z.foreground)ctx.drawImage(await asset(p.url),p.x+dx,p.y+dy);
 const sprite=make(48,72),s=sprite.getContext('2d',{willReadFrequently:true});s.imageSmoothingEnabled=true;s.drawImage(await asset(c.url),frame*96,row*144,96,144,0,0,48,72);
 ctx.filter=z.filter;ctx.drawImage(sprite,18,16);ctx.filter='none';
 const edge=contrast(ctx.getImageData(18,16,48,72).data,s.getImageData(0,0,48,72).data);
 return {canvas,edgeContrast:edge.value,edgeSamples:edge.samples,displayEdgeContrasts:edge.profiles};
}
let refreshSequence=0;
async function refresh(){
 const sequence=++refreshSequence,figures=[],row=+directionControl.value,frame=+frameControl.value;
 document.body.dataset.ready='false';
 const z=DATA.zones.find(z=>z.id===zoneControl.value);
 for(const c of DATA.characters){const {canvas,edgeContrast}=await render(z,c,row,frame),f=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=c.id+' · '+edgeContrast.toFixed(3);f.append(canvas,caption);figures.push(f);}
 if(sequence!==refreshSequence)return;
 grid.replaceChildren(...figures);
 status.textContent=z.id+' · 48×72 실제 표시 크기';document.body.dataset.ready='true';
}
for(const control of [zoneControl,directionControl,frameControl])control.onchange=refresh;
document.querySelector('#audit').onclick=async()=>{
 const rows=[];document.body.dataset.audit='running';
 for(const z of DATA.zones){status.textContent='검사 중: '+z.id;for(const c of DATA.characters)for(let d=0;d<4;d++)for(let f=0;f<4;f++){const {edgeContrast,displayEdgeContrasts}=await render(z,c,d,f);rows.push({zone:z.id,id:c.id,direction:d,frame:f,edgeContrast,displayEdgeContrasts});}}
 window.mapBrowserEvidence={fixtureOnly:true,actualGame:false,thresholds:DATA.thresholds,inputs:DATA.inputs,cssSha256:DATA.cssSha256,sourceHashes:DATA.characters.map(({id,sha256})=>({id,sha256})),rows,belowStandardThreshold:rows.filter(r=>Number(r.edgeContrast.toFixed(3))<DATA.thresholds.minCharacterEdgeContrast),belowDisplayThreshold:rows.filter(r=>Object.values(r.displayEdgeContrasts).some(v=>Number(v.toFixed(3))<DATA.thresholds.minDisplayCharacterEdgeContrast))};
 status.textContent='1920개 합성 검사 · 기본 미달 '+window.mapBrowserEvidence.belowStandardThreshold.length+' · 표시 조건 미달 '+window.mapBrowserEvidence.belowDisplayThreshold.length;document.body.dataset.audit='done';
};
refresh().catch(e=>{status.textContent=String(e);document.body.dataset.error='true';});

// Coverage only. This never grants visual approval or verifies source freshness.
export function isCompleteMotionCapture(ids,rows){
  if(ids.length!==12||new Set(ids).size!==12||rows.length!==48)return false;
  return ids.every(id=>['down','left','right','up'].every(direction=>{
    const matches=rows.filter(row=>row.id===id&&row.direction===direction);
    if(matches.length!==1||!Array.isArray(matches[0].captures))return false;
    const frames=matches[0].captures.map(c=>c.frame).sort();
    return frames.length===4&&frames.every((frame,index)=>frame===index);
  }));
}

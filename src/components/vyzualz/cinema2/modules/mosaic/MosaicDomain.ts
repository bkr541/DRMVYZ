import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

export const MOSAIC_PATTERNS = [
  {value:'mosaic',label:'Mosaic'}, {value:'extrusion',label:'Extrusion'},
  {value:'fragmentation',label:'Fragmentation'}, {value:'wave',label:'Wave'},
  {value:'reconstruction',label:'Reconstruction'}, {value:'pixel-relay',label:'Pixel Relay'},
] as const
export type MosaicPattern = typeof MOSAIC_PATTERNS[number]['value']
export const MOSAIC_COLORS = {
  background:[8/255,12/255,18/255,1], structural:[37/255,49/255,59/255,1],
  primary:[0,216/255,229/255,1], secondary:[132/255,96/255,1,1], accent:[231/255,246/255,1,1],
} as const satisfies Record<string,Cinema2Color>
export const MOSAIC_WIDTH=8.7, MOSAIC_HEIGHT=4.45
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export function mosaicUv(column:number,row:number,columns:number,rows:number,grouping:string,grouped:boolean,channels:number,step:number){
  let x=column/columns,y=row/rows,w=1/columns,h=1/rows,group=0,gx=columns,gy=rows
  if(grouped){
    const splitX=Math.ceil(columns/2),splitY=Math.ceil(rows/2)
    const blockX=column>=splitX?1:0,blockY=row>=splitY?1:0
    if(grouping==='rows'){group=row;y=0;h=1;gy=1}
    else if(grouping==='columns'){group=column;x=0;w=1;gx=1}
    else {group=blockY*2+blockX;gx=blockX?columns-splitX:splitX;gy=blockY?rows-splitY:splitY;x=(column-blockX*splitX)/gx;y=(row-blockY*splitY)/gy;w=1/gx;h=1/gy}
  }
  return {x,y,w,h,channel:(group+step)%Math.max(1,channels),aspect:(MOSAIC_WIDTH/columns*gx)/(MOSAIC_HEIGHT/rows*gy)}
}
export interface MosaicMotion {pattern:MosaicPattern;phase:number;extrusion:number;rotation:number;scatter:number;intensity:number;safe:boolean;readability:boolean;vocal:number;kick:number;snare:number;drop:number;bass:number;mid:number;build:number;downbeat:number;phrase:number;impact:number;high:number;energy:number;beat:number;frameEmission:number}
export function mosaicPose(column:number,row:number,columns:number,rows:number,p:MosaicMotion){
  const x=(column+.5)/columns*2-1,y=(row+.5)/rows*2-1, t=p.phase, index=row*columns+column
  const wave=Math.sin(t-x*3-y*.7), pulse=(1+Math.cos(t*2+index*.63))/2
  let z=0,dx=0,dy=0,rx=0,ry=0,light=.2
  switch(p.pattern){
    case 'mosaic':z=.09*wave;light=.25+.2*pulse;break
    case 'extrusion':z=.48*Math.sin(t+row*Math.PI);light=.4+.35*pulse;break
    case 'fragmentation':{const split=Math.sin(t)**2;z=wave*.72*split;dx=x*.55*split;dy=y*.38*split;rx=wave*split;ry=Math.cos(index*1.7+t)*split;light=.55;break}
    case 'wave':z=.72*wave;ry=.45*Math.cos(t-x*3);light=.25+.65*(wave+1)/2;break
    case 'reconstruction':{const f=clamp(1-(t%(Math.PI*2))/(Math.PI*2)*1.4-index/(columns*rows)*.3);z=.65*f*wave;dx=x*.35*f;dy=y*.28*f;rx=f*wave;light=.8*(1-f);break}
    case 'pixel-relay':z=.05*wave;light=Math.exp(-((index/(columns*rows)-(t/(Math.PI*2)%1))**2)/.009);break
  }
  const restraint=(p.readability ? .72 : 1)*(1-.3*p.vocal)*(p.safe ? .8 : 1)
  const amplitude=p.intensity*restraint
  z=clamp(z*(p.extrusion+.2*p.bass)+.22*p.kick*(row%2===0?1:.25)+.15*p.build+.22*p.drop*wave,-.7,.7)
  const rotation=Math.min(35,p.rotation+6*p.mid)*Math.PI/180
  return {x:dx*p.scatter*amplitude,y:dy*p.scatter*amplitude,z:z*amplitude,
    rx:clamp(rx+.2*p.snare*(index%2?1:-1),-1,1)*rotation*amplitude,ry:ry*rotation*amplitude,
    light:clamp((light*p.frameEmission+.15*p.high+.07*p.energy+.07*p.beat+.2*p.downbeat*pulse+.12*p.phrase+.18*p.impact*p.drop)*p.intensity)}
}

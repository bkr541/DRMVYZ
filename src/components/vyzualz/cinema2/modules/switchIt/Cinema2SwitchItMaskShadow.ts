import type * as Three from 'three'

/** Static frontal silhouette of the actual supplied mesh, softened for a restrained contact shadow. */
export function buildSwitchItMaskShadow(THREE: typeof Three, geometries: readonly Three.BufferGeometry[]) {
  const box=new THREE.Box3()
  for(const geometry of geometries){geometry.computeBoundingBox();box.union(geometry.boundingBox!)}
  const padding=.2,minX=box.min.x-padding,minY=box.min.y-padding
  const width=box.max.x-box.min.x+padding*2,height=box.max.y-box.min.y+padding*2,size=512
  const source=document.createElement('canvas');source.width=size;source.height=size
  const ctx=source.getContext('2d')!
  ctx.fillStyle='white'
  for(const geometry of geometries){
    const p=geometry.getAttribute('position'),index=geometry.index,count=index?.count??p.count
    for(let i=0;i<count;i+=3){
      ctx.beginPath()
      for(let j=0;j<3;j++){
        const vertex=index?index.getX(i+j):i+j,x=(p.getX(vertex)-minX)/width*size,y=(1-(p.getY(vertex)-minY)/height)*size
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
      }
      ctx.closePath();ctx.fill()
    }
  }
  const blurred=document.createElement('canvas');blurred.width=size;blurred.height=size
  const blur=blurred.getContext('2d')!;blur.filter='blur(4px)';blur.drawImage(source,0,0)
  const texture=new THREE.CanvasTexture(blurred);texture.colorSpace=THREE.NoColorSpace
  return{texture,bounds:new THREE.Vector4(minX,minY,1/width,1/height)}
}

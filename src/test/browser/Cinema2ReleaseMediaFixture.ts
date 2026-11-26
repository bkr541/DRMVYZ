import type { Cinema2MediaKind } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2LoadedMedia, Cinema2MediaLoader } from '../../components/vyzualz/cinema2/media/Cinema2MediaSlotRuntime'
import { browserCinema2MediaLoader } from '../../components/vyzualz/cinema2/media/Cinema2MediaSlotRuntime'
import { cinema2MediaSourceFromLibraryItem, getCinema2MediaDisabledReason } from '../../components/vyzualz/react/Cinema2LibraryMediaSource'
import type { UploadedMedia } from '../../stores/mediaStore'
import videoUrl from './fixtures/qa05-media.webm?url'

export type MediaVariant = 'chart' | 'alpha' | 'tall' | 'video' | 'svg'
const colors = ['#ff2222', '#18ed70', '#2255ff', '#ffffff']
const rgba = [[255,34,34,255], [24,237,112,255], [34,85,255,255], [255,255,255,255]]
export function releaseMediaFixture(variant: MediaVariant) {
  const kind: Cinema2MediaKind = variant === 'video' ? 'video' : variant === 'svg' ? 'svg' : 'image'
  const width = variant === 'tall' ? 180 : 320, height = variant === 'tall' ? 320 : 180
  const alpha = variant === 'alpha' || variant === 'svg'
  const rects = colors.map((color,i)=>({x:i%2*width/2,y:Math.floor(i/2)*height/2,w:width/2,h:height/2,color,opacity:alpha&&i===3?.5:1}))
  const fixture = document.createElement('canvas'); fixture.width=width; fixture.height=height
  const ctx=fixture.getContext('2d')!
  for(const r of rects){ctx.globalAlpha=r.opacity;ctx.fillStyle=r.color;ctx.fillRect(r.x,r.y,r.w,r.h)}
  ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(8,8,22,22);ctx.fillRect(width-34,height-34,26,26)
  if(alpha)ctx.clearRect(width*.45,height*.4,width*.1,height*.2)
  // Native SVG user source is decoded by the same browser image loader as PNG.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="hole"><rect width="100%" height="100%" fill="white"/><rect x="${width*.45}" y="${height*.4}" width="${width*.1}" height="${height*.2}" fill="black"/></mask></defs><g mask="url(#hole)">${rects.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" opacity="${r.opacity}"/>`).join('')}<rect x="8" y="8" width="22" height="22"/><rect x="${width-34}" y="${height-34}" width="26" height="26"/></g></svg>`
  const mimeType=kind==='svg'?'image/svg+xml':kind==='video'?'video/webm':'image/png'
  const item: UploadedMedia={id:`qa05-${variant}`,name:`QA05 ${variant}`,type:kind==='video'?'video':'image',url:kind==='svg'?'data:image/svg+xml,'+encodeURIComponent(svg):kind==='video'?videoUrl:fixture.toDataURL('image/png'),thumbnailUrl:null,meta:mimeType,favorite:false,mediaRole:kind==='svg'?'svg':kind==='video'?'loop':'logo',tags:[],collectionIds:[],mimeType,metadata:{width,height,hasAlpha:alpha,...(kind==='video'?{duration:2}: {})}}
  const source=cinema2MediaSourceFromLibraryItem(item)
  if(!source || getCinema2MediaDisabledReason(item,[kind]) || source.kind!==kind)throw Error('Fixture rejected by user source selection')
  return {source,width,height,alpha,variant}
}

/** Delegate decoding to production; retain only the test fixture's element for
 * exact seeks. Pinning is test-only and does not change native transport time. */
export class ReleaseMediaProbe {
  private elements=new Map<string,Cinema2LoadedMedia>()
  private pinned=false
  readonly loader: Cinema2MediaLoader={load:async(source,signal)=>{
    const loaded=await browserCinema2MediaLoader.load(source,signal)
    this.elements.set(source.id,loaded)
    return {...loaded,setPlaybackPaused:paused=>loaded.setPlaybackPaused?.(paused||this.pinned),dispose:()=>{if(this.elements.get(source.id)===loaded)this.elements.delete(source.id);loaded.dispose()}}
  }}
  async pin(time: number) {
    this.pinned=true
    const loaded=this.elements.get('qa05-video'), video=loaded?.pixelSource
    if(!(video instanceof HTMLVideoElement))throw Error('Video fixture not decoded')
    loaded?.setPlaybackPaused?.(true)
    if(Math.abs(video.currentTime-time)>.001 || video.seeking){
      await new Promise<void>((resolve,reject)=>{
        const done=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);resolve()}
        const failed=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);reject(Error('Fixture video seek failed'))}
        const timer=setTimeout(failed,5000)
        video.addEventListener('seeked',done);video.addEventListener('error',failed);video.currentTime=time
      })
    }
    if(video.readyState<HTMLMediaElement.HAVE_CURRENT_DATA)throw Error('Seeked frame unavailable')
    return video.currentTime
  }
  unpin(){this.pinned=false}
  inspect(variant: MediaVariant,time=0) {
    const loaded=this.elements.get(`qa05-${variant}`)
    if(!loaded)throw Error('Fixture decoder resource absent')
    const {width,height}=loaded, canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const ctx=canvas.getContext('2d')!;ctx.drawImage(loaded.pixelSource as CanvasImageSource,0,0)
    const order=variant==='video'&&time>=1?[2,0,1,3]:[0,1,2,3]
    const alpha=variant==='alpha'||variant==='svg'
    const samples=order.map((color,i)=>({x:(i%2*.5+.25),y:(Math.floor(i/2)*.5+.25),expected:i===3&&alpha?[255,255,255,128]:rgba[color]!}))
    samples.push({x:18/width,y:18/height,expected:[0,0,0,255]}, {x:(width-20)/width,y:(height-20)/height,expected:[0,0,0,255]})
    if(alpha)samples.push({x:.5,y:.5,expected:[0,0,0,0]})
    return {variant,width,height,time,playback:loaded.getPlaybackSnapshot?.()??null,samples:samples.map(s=>({...s,actual:Array.from(ctx.getImageData(Math.floor(s.x*width),Math.floor(s.y*height),1,1).data)}))}
  }
}

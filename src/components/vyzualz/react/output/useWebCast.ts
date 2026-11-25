import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from '../../../../lib/supabase'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import { setWebCastActive } from './webCastActivity'

export const CAST_ORIGIN = 'https://cast.stagelessstudio.com'
export interface WebCastCapture { stream: MediaStream; stop(): void }
interface Snapshot { id: string; expiresAt: string; receiverId: string | null; approved: boolean; hasOffer: boolean; answer: RTCSessionDescriptionInit | null }
interface Created { id: string; code: string; token: string; expiresAt: string; iceServers: RTCIceServer[] }
export interface WebCastView { session: Created | null; receiverId: string | null; status: string; busy: boolean; error: string | null; aspect: OutputAspectRatio | null }
const idle: WebCastView = { session: null, receiverId: null, status: 'Idle', busy: false, error: null, aspect: null }
class CastApiError extends Error { constructor(message: string, readonly status: number) { super(message) } }
async function command<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('web-cast', { body: { action, ...payload } })
  if (error) {
    const response = (error as {context?: Response}).context
    let message = 'Unable to reach STAGELESS Cast. Check your connection and try again.'
    if (response instanceof Response) { try { message = (await response.json()).error || message } catch { /* no body */ } }
    throw new CastApiError(message, response instanceof Response ? response.status : 0)
  }
  if (!data) throw new CastApiError('Casting service returned no response', 0)
  return data
}
export async function gatherCastIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return
  await new Promise<void>((resolve,reject) => {
    const finish = () => { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', changed) }
    const changed = () => { if(peer.iceGatheringState==='complete'){finish();resolve()} }
    const timer = window.setTimeout(()=>{finish();reject(new Error('ICE gathering timed out; check network or TURN configuration'))},12000)
    peer.addEventListener('icegatheringstatechange',changed); changed()
  })
}
interface Running { cancelled: boolean; session: Created | null; peer: RTCPeerConnection | null; capture: WebCastCapture | null; generation: string | null; timer: number | null; lastSuccess: number; negotiatingAt: number; offerSent: boolean }
export function useWebCast(capture: (aspect: OutputAspectRatio) => WebCastCapture, available: boolean) {
  const [view,setView]=useState<WebCastView>(idle)
  const running=useRef<Running|null>(null)
  const captureRef=useRef(capture);captureRef.current=capture
  const closePeer=(run:Running)=>{run.peer?.close();run.peer=null;run.generation=null;run.offerSent=false}
  const stop=useCallback((error: string|null=null)=>{
    const run=running.current;running.current=null
    if(run){run.cancelled=true;if(run.timer!==null)window.clearTimeout(run.timer);run.peer?.close();run.capture?.stop();if(run.session)void command('stop',{id:run.session.id}).catch(()=>undefined)}
    setWebCastActive(false);setView({...idle,error})
  },[])
  useEffect(()=>()=>{const run=running.current;if(run){running.current=null;run.cancelled=true;if(run.timer!==null)window.clearTimeout(run.timer);run.peer?.close();run.capture?.stop();if(run.session)void command('stop',{id:run.session.id}).catch(()=>undefined);setWebCastActive(false)}},[])
  useEffect(()=>{if(!available&&running.current)stop()},[available,stop])
  useEffect(()=>{if(!supabaseConfigured)return;const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')queueMicrotask(()=>stop())});return()=>subscription.unsubscribe()},[stop])
  const start=useCallback(async(aspect:OutputAspectRatio)=>{
    if(running.current||!available)return
    if(!supabaseConfigured||typeof RTCPeerConnection==='undefined'||!HTMLCanvasElement.prototype.captureStream){setView({...idle,error:'Web casting requires a configured account and a WebRTC-compatible browser.'});return}
    const run:Running={cancelled:false,session:null,peer:null,capture:null,generation:null,timer:null,lastSuccess:Date.now(),negotiatingAt:0,offerSent:false}
    running.current=run;setWebCastActive(true);setView({...idle,busy:true,aspect,status:'Creating session…'})
    try{
      const {data}=await supabase.auth.getSession()
      if(!data.session||data.session.user.is_anonymous)throw new Error('Sign in to STAGELESS to create a cast.')
      const created=await command<Created>('create')
      if(run.cancelled){void command('stop',{id:created.id}).catch(()=>undefined);return}
      run.session=created;run.lastSuccess=Date.now()
      setView({session:created,receiverId:null,busy:false,error:null,aspect,status:'Waiting for receiver'})
      const update=(patch:Partial<WebCastView>)=>{if(!run.cancelled)setView(v=>({...v,...patch}))}
      const tick=async()=>{
        if(run.cancelled)return
        try{
          const s=await command<Snapshot>('hostPoll',{id:created.id})
          if(run.cancelled)return
          run.lastSuccess=Date.now()
          if(!s.receiverId||!s.approved){closePeer(run);run.capture?.stop();run.capture=null;update({receiverId:s.receiverId,status:s.receiverId?'Receiver requests access':'Waiting for receiver',error:null})}
          else {
            if(run.generation!==s.receiverId){closePeer(run);run.generation=s.receiverId;run.negotiatingAt=Date.now();run.offerSent=false}
            update({receiverId:s.receiverId,status:'Connecting…',error:null})
            if(!run.peer&&!s.hasOffer){
              run.capture??=captureRef.current(aspect)
              const peer=new RTCPeerConnection({iceServers:created.iceServers});run.peer=peer
              for(const track of run.capture.stream.getVideoTracks()){
                const sender=peer.addTrack(track,run.capture.stream);try{const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];p.encodings.forEach(e=>{e.maxBitrate=12_000_000;e.maxFramerate=60});await sender.setParameters(p)}catch{/* encoder hints optional */}
              }
              await peer.setLocalDescription(await peer.createOffer());await gatherCastIce(peer)
              if(run.cancelled||run.peer!==peer)return
              await command('offer',{id:created.id,receiverId:s.receiverId,description:peer.localDescription?.toJSON()});run.offerSent=true
            }
            if(run.peer&&s.answer&&!run.peer.currentRemoteDescription)await run.peer.setRemoteDescription(s.answer)
            if(run.peer?.connectionState==='connected'){run.negotiatingAt=Date.now();update({status:'Now casting'})}
            else if(Date.now()-run.negotiatingAt>45000){await command('reject',{id:created.id,receiverId:s.receiverId});closePeer(run);update({receiverId:null,status:'Waiting for receiver',error:'Connection timed out. Ask the receiver to join again.'})}
          }
        }catch(error){
          if(run.cancelled)return
          if((error instanceof CastApiError&&[401,403,404].includes(error.status))||Date.now()-run.lastSuccess>65000){stop(error instanceof Error?error.message:'Cast ended');return}
          // A failed negotiation must be replaced by a fresh generation; never reuse stale SDP.
          if(run.peer&&!run.offerSent){const generation=run.generation;closePeer(run);if(generation)await command('reject',{id:created.id,receiverId:generation}).catch(()=>undefined)}
          update({status:'Reconnecting…',error:error instanceof Error?error.message:'Network interrupted'})
        }finally{if(!run.cancelled)run.timer=window.setTimeout(()=>void tick(),1800)}
      }
      void tick()
    }catch(error){if(!run.cancelled)stop(error instanceof Error?error.message:'Could not create cast')}
  },[available,stop])
  const decide=useCallback(async(approve:boolean)=>{
    const run=running.current,receiverId=view.receiverId
    if(!run?.session||!receiverId)return
    try{await command(approve?'approve':'reject',{id:run.session.id,receiverId});if(!run.cancelled)setView(v=>({...v,status:approve?'Connecting…':'Waiting for receiver',receiverId:approve?receiverId:null,error:null}))}
    catch(error){if(!run.cancelled)setView(v=>({...v,error:error instanceof Error?error.message:'Could not update receiver'}))}
  },[view.receiverId])
  return {view,start,stop,decide,configured:supabaseConfigured,active:!!view.aspect}
}
export type WebCastController = ReturnType<typeof useWebCast>

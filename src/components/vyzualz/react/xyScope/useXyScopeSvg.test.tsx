// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaStore, type UploadedMedia } from '../../../../stores/mediaStore'
import { useXyScopeSvg, isXyScopeSvgUpload } from './useXyScopeSvg'
const item = (id: string): UploadedMedia => ({id,name:`${id}.svg`,type:'image',url:`https://local.test/${id}`,thumbnailUrl:null,meta:'SVG',favorite:false,mediaRole:'svg',mimeType:'image/svg+xml',tags:[],collectionIds:[],metadata:{}})
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L100 50L50 100Z"/></svg>'
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
function Harness({id}: {id:string}) { const result=useXyScopeSvg(id,true); return <div data-status={result.status} data-id={result.source?.id}>{result.error}</div> }
beforeEach(()=>{useMediaStore.setState({items:[item('one'),item('two')],loading:false});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();useMediaStore.setState({items:[]})})
describe('SVG upload selection lifecycle',()=>{
 it('shows only genuine uploaded SVG entries',()=>{
  expect(isXyScopeSvgUpload(item('one'))).toBe(true)
  expect(isXyScopeSvgUpload({...item('fake'),mediaRole:'background_image',mimeType:'image/png'})).toBe(false)
  expect(isXyScopeSvgUpload({...item('uploading'),uploading:true})).toBe(false)
  expect(isXyScopeSvgUpload({...item('deleted'),lifecycleStatus:'deletion_pending'})).toBe(false)
 })
 it('ignores late requests, draws the selected upload, and drops deleted geometry',async()=>{
  const pending = new Map<string,(value:Response)=>void>()
  vi.stubGlobal('fetch',vi.fn((url:string)=>new Promise<Response>(resolve=>pending.set(url,resolve))))
  await act(async()=>root.render(<Harness id="one"/>));expect(host.firstElementChild?.getAttribute('data-status')).toBe('loading')
  await act(async()=>root.render(<Harness id="two"/>))
  await act(async()=>pending.get('https://local.test/two')!(new Response(SVG)))
  expect(host.firstElementChild?.getAttribute('data-id')).toBe('two')
  await act(async()=>pending.get('https://local.test/one')!(new Response(SVG.replace('100','90'))))
  expect(host.firstElementChild?.getAttribute('data-id')).toBe('two')
  await act(async()=>useMediaStore.setState({items:[item('one')]}))
  expect(host.firstElementChild?.getAttribute('data-status')).toBe('missing')
  expect(host.firstElementChild?.getAttribute('data-id')).toBeNull()
 })
 it('reports invalid files rather than leaving a previous drawing active',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('<svg><text>no vector paths</text></svg>')))
  await act(async()=>root.render(<Harness id="one"/>))
  expect(host.firstElementChild?.getAttribute('data-status')).toBe('error')
  expect(host.textContent).toContain('vector SVG')
 })
})

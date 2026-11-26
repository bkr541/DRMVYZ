// Browser-only fixture: immutable GLB versions pass the real import inspection,
// resolver, cache, preparation and native binding. Only account/storage are stubbed.
import { BoxGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { supabase } from '../../lib/supabase'
import { modelAssetRepository as repo } from '../../features/models/data/modelAssetRepository'
import { exportModelGlb } from '../../features/models/export/exportGlb'
import { inspectGlbFile } from '../../features/models/import/glbImport'
import { disposeModelGroup } from '../../features/models/geometry/createExtrudedModel'
import { decodeModelPreview } from '../../features/models/data/loadModelPreview'

const owner = 'a0000000-0000-4000-8000-000000000001'
export type ReleaseModelVariant = 'primary' | 'replacement' | 'missing' | 'upgrade' | 'wrong-color' | 'opaque' | 'no-texture' | 'no-mask'
const variants = ['primary', 'replacement', 'wrong-color', 'opaque', 'no-texture', 'no-mask'] as const
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const identity = (variant: ReleaseModelVariant) => variant === 'upgrade' ? { key: id(1), version: 2 } : { key: id(variant === 'missing' ? 99 : variants.indexOf(variant) + 1), version: 1 }
let installed: Promise<void> | undefined
const records = new Map<string, { url: string; bytes: ArrayBuffer; stats: Awaited<ReturnType<typeof inspectGlbFile>>['stats'] }>()
const recordKey = (key: string, version: number) => `${key}:${version}`

async function makeFixture(variant: Exclude<ReleaseModelVariant, 'missing'>) {
  const group = new Group()
  const tile = document.createElement('canvas'); tile.width = tile.height = 64
  const ctx = tile.getContext('2d')!
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#222222'; ctx.fillRect(x * 8, y * 8, 8, 8)
  }
  const map = new CanvasTexture(tile); map.colorSpace = SRGBColorSpace
  const mask = document.createElement('canvas'); mask.width = mask.height = 64
  const mc = mask.getContext('2d')!; mc.fillStyle = '#ffffff'; mc.fillRect(0, 0, 64, 64); mc.clearRect(16, 16, 32, 32)
  const cutout = new CanvasTexture(mask); cutout.colorSpace = SRGBColorSpace
  const patch = (name: string, x: number, y: number, z: number, material: MeshStandardMaterial, depth = .28) => {
    material.name = name
    const mesh = new Mesh(new BoxGeometry(.85, .85, depth), material); mesh.name = name; mesh.position.set(x, y, z); group.add(mesh)
  }
  patch('red-rough', -.95, .48, 0, new MeshStandardMaterial({ color: variant === 'wrong-color' ? '#22e522' : '#ee1616', roughness: .82 }))
  patch('green-metal', 0, .48, 0, new MeshStandardMaterial({ color: '#16ee16', metalness: .65, roughness: .25 }))
  patch('blue-emission', .95, .48, 0, new MeshStandardMaterial({ color: '#1616ee', emissive: '#0808bc', emissiveIntensity: .5 }))
  patch('checker', -.95, -.48, 0, new MeshStandardMaterial({ color: '#eeeeee', map: variant === 'no-texture' ? null : map, roughness: .9 }))
  patch('blend-back', 0, -.48, -.22, new MeshStandardMaterial({ color: '#ee1616', roughness: .8 }))
  patch('blend-front', 0, -.48, .15, new MeshStandardMaterial({ color: '#1616ee', transparent: variant !== 'opaque', opacity: variant === 'opaque' ? 1 : .35, depthWrite: variant === 'opaque', side: DoubleSide }), .04)
  patch('mask', .95, -.48, 0, new MeshStandardMaterial({ color: '#eeeeee', map: cutout, alphaTest: variant === 'no-mask' ? 0 : .5, side: DoubleSide }), .04)
  if (variant === 'replacement') group.scale.set(.55, 1.5, 1.8)
  if (variant === 'upgrade') group.scale.set(1.2, .7, 2)
  try {
    const glb = await exportModelGlb(group)
    const inspected = await inspectGlbFile(new File([glb], `${variant}.glb`, { type: 'model/gltf-binary' }), new AbortController().signal)
    return { bytes: inspected.bytes, stats: inspected.stats, url: URL.createObjectURL(glb) }
  } finally { disposeModelGroup(group); if (variant === 'no-texture') map.dispose() }
}
async function install() {
  // Sequential export/import prevents overlapping thumbnail WebGL contexts.
  for (const variant of [...variants, 'upgrade'] as const) {
    const { key, version } = identity(variant)
    records.set(recordKey(key, version), await makeFixture(variant))
  }
  const original = { getUser: supabase.auth.getUser, get: repo.get, getVersion: repo.getVersion, signedUrl: repo.signedUrl }
  supabase.auth.getUser = (async () => ({ data: { user: { id: owner } }, error: null })) as unknown as typeof supabase.auth.getUser
  repo.get = (async (key: string) => {
    if (!records.has(recordKey(key, 1))) throw Error('Fixture model missing')
    return { id: key, userId: owner, status: 'ready', currentVersion: key === id(1) ? 2 : 1, kind: 'imported' }
  }) as unknown as typeof repo.get
  repo.getVersion = (async (key: string, version: number) => {
    const model = records.get(recordKey(key, version)); if (!model) throw Error('Unexpected fixture version')
    return { modelAssetId: key, version, geometryStats: model.stats, generatorRecipe: null }
  }) as unknown as typeof repo.getVersion
  repo.signedUrl = (async (key: string, version: number) => {
    const model = records.get(recordKey(key, version)); if (!model) throw Error('Unexpected fixture URL')
    return { url: model.url, expiresAt: Date.now() + 60000 }
  }) as unknown as typeof repo.signedUrl
  addEventListener('pagehide', () => {
    supabase.auth.getUser = original.getUser; repo.get = original.get; repo.getVersion = original.getVersion; repo.signedUrl = original.signedUrl
    records.forEach(model => URL.revokeObjectURL(model.url)); records.clear()
  }, { once: true })
}
export async function installReleaseModelFixture(variant: ReleaseModelVariant = 'primary'): Promise<string> {
  await (installed ??= install())
  const { key, version } = identity(variant); return `user-model:${key}:${version}`
}

/** Actual editor stage, same immutable bytes, not an alternate reference renderer. */
export async function captureReleaseModelEditor(variant: Exclude<ReleaseModelVariant, 'missing'>) {
  await installReleaseModelFixture(variant)
  const { key, version } = identity(variant), record = records.get(recordKey(key, version))!
  const [{ createElement }, { createRoot }, { ModelEditorStage }, { useModelEditorStore }] = await Promise.all([
    import('react'), import('react-dom/client'), import('../../components/vyzualz/media/ModelEditorStage'), import('../../features/models/state/modelEditorStore'),
  ])
  const decoded = await decodeModelPreview(record.bytes, new AbortController().signal, true)
  const materials: Record<string, unknown>[] = []
  const describe = (texture: import('three').Texture | null) => texture ? { colorSpace: texture.colorSpace, channel: texture.channel, offset: texture.offset.toArray(), repeat: texture.repeat.toArray(), rotation: texture.rotation, flipY: texture.flipY } : null
  decoded.group.traverse(object => {
    if (!(object instanceof Mesh)) return
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) if (m instanceof MeshStandardMaterial) materials.push({
      name: m.name, color: m.color.getHexString(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive.getHexString(), emissiveIntensity: m.emissiveIntensity,
      opacity: m.opacity, transparent: m.transparent, alphaTest: m.alphaTest, depthWrite: m.depthWrite, side: m.side,
      map: describe(m.map), normalMap: describe(m.normalMap), alphaMap: describe(m.alphaMap),
    })
  })
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;background:#10181d;z-index:10'
  const mount = document.createElement('div'); mount.style.height = '100%'; host.append(mount)
  const style = document.createElement('style'); style.textContent = '.mm-model-stage,.mm-model-canvas{width:100%;height:100%}'; host.append(style); document.body.append(host)
  const root = createRoot(mount)
  try {
    useModelEditorStore.setState({ model: decoded, recipe: null, status: 'ready' })
    root.render(createElement(ModelEditorStage))
    for (let i = 0; i < 120; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const guides = host.querySelector<HTMLButtonElement>('button[aria-label="Floor grid and axis lines"]')
      if (guides?.getAttribute('aria-pressed') === 'true') { guides.click(); continue }
      const viewport = host.querySelector<HTMLCanvasElement>('canvas[aria-label="3D model viewport"]')
      if (viewport && i > 20 && viewport.width > 1 && viewport.height > 1) return { png: viewport.toDataURL('image/png'), stats: record.stats, materials, binding: `user-model:${key}:${version}` }
    }
    throw Error('Model Editor reference viewport did not render')
  } finally { root.unmount(); useModelEditorStore.setState({ model: null, status: 'idle' }); decoded.dispose(); host.remove() }
}

import { Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, PerspectiveCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Renders a square PNG of a model on its own throw-away renderer, with the same background, lights, studio environment and camera framing as the
 * Media Manager viewport, so a thumbnail looks like the model does when it is opened. The group is not modified, and its textures stay usable
 * (the caller still owns and disposes the group).
 */
export async function renderModelThumbnail(group: Group, edge = 256, signal?: AbortSignal): Promise<Blob> {
  const size = Math.max(64, Math.min(1024, Math.round(edge)))
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
  let renderer: WebGLRenderer
  try { renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }) }
  catch { throw new Error('WebGL is unavailable, so no thumbnail could be drawn.') }
  const scene = new Scene(), camera = new PerspectiveCamera(38, 1, 0.01, 10000), pmrem = new PMREMGenerator(renderer)
  const parent = group.parent
  try {
    if (signal?.aborted) throw new DOMException('Thumbnail cancelled.', 'AbortError')
    renderer.setPixelRatio(1); renderer.setSize(size, size, false)
    scene.background = new Color('#10181d')
    const room = new RoomEnvironment(), environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture; room.dispose()
    const key = new DirectionalLight('#fff2dd', 4), fill = new DirectionalLight('#9adfff', 2)
    scene.add(new HemisphereLight('#ffffff', '#4b5868', 2), key, fill, key.target, fill.target)
    scene.add(group)
    const box = new Box3().setFromObject(group), center = box.getCenter(new Vector3()), extent = Math.max(...box.getSize(new Vector3()).toArray(), 0.1)
    key.position.copy(center).addScaledVector(new Vector3(4, 6, 5), extent); key.target.position.copy(center)
    fill.position.copy(center).addScaledVector(new Vector3(-4, 1, 2), extent); fill.target.position.copy(center)
    camera.position.copy(center).add(new Vector3(0.8, 0.5, 1).normalize().multiplyScalar(extent / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.5))
    camera.near = Math.max(0.001, extent / 1000); camera.far = extent * 100; camera.lookAt(center); camera.updateProjectionMatrix()
    let visible = false
    group.traverse(object => { if (object instanceof Mesh && object.visible) visible = true })
    if (!visible) throw new Error('The model has nothing visible to draw.')
    renderer.render(scene, camera)
    // A blank frame means the draw failed (lost context, black materials); an empty thumbnail is worse than none.
    const probe = document.createElement('canvas'); probe.width = probe.height = 32
    const context = probe.getContext('2d'); if (!context) throw new Error('Thumbnail capture is unavailable.')
    context.drawImage(canvas, 0, 0, 32, 32)
    const pixels = context.getImageData(0, 0, 32, 32).data
    let variation = 0
    for (let i = 0; i < pixels.length; i += 4) variation = Math.max(variation, Math.abs(pixels[i]! - pixels[0]!), Math.abs(pixels[i + 1]! - pixels[1]!), Math.abs(pixels[i + 2]! - pixels[2]!))
    if (variation < 4) throw new Error('The model thumbnail rendered blank.')
    environment.dispose()
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('Could not encode a thumbnail PNG.')), 'image/png'))
  } finally {
    scene.remove(group); parent?.add(group)
    pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.width = canvas.height = 0
  }
}

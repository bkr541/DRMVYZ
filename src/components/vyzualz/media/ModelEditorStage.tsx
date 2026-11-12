import { useEffect, useRef, useState } from 'react'
import { AxesHelper, Box3, Color, DirectionalLight, GridHelper, Group, HemisphereLight, LineSegments, Mesh, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { registerModelViewport } from '../../../features/models/state/modelViewportBridge'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'
interface CameraActions { fit(): void; reset(): void }
export function ModelEditorStage() {
  const model = useModelEditorStore(s => s.model), status = useModelEditorStore(s => s.status)
  const asset = useModelEditorStore(s => s.asset), sessionKey = useModelEditorStore(s => s.sessionKey)
  const cameraPose = useRef<{ session: number; position: Vector3; target: Vector3 } | null>(null)
  const name = useModelEditorStore(s => s.name), dirty = useModelEditorStore(s => s.dirty)
  const root = useRef<HTMLDivElement>(null), actions = useRef<CameraActions | null>(null)
  const [error, setError] = useState<string | null>(null), [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (!model || !root.current) return
    const host = root.current, scene = new Scene(), camera = new PerspectiveCamera(38, 1, 0.01, 10000)
    let renderer: WebGLRenderer
    try { renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true }) }
    catch { setError('WebGL is unavailable. Enable hardware acceleration or retry the viewport.'); return }
    setError(null)
    const canvas = renderer.domElement; canvas.setAttribute('aria-label', '3D model viewport'); canvas.setAttribute('role', 'img'); canvas.tabIndex = 0
    host.appendChild(canvas); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true
    scene.background = new Color('#10181d')
    const controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.screenSpacePanning = true
    const hemisphere = new HemisphereLight('#ffffff', '#4b5868', 2); scene.add(hemisphere)
    const key = new DirectionalLight('#fff2dd', 4); key.position.set(4, 6, 5); key.castShadow = true; scene.add(key)
    const fill = new DirectionalLight('#9adfff', 2); fill.position.set(-4, 1, 2); scene.add(fill)
    const bounds = new Box3().setFromObject(model.group), center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3())
    const extent = Math.max(size.x, size.y, size.z, 0.1), resources = new Group()
    const grid = new GridHelper(extent * 4, 20, '#4d7182', '#263b45'); grid.position.y = bounds.min.y - extent * 0.02; grid.position.x = center.x; grid.position.z = center.z
    resources.add(grid)
    const floor = new Mesh(new PlaneGeometry(extent * 6, extent * 6), new ShadowMaterial({ opacity: 0.3 })); floor.rotation.x = -Math.PI / 2; floor.position.copy(grid.position); floor.receiveShadow = true; resources.add(floor)
    const axes = new AxesHelper(extent * 0.5); axes.position.copy(grid.position); resources.add(axes)
    model.group.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true } })
    key.position.copy(center).add(new Vector3(4, 6, 5).multiplyScalar(extent)); key.target.position.copy(center); scene.add(key.target)
    key.shadow.camera.left = key.shadow.camera.bottom = -extent * 3; key.shadow.camera.right = key.shadow.camera.top = extent * 3; key.shadow.camera.far = extent * 30; key.shadow.camera.updateProjectionMatrix()
    scene.add(resources); scene.add(model.group)
    const pmrem = new PMREMGenerator(renderer)
    let environment: ReturnType<PMREMGenerator['fromScene']> | null = null
    const studio = () => { environment?.dispose(); const room = new RoomEnvironment(); environment = pmrem.fromScene(room, 0.04); scene.environment = environment.texture; room.dispose() }
    let frame = 0, visible = !document.hidden, intersects = true, lost = false, disposed = false
    let lastFrame = performance.now()
    const draw = () => { frame = 0; if (!disposed && visible && !lost) { const now = performance.now(); if (controls.autoRotate) controls.update(Math.min(0.1, (now - lastFrame) / 1000)); lastFrame = now; renderer.render(scene, camera); if (controls.autoRotate) invalidate() } }
    const invalidate = () => { if (!frame && visible && !lost && !disposed) frame = requestAnimationFrame(draw) }
    const fit = () => {
      const distance = extent / (2 * Math.tan(camera.fov * Math.PI / 360)) * Math.max(1, 1 / camera.aspect) * 1.5
      controls.target.copy(center); camera.position.copy(center).add(new Vector3(0.8, 0.5, 1).normalize().multiplyScalar(distance))
      controls.minDistance = extent * 0.15; controls.maxDistance = extent * 30
      camera.near = Math.max(0.001, extent / 1000); camera.far = extent * 100; camera.updateProjectionMatrix(); controls.update(); invalidate()
    }
    actions.current = { fit, reset: fit }
    const resize = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight)
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(width, height)
      camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate()
    }
    const visibility = () => { visible = intersects && !document.hidden; if (!visible && frame) { cancelAnimationFrame(frame); frame = 0 } else invalidate() }
    const onLost = (event: Event) => { event.preventDefault(); lost = true; if (frame) cancelAnimationFrame(frame); frame = 0; setError('The graphics context was lost. Waiting for recovery…') }
    const onRestored = () => { try { lost = false; studio(); applyPreview(); setError(null); resize(); invalidate() } catch { lost = true; setError('The graphics context could not recover. Retry the viewport.') } }
    const observer = new ResizeObserver(resize), intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { intersects = entries[0].isIntersecting; visible = intersects && !document.hidden; if (!visible && frame) { cancelAnimationFrame(frame); frame = 0 } else invalidate() })
    const applyPreview = () => {
      const preview = useModelEditorStore.getState().recipe?.preview
      scene.background = new Color(preview?.background ?? '#10181d')
      const intensity = preview?.lightIntensity ?? 1
      hemisphere.intensity = 2 * intensity; key.intensity = 4 * intensity; fill.intensity = 2 * intensity
      scene.environment = environment?.texture ?? null
      scene.environmentIntensity = (preview?.environment === 'neutral' ? 0.5 : 1) * intensity
      grid.visible = preview?.grid ?? true; floor.visible = preview?.shadows ?? true
      renderer.shadowMap.enabled = preview?.shadows ?? true
      controls.autoRotate = preview?.turntable ?? false; controls.autoRotateSpeed = 1
      invalidate()
    }
    const unsubscribe = useModelEditorStore.subscribe((next, previous) => { if (next.recipe?.preview !== previous.recipe?.preview) applyPreview() })
    const stopTurntable = () => { const state = useModelEditorStore.getState(); if (state.recipe?.preview.turntable) state.setRecipe({ preview: { ...state.recipe.preview, turntable: false } }) }
    controls.addEventListener('start', stopTurntable)
    const unregister = registerModelViewport({ group: model.group, capture: async (edge = 256, frameModel = true) => {
      if (lost || disposed || renderer.getContext().isContextLost() || !model.group.children.length) throw new Error('Restore the 3D viewport before capturing a model preview.')
      const position = camera.position.clone(), target = controls.target.clone(), automatic = controls.autoRotate, helpersVisible = resources.visible
      controls.autoRotate = false
      const thumbnail = document.createElement('canvas'); thumbnail.width = thumbnail.height = Math.max(64, Math.min(1024, edge))
      try {
        let visibleGeometry = false
        model.group.traverse(object => { if (object instanceof Mesh && object.visible && (Array.isArray(object.material) ? object.material : [object.material]).some(material => material.opacity > 0.001)) visibleGeometry = true })
        if (!visibleGeometry) throw new Error('The model is invisible. Increase material opacity before saving.')
        if (frameModel) { resources.visible = false; fit() }
        renderer.render(scene, camera)
        const ctx = thumbnail.getContext('2d'); if (!ctx) throw new Error('Preview PNG capture is unavailable.')
        ctx.fillStyle = (scene.background as Color).getStyle(); ctx.fillRect(0, 0, thumbnail.width, thumbnail.height)
        const scale = Math.min(thumbnail.width / canvas.width, thumbnail.height / canvas.height), width = canvas.width * scale, height = canvas.height * scale
        ctx.drawImage(canvas, (thumbnail.width - width) / 2, (thumbnail.height - height) / 2, width, height)
        const pixels = ctx.getImageData(0, 0, thumbnail.width, thumbnail.height).data
        let variation = 0
        for (let i = 0; i < pixels.length; i += 4) variation = Math.max(variation, Math.abs(pixels[i] - pixels[0]), Math.abs(pixels[i + 1] - pixels[1]), Math.abs(pixels[i + 2] - pixels[2]))
        if (variation < 4) throw new Error('The model preview is blank. Adjust lighting before saving.')
        return await new Promise<Blob>((resolve, reject) => thumbnail.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('Could not encode a model preview PNG.')), 'image/png'))
      } finally { resources.visible = helpersVisible; camera.position.copy(position); controls.target.copy(target); controls.autoRotate = automatic; controls.update(); thumbnail.width = thumbnail.height = 0; invalidate() }
    } })
    controls.addEventListener('change', invalidate); document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored)
    observer.observe(host); intersection?.observe(host)
    try { studio(); applyPreview(); resize(); fit(); const pose = cameraPose.current; if (pose?.session === sessionKey) { camera.position.copy(pose.position); controls.target.copy(pose.target); controls.update(); invalidate() } } catch { lost = true; setError('The studio preview could not initialize. Retry the viewport.') }
    return () => {
      cameraPose.current = { session: sessionKey, position: camera.position.clone(), target: controls.target.clone() }
      unregister(); unsubscribe(); controls.removeEventListener('start', stopTurntable)
      disposed = true; cancelAnimationFrame(frame); actions.current = null
      observer.disconnect(); intersection?.disconnect(); controls.dispose(); document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored)
      scene.remove(model.group)
      resources.traverse(object => { if (object instanceof Mesh || object instanceof LineSegments) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose()) } })
      environment?.dispose(); pmrem.dispose(); key.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
    }
  }, [model, epoch, sessionKey])
  return <section className="mm-model-stage" aria-label="3D model editor">
    <div className="mm-model-stage-toolbar"><span>{name || '3D Model'} · {dirty ? 'Draft / Unsaved' : asset?.currentVersion ? 'Saved model' : 'No published model'}</span>
      <IconChipButton onClick={() => actions.current?.fit()} disabled={!model}>Fit model</IconChipButton>
      <IconChipButton onClick={() => actions.current?.reset()} disabled={!model}>Reset camera</IconChipButton>
    </div>
    <div className="mm-model-canvas" ref={root} />
    {!model && <div className="mm-model-stage-empty" role="status">{status === 'generating' ? 'Generating 3D geometry…' : status === 'loading-model' ? 'Loading saved model…' : status === 'error' ? 'Model unavailable. Retry loading or select another asset.' : 'Prepare the source, then generate a 3D model.'}</div>}
    {error && <div className="mm-model-stage-notice"><NoticeCard tone="error" role="alert" title="3D viewport unavailable">{error} <IconChipButton onClick={() => setEpoch(value => value + 1)}>Retry viewport</IconChipButton></NoticeCard></div>}
    <div className="mm-model-navigation">Drag to orbit · Right-drag or two fingers to pan · Scroll or pinch to zoom</div>
  </section>
}

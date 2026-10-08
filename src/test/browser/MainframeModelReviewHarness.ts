/** Stage 2-only neutral-light inspection harness for the generated Mainframe GLB. It does not register a preset or run Cinema. */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type ReviewState = Readonly<{ ready: boolean; view: 'front' | 'three-quarter'; triangles: number; error: string | null }>

declare global {
  interface Window {
    __mainframeModelReview?: { status(): ReviewState }
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#mainframe-model-review')
if (!canvas) throw new Error('The Mainframe model-review canvas is missing.')
const query = new URLSearchParams(location.search)
const view: ReviewState['view'] = query.get('view') === 'three-quarter' ? 'three-quarter' : 'front'
const state: { ready: boolean; view: ReviewState['view']; triangles: number; error: string | null } = {
  ready: false,
  view,
  triangles: 0,
  error: null,
}
window.__mainframeModelReview = { status: () => Object.freeze({ ...state }) }

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.18
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x020403)
const environmentGenerator = new THREE.PMREMGenerator(renderer)
scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture
environmentGenerator.dispose()
scene.add(new THREE.HemisphereLight(0xdce8df, 0x020302, 0.72))

const key = new THREE.DirectionalLight(0xf5fff7, 3.6)
key.position.set(-5.5, 6.5, 8)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.left = -7
key.shadow.camera.right = 7
key.shadow.camera.top = 4.2
key.shadow.camera.bottom = -4.2
key.shadow.camera.near = 2
key.shadow.camera.far = 24
key.shadow.bias = -0.00025
scene.add(key)

const rim = new THREE.DirectionalLight(0xc9e2ff, 2.1)
rim.position.set(6.5, 2.5, 6)
scene.add(rim)
const fill = new THREE.DirectionalLight(0xcfd7d0, 0.72)
fill.position.set(-1, -5, 5)
scene.add(fill)

const camera = new THREE.PerspectiveCamera(view === 'front' ? 35 : 39, innerWidth / innerHeight, 0.1, 80)
if (view === 'front') camera.position.set(0, 0, 12.2)
else camera.position.set(5.4, 2.25, 14.4)
camera.lookAt(0, 0, 0.08)

function render() {
  renderer.render(scene, camera)
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  render()
})

new GLTFLoader().load('/cinema2/models/mainframe.glb', gltf => {
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    state.triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.getAttribute('position').count / 3
    object.castShadow = !['board', 'plates', 'recesses'].includes(object.name)
    object.receiveShadow = true
  })
  scene.add(gltf.scene)
  renderer.compile(scene, camera)
  render()
  state.ready = true
}, undefined, error => {
  state.error = error instanceof Error ? error.message : String(error)
})

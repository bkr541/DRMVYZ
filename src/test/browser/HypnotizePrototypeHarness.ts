// Throwaway design prototype for the Hypnotize redesign (docs/hypnotize-redesign.md): still frames of two directions, drawn with plain Three.js and a bloom pass.
// ?dir=1 spiral ring tunnel, ?dir=3 tunnel lined with rotating dials; &w=&h= size, &palette=cyan|duo, &seed=.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const q = new URLSearchParams(location.search)
const dir = q.get('dir') === '3' ? 3 : 1
const W = Number(q.get('w') ?? 1280), H = Number(q.get('h') ?? 720)
const palette = q.get('palette') === 'duo' ? 'duo' : 'cyan'
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const rand = rng(Number(q.get('seed') ?? 7))

const CYAN = new THREE.Color(0.1, 0.78, 1), VIOLET = new THREE.Color(0.55, 0.22, 1), WHITE = new THREE.Color(0.9, 0.97, 1)
const accentA = CYAN, accentB = palette === 'duo' ? VIOLET : WHITE
const hdr = (c: THREE.Color, k: number) => new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k) })

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(1); renderer.setSize(W, H)
document.getElementById('host')!.appendChild(renderer.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.FogExp2(0x000000, dir === 1 ? 0.034 : 0.03)
const camera = new THREE.PerspectiveCamera(68, W / H, 0.05, 220); camera.position.set(0, 0, 0.4); camera.lookAt(0, 0, -60); camera.rotation.z = dir === 1 ? 0.045 : 0.03

const dark = new THREE.MeshStandardMaterial({ color: 0x0c1119, roughness: 0.5, metalness: 0.65 })
const darker = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.7, metalness: 0.35 })

if (dir === 1) {
  // ── Direction 1: the spiral ring tunnel ─────────────────────────────────────
  const R = 5.6, RINGS = 34, SPACING = 3.1
  const tunnelEnd = -(RINGS * SPACING) - 2, tunnelLength = RINGS * SPACING + 6
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.2, tunnelLength, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0x030408, roughness: 0.8, metalness: 0.3, side: THREE.BackSide }))
  shell.rotation.x = Math.PI / 2; shell.position.z = -tunnelLength / 2 + 1; scene.add(shell)
  const LINES = 40
  for (let l = 0; l < LINES; l += 1) {
    const ang = (l / LINES) * Math.PI * 2, bright = l % 10 === 0, mid = l % 5 === 0
    const colour = bright ? WHITE : l % 10 === 5 ? accentA : accentB
    const line = new THREE.Mesh(new THREE.BoxGeometry(bright ? 0.1 : 0.05, 0.05, tunnelLength), hdr(colour, bright ? 3 : mid ? 1.1 : 0.28))
    line.position.set(Math.cos(ang) * (R + 0.05), Math.sin(ang) * (R + 0.05), -tunnelLength / 2 + 1); line.rotation.z = ang; scene.add(line)
  }
  for (let i = 0; i < RINGS; i += 1) {
    const g = new THREE.Group(); g.position.z = -i * SPACING - 2.2; g.rotation.z = i * 0.21 + (i % 2 ? 0.35 : 0)
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 10, 180), dark))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.9, 0.06, 6, 140), hdr(i % 3 === 0 ? accentA : accentB, 0.9)))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, 0.1, 8, 140), dark))
    const hero = i === 5 || i === 11 || i === 19
    const arcs = hero ? 8 : 4 + Math.floor(rand() * 4)
    for (let a = 0; a < arcs; a += 1) {
      const arc = (hero ? 0.6 : 0.28) + rand() * (hero ? 1.0 : 0.85), start = rand() * Math.PI * 2
      const colour = (i + a) % 4 === 0 ? accentA : (i + a) % 4 === 2 ? accentB : WHITE
      const strip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, hero ? 0.13 : 0.09, 6, 44, arc), hdr(colour, hero ? 5.5 : 4.4)); strip.rotation.z = start; g.add(strip)
    }
    if (i % 2 === 0) for (let v = 0; v < 26; v += 1) {
      const ang = (v / 26) * Math.PI * 2
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.16, R * 0.3, 0.3), dark)
      vane.position.set(Math.cos(ang) * R * 0.8, Math.sin(ang) * R * 0.8, 0); vane.rotation.z = ang - Math.PI / 2 + 0.45; g.add(vane)
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, R * 0.28, 0.03), hdr(v % 4 === 0 ? accentA : accentB, v % 4 === 0 ? 3.4 : 1))
      edge.position.copy(vane.position); edge.rotation.copy(vane.rotation); edge.position.z = 0.17; g.add(edge)
    }
    scene.add(g)
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), hdr(accentA, 3)); glow.position.z = tunnelEnd - 3; scene.add(glow)
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), hdr(WHITE, 8)); core.position.z = tunnelEnd - 2.9; scene.add(core)
} else {
  // ── Direction 3: a square tunnel whose four walls are tiled with rotating dials ─
  const S = 6.4, ROWS = 26, PITCH = 3.2, DIAL = 1.45
  const length = ROWS * PITCH + 8
  const baseGeo = new THREE.CylinderGeometry(DIAL, DIAL * 0.97, 0.5, 48); baseGeo.rotateX(Math.PI / 2)
  const lipGeo = new THREE.TorusGeometry(DIAL - 0.05, 0.055, 6, 52)
  const ringGeos = [[1.05, 0.035], [0.7, 0.04], [0.36, 0.05]].map(([r, w]) => new THREE.TorusGeometry(r, w, 5, 44))
  const armGeo = new THREE.BoxGeometry(0.06, 0.78, 0.05)
  const walls = [
    { n: new THREE.Vector3(0, 1, 0), at: (u: number, z: number) => new THREE.Vector3(u, -S, z) },   // floor
    { n: new THREE.Vector3(0, -1, 0), at: (u: number, z: number) => new THREE.Vector3(u, S, z) },   // ceiling
    { n: new THREE.Vector3(1, 0, 0), at: (u: number, z: number) => new THREE.Vector3(-S, u, z) },   // left wall
    { n: new THREE.Vector3(-1, 0, 0), at: (u: number, z: number) => new THREE.Vector3(S, u, z) },   // right wall
  ]
  const across = [-S + PITCH / 2, -S + PITCH * 1.5, -S + PITCH * 2.5, -S + PITCH * 3.5].map(u => u * 0.98)
  for (let row = 0; row < ROWS; row += 1) {
    const z = -2.2 - row * PITCH
    // a band of light travelling down the tunnel: the rows inside it are "playing", the rest stay quiet
    const wave = Math.sin(row * 0.52 - 2.0)
    const playing = wave > 0.78
    for (const [w, wall] of walls.entries()) for (const [c, u] of across.entries()) {
      const tone = playing ? ((c + w) % 2 === 0 ? accentA : accentB) : ((c + w + row) % 3 === 0 ? accentB : accentA)
      const white = playing && rand() < 0.14
      const gain = white ? 4.2 : playing ? 3 : 0.34
      const pos = wall.at(u, z)
      const d = new THREE.Group(); d.position.copy(pos); d.lookAt(pos.clone().add(wall.n)); d.rotateZ(rand() * Math.PI * 2)
      d.add(new THREE.Mesh(baseGeo, dark))
      const rim = new THREE.Mesh(lipGeo, hdr(white ? WHITE : tone, gain)); rim.position.z = 0.26; d.add(rim)
      for (const geo of ringGeos) { const ring = new THREE.Mesh(geo, hdr(white ? WHITE : tone, gain * 0.7)); ring.position.z = 0.27; d.add(ring) }
      for (let a = 0; a < 10; a += 1) { const ang = (a / 10) * Math.PI * 2; const arm = new THREE.Mesh(armGeo, hdr(white ? WHITE : tone, gain * 0.85)); arm.position.set(Math.cos(ang) * 0.66, Math.sin(ang) * 0.66, 0.28); arm.rotation.z = ang + 0.9; d.add(arm) }
      if (playing) { const hub = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), hdr(WHITE, 3)); hub.position.z = 0.3; d.add(hub) }
      scene.add(d)
    }
    // structural frames between the rows, like Depth's portals
    if (row % 2 === 0) {
      const frame = new THREE.Group(); frame.position.z = z + PITCH / 2
      for (const [x, y, w, h] of [[0, -S, S * 2 + 0.6, 0.3], [0, S, S * 2 + 0.6, 0.3], [-S, 0, 0.3, S * 2 + 0.6], [S, 0, 0.3, S * 2 + 0.6]] as const) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), dark); bar.position.set(x, y, 0); frame.add(bar) }
      scene.add(frame)
    }
  }
  for (const [x, y] of [[-S, -S], [S, -S], [-S, S], [S, S]] as const) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, length), hdr(WHITE, 1.6)); line.position.set(x, y, -length / 2); scene.add(line) }
  const end = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), hdr(accentA, 0.9)); end.position.z = -length; scene.add(end)
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.9, 36), hdr(WHITE, 7)); core.position.z = -length + 0.1; scene.add(core)
}

scene.add(new THREE.AmbientLight(0x1a2438, 0.25))
const head = new THREE.PointLight(0xdcecff, 22, 40, 2); head.position.set(0, 0, 1.5); scene.add(head)
for (const z of [-14, -34, -58]) { const p = new THREE.PointLight(accentA.getHex(), dir === 3 ? 60 : 30, 22, 2); p.position.set(0, 0, z); scene.add(p) }
if (dir === 3) { const v = new THREE.PointLight(VIOLET.getHex(), 50, 26, 2); v.position.set(2, 2, -22); scene.add(v) }

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 1.0))
composer.addPass(new OutputPass())
composer.render()
;(window as unknown as { __ready: boolean }).__ready = true

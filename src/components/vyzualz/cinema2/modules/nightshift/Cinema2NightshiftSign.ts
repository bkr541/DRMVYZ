import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { evaluateNightshiftCell, type NightshiftCell } from './Cinema2NightshiftDomain'
import type { NightshiftSceneFrame, shadeNightshiftMusicCell } from './Cinema2NightshiftSceneController'
import outlines from './Cinema2NightshiftSign.generated.json'

/** Freestanding Backstreet-style glass outline tubes.
 * The fixed contour package deliberately implements only the currently locked text. */
export class Cinema2NightshiftSign {
  readonly root: Three.Group
  private readonly geometries: Three.BufferGeometry[] = []
  private readonly tubes: { geometry: Three.BufferGeometry; addresses: number[] }[] = []
  private readonly material: Three.MeshPhysicalMaterial
  private readonly cells: NightshiftCell[] = Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i / 10), column: i % 10, paletteIndex: 1, level: 2 }))
  private readonly levels = new Float32Array(100)

  constructor(private readonly library: Cinema2ThreeLibrary) {
    const { THREE } = library
    this.root = new THREE.Group(); this.root.name = 'nightshift.sign'; this.root.visible = false
    this.root.position.set(0, 2.9, -8.15)
    this.root.userData.text = outlines.text
    this.material = new THREE.MeshPhysicalMaterial({ color: 0x080808, emissive: 0xffffff, emissiveIntensity: 2.6,
      roughness: .16, clearcoat: .6, clearcoatRoughness: .05, vertexColors: true, envMapIntensity: .35 })
    this.material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;')
    }
    this.material.customProgramCacheKey = () => 'nightshift-neon-outline-v1'
    for (const [index, glyph] of outlines.glyphs.entries()) {
      const positions: number[] = [], normals: number[] = [], indices: number[] = [], addresses: number[] = []
      // Fixed planar frame, as in Backstreet: constant-radius circular glass
      // swept around each outer/inner contour, without twisting at corners.
      for (const ring of glyph.contours) {
        const base = positions.length / 3
        for (let i = 0; i < ring.length; i++) {
          const previous = ring[(i - 1 + ring.length) % ring.length], next = ring[(i + 1) % ring.length], p = ring[i]
          const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy) || 1
          const column = Math.max(0, Math.min(9, Math.round((p[0] / outlines.width + .5) * 9)))
          const row = Math.max(0, Math.min(9, Math.round((p[1] / outlines.height + .5) * 9)))
          for (let j = 0; j < 8; j++) {
            const a = j / 8 * Math.PI * 2, nx = -dy / length * Math.cos(a), ny = dx / length * Math.cos(a), nz = Math.sin(a)
            positions.push(p[0] + nx * .026, p[1] + ny * .026, nz * .026)
            normals.push(nx, ny, nz); addresses.push(row * 10 + column)
            const b = base + i * 8 + j, c = base + i * 8 + (j + 1) % 8
            const d = base + (i + 1) % ring.length * 8 + j, e = base + (i + 1) % ring.length * 8 + (j + 1) % 8
            indices.push(b, c, d, c, e, d)
          }
        }
      }
      const geometry = this.own(new THREE.BufferGeometry())
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length).fill(1), 3).setUsage(THREE.DynamicDrawUsage))
      geometry.setIndex(indices); geometry.computeBoundingSphere()
      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.name = `nightshift.sign.letter.${index}.${glyph.character}`; this.root.add(mesh)
      this.tubes.push({ geometry, addresses })
    }
  }

  private own<T extends Three.BufferGeometry>(geometry: T): T { this.geometries.push(geometry); return geometry }

  apply(frame: NightshiftSceneFrame, shade: typeof shadeNightshiftMusicCell): void {
    const { controls: c, pattern, outgoingPattern, blend, phase, music } = frame
    this.root.visible = c.signs && c.master > 0
    this.root.scale.setScalar(c.signSize)
    if (!this.root.visible) return
    this.material.emissive.setRGB(...c.colors.sign, this.library.THREE.SRGBColorSpace)
    this.material.emissiveIntensity = 2.6 * c.master / .85
    this.cells.forEach((cell, index) => {
      const gain = (program: typeof pattern) => {
        const base = evaluateNightshiftCell(cell, program, phase, 1).gain
        return shade(cell, .24 + .76 * base, 1, music, program, phase)
      }
      const level = outgoingPattern ? gain(pattern) * blend + gain(outgoingPattern) * (1 - blend) : gain(pattern)
      this.levels[index] = Math.min(1.4, level + .2 * music.musicSnare + .18 * music.musicBuild + .2 * music.musicImpact)
    })
    for (const { geometry, addresses } of this.tubes) {
      const colors = geometry.getAttribute('color') as Three.BufferAttribute
      addresses.forEach((address, i) => colors.setXYZ(i, this.levels[address], this.levels[address], this.levels[address]))
      colors.needsUpdate = true
    }
  }

  dispose(): void {
    this.root.removeFromParent()
    for (const geometry of this.geometries) geometry.dispose()
    this.material.dispose()
    this.root.clear()
  }
}

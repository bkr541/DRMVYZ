// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Box3, BufferGeometry, Mesh, MeshPhysicalMaterial, Raycaster, Vector3 } from 'three'
import { convertBuffer, convertPixels } from '@visioncortex/vtracer'
import { initialize, vectorize_rgba } from '../trace/vendor/vtracer.js'
import { sanitizeModelSvg } from '../trace/svgSanitize'
import { createForegroundMask, sniffModelImage } from '../trace/imageInput'
import { createExtrudedModel } from '../geometry/createExtrudedModel'
import { checkDimensions, MODEL_QUALITY } from '../geometry/modelQualityBudget'
import { createDefaultModelRecipe, MODEL_MATERIAL_PRESETS } from './createModelArtifact'
const fixture = (name: string) => readFile(resolve('src/features/models/__tests__/fixtures', name))
const svg = async (name: string) => (await fixture(name)).toString('utf8')

describe('model image preparation and SVG safety', () => {
  it('sniffs actual PNG/SVG bytes and rejects forged or oversized dimensions', async () => {
    expect(sniffModelImage(await fixture('alpha-donut.png'))).toEqual({ mime: 'image/png', width: 32, height: 32 })
    expect(sniffModelImage(await fixture('donut.svg')).mime).toBe('image/svg+xml')
    expect(() => sniffModelImage(new Uint8Array([0, 1, 2, 3]))).toThrow()
    expect(() => checkDimensions(100_000, 100_000)).toThrow()
    expect(() => checkDimensions(4096, 4096)).toThrow()
  })
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://example.com/x)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY foo SYSTEM "file:///etc/passwd">]><svg/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="#x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1e100 0L1 1Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1" stroke="black"/></svg>',
  ])('blocks unsafe or unsupported SVG %#', value => expect(() => sanitizeModelSvg(value)).toThrow())
  it('blocks malformed and giant SVG and retains the supported transformed fill subset', async () => {
    expect(() => sanitizeModelSvg('<svg>' + ' '.repeat(1024 * 1024))).toThrow()
    expect(() => sanitizeModelSvg('<svg xmlns="http://www.w3.org/2000/svg"><path')).toThrow()
    expect(sanitizeModelSvg(await svg('islands.svg'))).toContain('translate(5 5)')
  })
  it('uses alpha for transparent holes and previewable luminance for prepared opaque pixels', () => {
    const recipe = createDefaultModelRecipe()
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 0])
    expect(createForegroundMask(data, recipe)).toMatchObject({ coverage: 0.5, opaque: false })
    recipe.foreground.mode = 'luminance'
    expect(createForegroundMask(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), recipe)).toMatchObject({ coverage: 0.5, opaque: true })
  })
})

describe('actual VTracer WASM', () => {
  it('traces committed transparent PNG pixels and preserves the internal cutout', async () => {
    const traced = convertBuffer(await fixture('alpha-donut.png'), { clustering: 'bw', mode: 'polygon', filterSpeckle: 1 })
    expect(traced).toContain('<path')
    const model = createExtrudedModel(traced, createDefaultModelRecipe())
    expect(new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1)).intersectObject(model.group, true)).toHaveLength(0)
    expect(new Raycaster(new Vector3(0.8, 0, 10), new Vector3(0, 0, -1)).intersectObject(model.group, true).length).toBeGreaterThan(0)
    model.dispose()
  })
  it('produces identical output using the browser-adapted WASM and official Node wrapper', async () => {
    await initialize(await readFile(resolve('src/features/models/trace/vendor/vtracer.wasm')))
    const pixels = new Uint8Array(16 * 16 * 4).fill(255)
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) { const i = (y * 16 + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0 }
    const options = { clustering: 'bw' as const, mode: 'polygon' as const, filterSpeckle: 1, binaryThreshold: 128, cornerThreshold: 60, lengthThreshold: 3.5, maxIterations: 10, spliceThreshold: 45, pathPrecision: 3 }
    expect(vectorize_rgba(pixels, 16, 16, options)).toBe(convertPixels(pixels, 16, 16, options))
  })
})

describe('actual extruded geometry and material controls', () => {
  it('keeps a donut hole open and front orientation correct', async () => {
    const model = createExtrudedModel(await svg('donut.svg'), createDefaultModelRecipe())
    expect(model.stats.triangles).toBeGreaterThan(0)
    expect(new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1)).intersectObject(model.group, true)).toHaveLength(0)
    expect(new Raycaster(new Vector3(0.8, 0, 10), new Vector3(0, 0, -1)).intersectObject(model.group, true).length).toBeGreaterThan(0)
    model.dispose()
  })
  it('preserves separated components and non-square aspect after transforms', async () => {
    const model = createExtrudedModel(await svg('islands.svg'), createDefaultModelRecipe())
    expect(model.group.children).toHaveLength(2)
    const size = new Box3().setFromObject(model.group).getSize(new Vector3())
    expect(size.x / size.y).toBeGreaterThan(2)
    model.dispose()
  })
  it('makes depth, bevel, pivot, scale and material changes effective', async () => {
    const recipe = createDefaultModelRecipe(); recipe.geometry.depth = 0.8; recipe.transform.pivot = 'bottom'; recipe.transform.scale = [2, 1, 1]
    recipe.materials[0] = { region: 'front', ...MODEL_MATERIAL_PRESETS.Gold, emissive: '#223344', emissiveIntensity: 2, clearcoat: 0.8, clearcoatRoughness: 0.2, opacity: 0.75 }
    const model = createExtrudedModel(await svg('solid.svg'), recipe)
    const size = new Box3().setFromObject(model.group).getSize(new Vector3())
    expect(size.z).toBeGreaterThanOrEqual(0.8)
    expect(model.stats.bounds.min[1]).toBeCloseTo(0)
    const mesh = model.group.children[0] as Mesh<BufferGeometry, MeshPhysicalMaterial[]>
    expect(mesh.material[0].metalness).toBe(1)
    expect(mesh.material[0].color.getHexString()).toBe('e7b64c')
    expect(mesh.material[0]).toMatchObject({ emissiveIntensity: 2, clearcoat: 0.8, clearcoatRoughness: 0.2, opacity: 0.75, transparent: true })
    expect(mesh.material[0].emissive.getHexString()).toBe('223344')
    expect(mesh.material[1].name).toBe('side')
    expect(model.materialCount).toBe(2)
    expect(model.dimensions).toEqual(size.toArray())
    expect(mesh.geometry.groups.some(g => g.materialIndex === 1)).toBe(true)
    model.dispose()
  })
  it('has deterministic normalized geometry and bounds for equivalent source and recipe', async () => {
    const input = await svg('donut.svg'), recipe = createDefaultModelRecipe()
    const a = createExtrudedModel(input, recipe), b = createExtrudedModel(input, recipe)
    expect(a.stats).toEqual(b.stats)
    expect(Array.from((a.group.children[0] as Mesh).geometry.attributes.position.array)).toEqual(Array.from((b.group.children[0] as Mesh).geometry.attributes.position.array))
    expect(recipe).toEqual(createDefaultModelRecipe())
    a.dispose(); b.dispose()
  })
  it('caps quality complexity, clamps unsafe bevel and rejects overlapping fills', () => {
    const circle = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
    const recipe = createDefaultModelRecipe(); recipe.geometry.curveSegments = 64; recipe.geometry.bevelSegments = 16; recipe.geometry.bevelSize = 10
    const draft = createExtrudedModel(circle, recipe, 'draft'), high = createExtrudedModel(circle, recipe, 'high')
    expect(draft.stats.triangles).toBeLessThan(high.stats.triangles)
    expect(draft.stats.triangles).toBeLessThanOrEqual(MODEL_QUALITY.draft.triangles)
    expect(high.recipe.quality).toBe('high')
    expect(high.recipe.geometry.bevelSize).toBeLessThan(recipe.geometry.bevelSize)
    expect(high.warnings.some(w => w.code === 'bevel_clamped')).toBe(true)
    expect(() => createExtrudedModel('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/><rect x="10" y="10" width="20" height="20"/></svg>', recipe)).toThrow(/overlapping/)
    expect(() => createExtrudedModel('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L100 80L0 80L100 0L50 100Z"/></svg>', recipe)).toThrow()
    draft.dispose(); high.dispose()
  })
  it('rejects empty input/cancellation and disposes generated resources once', async () => {
    const source = await svg('solid.svg')
    expect(() => createExtrudedModel('<svg xmlns="http://www.w3.org/2000/svg"/>', createDefaultModelRecipe())).toThrow()
    const controller = new AbortController(); controller.abort()
    expect(() => createExtrudedModel(source, createDefaultModelRecipe(), 'normal', controller.signal)).toThrow(/cancelled/)
    const model = createExtrudedModel(source, createDefaultModelRecipe())
    const geometry = (model.group.children[0] as Mesh).geometry, dispose = vi.spyOn(geometry, 'dispose')
    model.dispose(); model.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(model.group.children).toHaveLength(0)
  })
})

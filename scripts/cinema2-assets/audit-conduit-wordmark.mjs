#!/usr/bin/env node
// Front-on, unlit, native-SVG-resolution comparison of the shipped CONDUIT GLB and the owner's master paths.
import { createHash } from 'node:crypto'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { contoursOf, contoursOfAdaptive, pathData } from './cinema2-svg-relief-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const assertMatch = process.argv.includes('--assert')
const masterSha256 = '0ac33e757c07ed5e13b04b72d8c5f90403628531adb4632973729fd05df566f9'
const masterPath = resolve(option('master') ?? join(root, 'scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg'))
const modelPath = resolve(option('model') ?? join(root, 'public/cinema2/models/conduit-wordmark.glb'))
const artifactRoot = join(root, 'artifacts/cinema2-conduit-wordmark-audit')
const bodyIds = ['left-primary-body', 'central-interlock-body', 'left-inner-body', 'right-primary-body', 'right-interlock-and-sweep', 'left-lower-sweep', 'center-lower-sweep', 'four-point-symbol']
const ringId = 'outer-outline-ring'
const svg = await readFile(masterPath, 'utf8')
const svgHash = createHash('sha256').update(svg).digest('hex')
const pathIds = [ringId, ...bodyIds]
const paths = Object.fromEntries(pathIds.map(id => [id, pathData(svg, id)]))
const layout = JSON.parse(await readFile(join(root, 'scripts/cinema2-assets/conduit-layout.json'), 'utf8'))
const sampledContours = Object.fromEntries(pathIds.map(id => [id, layout.curveMaxErrorSvg
  ? contoursOfAdaptive(paths[id], layout.curveMaxErrorSvg)
  : contoursOf(paths[id], id === ringId ? 8 : 9)]))
const sourceBounds = (() => {
  const rings = sampledContours[ringId]
  const bodies = bodyIds.flatMap(id => sampledContours[id])
  const points = [...rings, ...bodies].flat()
  return {
    minX: Math.min(...points.map(point => point[0])), maxX: Math.max(...points.map(point => point[0])),
    minY: Math.min(...points.map(point => point[1])), maxY: Math.max(...points.map(point => point[1])),
  }
})()
const bounds = layout.sourceBounds ?? sourceBounds
const worldScale = layout.wordmark.width / (bounds.maxX - bounds.minX)
const centreX = (bounds.minX + bounds.maxX) / 2
const centreY = (bounds.minY + bounds.maxY) / 2

function readGlbMeshes(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a binary glTF file.')
  const jsonSize = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonSize).toString())
  const binaryOffset = 20 + jsonSize + 8
  const accessorArray = id => {
    const accessor = gltf.accessors[id]
    const view = gltf.bufferViews[accessor.bufferView]
    if (view.byteStride) throw new Error('Interleaved accessors are not supported by this audit.')
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const components = accessor.type === 'VEC3' ? 3 : accessor.type === 'SCALAR' ? 1 : 0
    if (!components) throw new Error(`Unsupported accessor type ${accessor.type}.`)
    const count = accessor.count * components
    if (accessor.componentType === 5126) return Array.from({ length: count }, (_, i) => buffer.readFloatLE(start + i * 4))
    if (accessor.componentType === 5125) return Array.from({ length: count }, (_, i) => buffer.readUInt32LE(start + i * 4))
    if (accessor.componentType === 5123) return Array.from({ length: count }, (_, i) => buffer.readUInt16LE(start + i * 2))
    throw new Error(`Unsupported component type ${accessor.componentType}.`)
  }
  return Object.fromEntries(gltf.meshes.map(mesh => {
    if (mesh.primitives.length !== 1) throw new Error(`${mesh.name}: expected one primitive.`)
    const primitive = mesh.primitives[0]
    return [mesh.name, { positions: accessorArray(primitive.attributes.POSITION), indices: accessorArray(primitive.indices) }]
  }))
}

const meshes = readGlbMeshes(await readFile(modelPath))
for (const name of ['letters', 'walls-letters', 'outline', 'walls-frame']) if (!meshes[name]) throw new Error(`Missing ${name} mesh.`)
await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 2006, height: 585 }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><html><body style="margin:0;background:#111"></body></html>')
  const result = await page.evaluate(({ paths, sampledContours, pathIds, bodyIds, ringId, meshes, transform }) => {
    const width = 2006, height = 585
    const canvas = () => { const element = globalThis.document.createElement('canvas'); element.width = width; element.height = height; return element }
    const master = (ids, evenodd = false) => {
      const element = canvas(), context = element.getContext('2d', { willReadFrequently: true })
      context.fillStyle = '#fff'
      for (const id of ids) context.fill(new globalThis.Path2D(paths[id]), evenodd ? 'evenodd' : 'nonzero')
      return element
    }
    const polyline = (ids, evenodd = false) => {
      const element = canvas(), context = element.getContext('2d', { willReadFrequently: true })
      context.fillStyle = '#fff'
      for (const id of ids) {
        const shape = new globalThis.Path2D()
        for (const contour of sampledContours[id]) {
          shape.moveTo(contour[0][0], contour[0][1])
          for (let i = 1; i < contour.length; i += 1) shape.lineTo(contour[i][0], contour[i][1])
          shape.closePath()
        }
        context.fill(shape, evenodd ? 'evenodd' : 'nonzero')
      }
      return element
    }
    const project = (x, y) => [x / transform.scale + transform.centreX, (transform.worldCentreY - y) / transform.scale + transform.centreY]
    const projected = (names, frontOnly = false) => {
      const element = canvas(), context = element.getContext('2d', { willReadFrequently: true })
      context.fillStyle = '#fff'
      for (const name of names) {
        const { positions, indices } = meshes[name]
        const shape = new globalThis.Path2D()
        for (let i = 0; i < indices.length; i += 3) {
          const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3
          const p = project(positions[a], positions[a + 1])
          const q = project(positions[b], positions[b + 1])
          const r = project(positions[c], positions[c + 1])
          // A thin glow slab has coincident front/back silhouettes with opposite winding;
          // drawing both in one Path2D would cancel under the nonzero fill rule.
          if (frontOnly && (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) >= 0) continue
          shape.moveTo(p[0], p[1]); shape.lineTo(q[0], q[1]); shape.lineTo(r[0], r[1]); shape.closePath()
        }
        context.fill(shape)
      }
      return element
    }
    const pixels = element => element.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data
    const compare = (source, model) => {
      const a = pixels(source), b = pixels(model)
      let both = 0, sourceOnly = 0, modelOnly = 0
      const overlay = canvas(), output = overlay.getContext('2d').createImageData(width, height)
      for (let i = 0; i < a.length; i += 4) {
        const inSource = a[i + 3] >= 128, inModel = b[i + 3] >= 128
        if (inSource && inModel) { both += 1; output.data.set([220, 220, 220, 255], i) }
        else if (inSource) { sourceOnly += 1; output.data.set([255, 64, 174, 255], i) }
        else if (inModel) { modelOnly += 1; output.data.set([45, 230, 255, 255], i) }
        else output.data.set([15, 15, 18, 255], i)
      }
      overlay.getContext('2d').putImageData(output, 0, 0)
      return {
        metrics: { both, sourceOnly, modelOnly, union: both + sourceOnly + modelOnly, iou: Number((both / (both + sourceOnly + modelOnly)).toFixed(6)) },
        png: overlay.toDataURL('image/png').split(',')[1],
      }
    }
    const sourceBody = master(bodyIds)
    const sourceRing = master([ringId], true)
    const sampledBody = polyline(bodyIds)
    const face = projected(['letters'])
    const body = projected(['letters', 'walls-letters'])
    const ring = projected(['outline', 'walls-frame'])
    const rim = projected(['rim'], true)
    return {
      body: compare(sourceBody, body), face: compare(sourceBody, face), ring: compare(sourceRing, ring),
      sampling: Object.fromEntries(pathIds.map(id => [id, compare(master([id], id === ringId), polyline([id], id === ringId)).metrics])),
      samplingBody: compare(sourceBody, sampledBody),
      sourceBodyPng: sourceBody.toDataURL('image/png').split(',')[1],
      projectedBodyPng: body.toDataURL('image/png').split(',')[1],
      rimPng: rim.toDataURL('image/png').split(',')[1],
    }
  }, { paths, sampledContours, pathIds, bodyIds, ringId, meshes: Object.fromEntries(['letters', 'walls-letters', 'outline', 'walls-frame', 'rim'].map(name => [name, meshes[name]])), transform: { scale: worldScale, centreX, centreY, worldCentreY: layout.wordmark.centre[1] } })
  for (const [name, png] of Object.entries({
    'master-body.png': result.sourceBodyPng,
    'model-body.png': result.projectedBodyPng,
    'body-overlay.png': result.body.png,
    'face-overlay.png': result.face.png,
    'outline-overlay.png': result.ring.png,
    'sampling-overlay.png': result.samplingBody.png,
    'rim-mask.png': result.rimPng,
  })) await writeFile(join(output, name), Buffer.from(png, 'base64'))
  const metrics = {
    schemaVersion: 1, masterPath, modelPath, masterSha256: svgHash, nativeResolution: [2006, 585],
    sourceBounds: bounds, worldScale, body: result.body.metrics, face: result.face.metrics, outline: result.ring.metrics,
    samplingBody: result.samplingBody.metrics, samplingByPath: result.sampling,
  }
  await writeFile(join(output, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`)
  await writeFile(join(output, 'index.md'), `# CONDUIT wordmark native-resolution geometry audit\n\nMaster SHA-256: \`${svgHash}\`. Unlit front-on orthographic projection; no lighting, bloom, perspective, shadows, or glow. Magenta = master only; cyan = model only; gray = overlap.\n\n| Layer | Intersection over union | Master-only pixels | Model-only pixels | Overlay |\n| --- | ---: | ---: | ---: | --- |\n| Full body silhouette (including sidewall bevel) | ${result.body.metrics.iou} | ${result.body.metrics.sourceOnly} | ${result.body.metrics.modelOnly} | [view](body-overlay.png) |\n| White front faces/bevel only | ${result.face.metrics.iou} | ${result.face.metrics.sourceOnly} | ${result.face.metrics.modelOnly} | [view](face-overlay.png) |\n| SVG outline ring vs frame | ${result.ring.metrics.iou} | ${result.ring.metrics.sourceOnly} | ${result.ring.metrics.modelOnly} | [view](outline-overlay.png) |\n| Sampled Bézier polylines vs SVG body paths | ${result.samplingBody.metrics.iou} | ${result.samplingBody.metrics.sourceOnly} | ${result.samplingBody.metrics.modelOnly} | [view](sampling-overlay.png) |\n\n[Master body](master-body.png) · [Model body](model-body.png) · [Rim footprint](rim-mask.png) · [raw metrics](metrics.json). The rim footprint is a geometry diagnostic, not the emitted-light footprint after bloom. The white-face mask is expected to be inset by its bevel; it must not be mistaken for a source contour change. Per-path sampling metrics are in the JSON.\n`)
  console.log(JSON.stringify({ output: relative(root, output), body: result.body.metrics, face: result.face.metrics, outline: result.ring.metrics, samplingBody: result.samplingBody.metrics, samplingByPath: result.sampling }, null, 2))
  if (assertMatch) {
    const failures = [
      svgHash === masterSha256 || 'The SVG source no longer matches the approved master SHA-256.',
      result.body.metrics.iou >= 0.995 || 'Projected body silhouette fell below 0.995 IoU.',
      result.face.metrics.iou >= 0.99 || 'White front-face silhouette fell below 0.99 IoU.',
      result.ring.metrics.iou >= 0.98 || 'Outline ring fell below 0.98 IoU.',
      result.samplingBody.metrics.iou >= 0.996 || 'Sampled body curves fell below 0.996 IoU.',
      ...bodyIds.map(id => result.sampling[id].iou >= 0.996 || `${id} curve sampling fell below 0.996 IoU.`),
    ].filter(value => value !== true)
    if (failures.length > 0) throw new Error(failures.join('\n'))
    console.log('Master hash and native-resolution silhouette thresholds passed.')
  }
} finally {
  await browser.close()
}

import { MODEL_INPUT_LIMITS, ModelGenerationError } from '../geometry/modelQualityBudget'
const NS = 'http://www.w3.org/2000/svg'
const tags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'title', 'desc'])
const attrs = new Set(['xmlns', 'version', 'viewBox', 'width', 'height', 'x', 'y', 'rx', 'ry', 'r', 'cx', 'cy', 'd', 'points', 'transform', 'fill', 'fill-rule', 'fill-opacity', 'opacity', 'display', 'visibility', 'stroke', 'stroke-width'])
const styleAttrs = new Set(['fill', 'fill-rule', 'fill-opacity', 'opacity', 'display', 'visibility', 'stroke', 'stroke-width'])
function fail(message: string): never { throw new ModelGenerationError('unsafe_svg', message) }

/** Strict filled-vector subset. Unsupported visual features fail instead of silently changing the silhouette. */
export function sanitizeModelSvg(source: string): string {
  if (new TextEncoder().encode(source).length > MODEL_INPUT_LIMITS.svgBytes) fail('SVG exceeds the 1 MiB input budget.')
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|url\s*\(|javascript:|data:/i.test(source)) fail('SVG contains unsafe resources or declarations.')
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg' || doc.documentElement.namespaceURI !== NS) fail('Invalid SVG document.')
  const elements = [doc.documentElement, ...doc.documentElement.querySelectorAll('*')]
  if (elements.length > MODEL_INPUT_LIMITS.paths * 4) fail('SVG has too many elements.')
  let commands = 0
  for (const node of elements) {
    if (node.namespaceURI !== NS || !tags.has(node.localName) || (node.localName === 'svg' && node !== doc.documentElement)) fail(`Unsupported SVG element: ${node.localName}. Convert it to filled paths first.`)
    if (node.localName === 'title' || node.localName === 'desc') { node.remove(); continue }
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || /href|src/i.test(attr.name) || attr.namespaceURI && attr.name !== 'xmlns') fail('SVG event handlers and references are forbidden.')
      if (attr.name === 'style') {
        for (const declaration of attr.value.split(';').filter(v => v.trim())) {
          const [key, ...parts] = declaration.split(':'); const value = parts.join(':').trim()
          if (!styleAttrs.has(key.trim()) || !value) fail('Unsupported SVG style. Convert it to filled paths first.')
          node.setAttribute(key.trim(), value)
        }
        node.removeAttribute('style')
      } else if (!attrs.has(attr.name)) {
        if (['id', 'class'].includes(attr.name) || attr.name.startsWith('data-') || attr.name.startsWith('aria-')) node.removeAttribute(attr.name)
        else fail(`Unsupported SVG attribute: ${attr.name}.`)
      }
    }
    for (const name of ['fill', 'stroke']) {
      const paint = node.getAttribute(name)
      if (paint && !/^(?:none|#[0-9a-f]{3,8}|[a-z]+|rgb\([\d.,%\s]+\))$/i.test(paint)) fail('Unsupported SVG paint.')
    }
    if (node.getAttribute('stroke') && node.getAttribute('stroke') !== 'none') fail('Convert SVG strokes to filled outlines before generating a model.')
    if (node.getAttribute('fill-rule') && !['nonzero', 'evenodd'].includes(node.getAttribute('fill-rule')!)) fail('Unsupported SVG fill rule.')
    for (const attr of [...node.attributes]) {
      if (/\b(?:NaN|Infinity)\b/i.test(attr.value)) fail('Non-finite SVG coordinate.')
      if (['d', 'points', 'transform', 'viewBox', 'x', 'y', 'width', 'height', 'rx', 'ry', 'r', 'cx', 'cy'].includes(attr.name)) {
        const nums = attr.value.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) ?? []
        if (nums.some(n => !Number.isFinite(Number(n)) || Math.abs(Number(n)) > 1e6)) fail('SVG coordinates exceed the model budget.')
        commands += nums.length + (attr.name === 'd' ? (attr.value.match(/[MmLlHhVvCcSsQqTtAaZz]/g)?.length ?? 0) : 0)
        if (attr.name === 'transform' && !/^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\d.eE+,\s-]+\)\s*)+$/.test(attr.value)) fail('Invalid SVG transform.')
      }
    }
  }
  if (commands > MODEL_INPUT_LIMITS.commands) fail('SVG path complexity exceeds the model budget.')
  const viewBox = doc.documentElement.getAttribute('viewBox')
  if (viewBox) {
    const values = viewBox.trim().split(/[\s,]+/).map(Number)
    if (values.length !== 4 || values.some(v => !Number.isFinite(v)) || values[2] <= 0 || values[3] <= 0) fail('Invalid SVG viewBox.')
  }
  if (elements.filter(n => ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'].includes(n.localName)).length > MODEL_INPUT_LIMITS.paths) fail('SVG has too many paths.')
  return new XMLSerializer().serializeToString(doc.documentElement)
}

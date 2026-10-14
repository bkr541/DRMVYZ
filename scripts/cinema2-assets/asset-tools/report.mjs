// Human-readable asset report (Markdown) from an inspection, a validator result and, optionally, an optimization run.
import { DEFAULT_BUDGETS } from '../assets-core.mjs'

const mb = bytes => `${(bytes / 1048576).toFixed(2)} MB`
const num = value => Number(value).toLocaleString('en-US')
const row = cells => `| ${cells.join(' | ')} |`
const table = (headers, rows) => [row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n')
const icon = severity => ({ error: 'ERROR', warning: 'warning', info: 'info', hint: 'hint' }[severity] ?? severity)

export function renderAssetReport({ inspection, validation, optimization }) {
  const lines = []
  const verdict = inspection.ok && (!validation || validation.numErrors === 0) ? 'PASS' : 'FAIL'
  lines.push(`# Asset report: ${inspection.name ?? 'model'}`, '')
  lines.push(`**Result: ${verdict}**${inspection.fileBytes ? ` · ${mb(inspection.fileBytes)} on disk` : ''} · ${inspection.container?.toUpperCase() ?? 'glTF'}${inspection.generator ? ` · generator: ${inspection.generator}` : ''}`, '')

  lines.push('## Summary', '')
  lines.push(table(['Measure', 'Value'], [
    ['Triangles', `${num(inspection.geometry.triangles)} (limit ${num(DEFAULT_BUDGETS.maxTrianglesPerAsset)})`],
    ['Vertices', num(inspection.geometry.vertices)],
    ['Meshes / primitives (draw calls)', `${inspection.counts.meshes} / ${inspection.counts.primitives}`],
    ['Materials / textures', `${inspection.counts.materials} / ${inspection.counts.textures}`],
    ['Nodes', inspection.counts.nodes],
    ['Animations / skins', `${inspection.counts.animations} / ${inspection.counts.skins}`],
    ['Geometry compression', inspection.geometry.compression],
    ['Texture formats', inspection.textures.formats.join(', ') || 'none'],
    ['Custom vertex attributes', inspection.geometry.customAttributes.join(', ') || 'none'],
    ['Estimated geometry memory', mb(inspection.memory.geometryBytes)],
    ['Estimated texture memory (with mips)', mb(inspection.memory.textureBytes)],
    ['Estimated GPU memory', `${mb(inspection.memory.totalBytes)} (asset budgets: low ${mb(DEFAULT_BUDGETS.assetGpuBytes.low)}, medium ${mb(DEFAULT_BUDGETS.assetGpuBytes.medium)}, high ${mb(DEFAULT_BUDGETS.assetGpuBytes.high)})`],
  ]), '')

  lines.push('## Extensions', '')
  lines.push(`Used: ${inspection.extensions.used.join(', ') || 'none'}`, '', `Required: ${inspection.extensions.required.join(', ') || 'none'}`, '')

  if (inspection.meshes.length > 0) {
    lines.push('## Meshes (largest first)', '')
    lines.push(table(['Mesh', 'Primitives', 'Triangles', 'Materials', 'Custom attributes', 'Morph targets'],
      [...inspection.meshes].sort((a, b) => b.triangles - a.triangles).slice(0, 25).map(mesh => [mesh.name || '(unnamed)', mesh.primitives, num(mesh.triangles), mesh.materials.join(', ') || '-', mesh.customAttributes.join(', ') || '-', mesh.morphTargets])), '')
  }
  if (inspection.materials.length > 0) {
    lines.push('## Materials', '')
    lines.push(table(['Material', 'Alpha', 'Metal / rough', 'Emissive', 'Textures', 'Extensions'],
      inspection.materials.slice(0, 40).map(material => [material.name || '(unnamed)', material.alphaMode, `${material.metallic.toFixed(2)} / ${material.roughness.toFixed(2)}`, material.emissive ? 'yes' : 'no', material.textureSlots.join(', ') || '-', material.extensions.join(', ') || '-'])), '')
  }
  if (inspection.textures.items.length > 0) {
    lines.push('## Textures', '')
    lines.push(table(['Texture', 'Size', 'Format', 'File', 'GPU (est.)', 'Used as'],
      inspection.textures.items.map(texture => [texture.name, texture.width ? `${texture.width}x${texture.height}` : '?', texture.mime ?? '?', mb(texture.fileBytes), mb(texture.gpuBytes), texture.slots.join(', ') || '-'])), '')
  }
  if (inspection.animations.length > 0) {
    lines.push('## Animation', '')
    lines.push(table(['Clip', 'Duration', 'Channels', 'Animates', 'Targets'],
      inspection.animations.map(clip => [clip.name || '(unnamed)', `${clip.duration.toFixed(2)} s`, clip.channels, clip.paths.join(', '), clip.targets.slice(0, 6).join(', ') + (clip.targets.length > 6 ? ', ...' : '')])), '')
  }

  const problems = [...inspection.issues, ...(validation?.issues ?? []).filter(entry => entry.severity === 'error' || entry.severity === 'warning').slice(0, 60)]
  lines.push('## Problems', '')
  lines.push(problems.length === 0 ? 'None.' : problems.map(entry => `- **${icon(entry.severity)}** \`${entry.code}\`: ${entry.message}${entry.pointer ? ` (${entry.pointer})` : ''}`).join('\n'), '')
  if (validation) {
    lines.push('## Khronos glTF Validator', '')
    lines.push(`Validator ${validation.validatorVersion}: ${validation.numErrors} error(s), ${validation.numWarnings} warning(s), ${validation.numInfos} info, ${validation.numHints} hint(s)${validation.truncated ? ' (output truncated)' : ''}.`, '')
  }

  if (optimization) {
    lines.push('## Optimization', '')
    lines.push(`Geometry: ${optimization.geometry}; textures: ${optimization.textures}; simplify: ${optimization.simplify ? 'on' : 'off'}.`, '')
    lines.push(table(['Tier', 'Result', 'File', 'Triangles', 'GPU (est.)', 'Notes'], optimization.tiers.map(tier => [
      tier.tier, tier.ok ? 'kept everything' : 'FAILED', tier.file ? `${tier.file} (${mb(tier.fileBytes)})` : '(not written)', num(tier.triangles), mb(tier.gpuBytes), tier.notes.join('; ') || '-',
    ])), '')
    for (const tier of optimization.tiers) {
      if (tier.failures.length > 0) lines.push(`**${tier.tier} failed the safeguards:**`, ...tier.failures.map(message => `- ${message}`), '')
    }
    lines.push('Source models are never modified. To ship an output: copy the GLBs to `public/cinema2/models/`, copy `asset.draft.json` to `assets/cinema2/<id>/asset.json`, set its license, attribution and origin, then run `npm run assets:build && npm run assets:check`.', '')
  }
  return `${lines.join('\n')}\n`
}

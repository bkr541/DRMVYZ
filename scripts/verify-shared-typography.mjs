import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const componentStyles = [
  'src/components/shared/Dropdown/Dropdown.css',
  'src/components/vyzualz/react/controls/canonicalControls.css',
  'src/components/vyzualz/react/DualRailCollapsible.css',
  'src/components/vyzualz/layout/RailWindowHeader.css',
]
const workspaceStyles = [
  'src/styles.css', 'src/styles/analyzer.css', 'src/styles/vyzualz.css',
  'src/styles/reactView.css', 'src/styles/mediaManager.css',
  'src/styles/presetManager.css', 'src/styles/lyricManager.css',
  'src/styles/showManager.css', 'src/styles/mediaUploadModal.css', 'src/styles/appearance.css',
  'src/styles/floatingWorkspace.css', 'src/styles/tabRows.css',
]

const dropdown = size => `
  <div class="drm-dropdown drm-dropdown--${size} dv-underline-dropdown">
    <label class="drm-dropdown__label" data-type="label">Category</label>
    <span class="drm-dropdown__eyebrow" data-type="label">Category</span>
    <button class="drm-dropdown__trigger">
      <span class="drm-dropdown__value" data-type="value">Cinematic</span>
    </button>
    <span class="drm-dropdown__value drm-dropdown__value--placeholder" data-type="placeholder">Choose category</span>
    <input class="drm-dropdown__search-input dv-text-input" data-type="value" placeholder="Search collections">
  </div>`
const controls = `
  <label class="rv-ctrl-label" data-type="label">Name</label>
  <label class="dv-scrub-field-label" data-type="label">Amount</label>
  <input class="dv-text-input rv-ctrl-text-input" data-type="value" value="BLOCKSHIFT">
  <input class="dv-text-input rv-ctrl-text-input" data-type="value" value="SYSTEM" readonly>
  <input class="dv-text-input" data-type="value" disabled value="Unavailable">
  <input class="dv-text-input" data-type="value" type="number" value="120">
  <input class="dv-text-input mmi-chip-input" data-type="value" placeholder="Type to add tags">
  <textarea class="dv-text-input rv-ctrl-textarea" data-type="value">Preset description</textarea>
  <select class="rv-ctrl-select" data-type="value"><option>Auto</option></select>
  <span class="rv-ctrl-val" data-type="value">0.75</span>
  <span class="dv-scrub-value" data-type="value">120</span>
  <input class="dv-scrub-edit-input" data-type="value" value="120">
  <output class="rv-ctrl-color-value" data-type="value">#4AC7DB</output>
  <div class="dv-underline-tabs"><button class="dv-underline-tab" data-type="tab">INFO</button></div>
  <div class="vz-panel-tabs"><button data-type="tab">DESIGN</button></div>
  <div class="rv-right-subtabs"><button data-type="tab">ENGINE</button></div>
  <button class="dv-icon-chip" data-type="tab">Import</button>
  <div class="drc-group">
    <button class="drc-header" data-type="group">Master Controls</button>
    <div class="drc-body"><input class="dv-text-input" data-type="value" value="1.00"></div>
  </div>
  <div class="drc-group">
    <button class="drc-header" data-type="group">Design</button>
    <div class="drc-body"><div class="layout-wrapper">
      <div class="drc-group">
        <button class="drc-header" data-type="nestedGroup">Pattern</button>
        <div class="drc-body"><div class="drc-group">
          <button class="drc-header" data-type="nestedGroup">Pattern Detail</button>
        </div></div>
      </div>
      <div class="drc-group"><button class="drc-header" data-type="nestedGroup">Blocks</button></div>
      <div class="drc-group"><button class="drc-header" data-type="nestedGroup">Motion</button></div>
    </div></div>
  </div>
  <div class="rw-window-header" data-type="window">Inspector</div>
  ${['default', 'compact', 'dense', 'large'].map(dropdown).join('')}`
const roles = {
  label: ['Manrope', '11px', '600'],
  value: ['Manrope', '13px', '700'],
  placeholder: ['Manrope', '13px', '700'],
  tab: ['Manrope', '11px', '700'],
  group: ['Space Grotesk', '15px', '800'],
  nestedGroup: ['Space Grotesk', '11px', '800'],
  window: ['Space Grotesk', '12px', '700'],
}
const workspaces = ['pmv-root pmv-info-panel', 'mmv-root mmi-body', 'lmv-root lmv-inspector', 'rv-shell rv-inspector', 'sm-root sm-inspector', 'bk-settings bk-editor', 'vsm-modal mum-collections-dropdown']
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent(`<html data-theme="dark"><head><style>${[...workspaceStyles, ...componentStyles, 'src/styles/typography.css'].map(read).join('\n')}</style></head><body>
    ${workspaces.map(classes => `<section class="${classes}" data-workspace="${classes}">${controls}</section>`).join('')}
    <div class="drm-dropdown__menu drm-dropdown__menu--compact" data-workspace="portaled menu"><span class="drm-dropdown__option-label" data-type="value">Afterhours</span></div>
  </body></html>`)

  async function verify(phase) {
    const results = await page.locator('[data-type]').evaluateAll(nodes => nodes.map(node => {
      const style = globalThis.getComputedStyle(node)
      return {
        scope: node.closest('[data-workspace]').dataset.workspace,
        role: node.dataset.type,
        font: [style.fontFamily.split(',')[0].replaceAll('"', '').replaceAll("'", '').trim(), style.fontSize, style.fontWeight],
      }
    }))
    for (const result of results) assert.deepEqual(result.font, roles[result.role], `${phase}: ${result.scope} ${result.role}`)
    const placeholders = await page.locator('input[placeholder]').evaluateAll(nodes => nodes.map(node => {
      const style = globalThis.getComputedStyle(node, '::placeholder')
      return [style.fontFamily.split(',')[0].replaceAll('"', '').replaceAll("'", '').trim(), style.fontSize, style.fontWeight]
    }))
    for (const font of placeholders) assert.deepEqual(font, roles.placeholder, `${phase}: input placeholder`)
    return results.length + placeholders.length
  }

  const count = await verify('initial CSS')
  // Lazy imports must not restore old per-component sizes or weights.
  await page.addStyleTag({ content: [...componentStyles, ...workspaceStyles].map(read).join('\n') })
  await verify('late component/workspace CSS')
  await page.setViewportSize({ width: 420, height: 800 })
  await verify('narrow viewport')
  console.log(`Shared typography passed: ${count} rendered checks across seven workspace contexts and a portaled menu, including placeholders, control sizes, lazy CSS, and a narrow viewport.`)
} finally {
  await browser.close()
}

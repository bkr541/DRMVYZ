import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

const styles = ['src/styles.css', 'src/styles/analyzer.css', 'src/styles/vyzualz.css', 'src/styles/reactView.css', 'src/styles/mediaManager.css', 'src/styles/presetManager.css', 'src/styles/lyricManager.css', 'src/styles/showManager.css', 'src/styles/mediaUploadModal.css', 'src/styles/appearance.css', 'src/styles/floatingWorkspace.css', 'src/styles/tabRows.css', 'src/styles/groupSpacing.css', 'src/styles/typography.css']
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {DreamVizTextInput} from '/src/components/vyzualz/react/controls/DreamVizTextInput.tsx';
import {Dropdown, DropdownSelect} from '/src/components/shared/Dropdown/Dropdown.tsx';
import {UnderlineDropdown} from '/src/components/vyzualz/react/controls/UnderlineDropdown.tsx';
import {PresetSearchRow} from '/src/components/vyzualz/react/controls/PresetSearchRow.tsx';
import {TextInputRow, TextAreaRow, NumberInputRow} from '/src/components/vyzualz/react/ReactControlRows.tsx';
${styles.map(path => `import '/${path}';`).join('\n')}
const e=React.createElement, noop=()=>{};
const contexts=['pmv-root pmv-info-panel','mmv-root mmi-body','lmv-root lmv-inspector','rv-shell rv-inspector','sm-root sm-inspector','bk-settings bk-editor','vsm-modal mum-collections-dropdown'];
const options=[{value:'one',label:'BLOCKSHIFT'},{value:'two',label:'Afterhours'}];
function Controls(){return e(React.Fragment,null,
 e(TextInputRow,{label:'Name',value:'BLOCKSHIFT',onChange:noop}),
 e(TextInputRow,{label:'Read only',value:'SYSTEM',readOnly:true,onChange:noop}),
 e(TextAreaRow,{label:'Description',value:'Preset description',onChange:noop}),
 e(NumberInputRow,{label:'Number',value:120,onChange:noop}),
 e(DreamVizTextInput,{placeholder:'Type to add tags',className:'mmi-chip-input'}),
 e(DreamVizTextInput,{placeholder:'Search cues',type:'search'}),
 e(PresetSearchRow,{query:'',onQueryChange:noop}),
 ...['default','compact','dense','large'].flatMap(size=>[
 e(Dropdown,{key:size+'filled',size,options,value:'one',onChange:noop,ariaLabel:size+' filled'}),
 e(UnderlineDropdown,{key:size+'empty',size,options,value:null,onChange:noop,placeholder:'Choose preset',ariaLabel:size+' empty'}),
 e(Dropdown,{key:size+'search',size,options,value:null,searchable:true,placeholder:'Search collections',ariaLabel:size+' search',onChange:noop})
 ]),
 e(DropdownSelect,{options,value:'one',onChange:noop,ariaLabel:'Select adapter'})
)}
createRoot(document.getElementById('root')).render(e(React.Fragment,null,...contexts.map((context,index)=>e('section',{key:context,className:context,'data-context':index},e(Controls)))));
`
const server = await createServer({ configFile: false, plugins: [react(), {
  name: 'input-typography-review',
  resolveId(id) { if (id === 'virtual:input-typography-review') return '\0input-typography-review' },
  load(id) { if (id === '\0input-typography-review') return entry },
  configureServer(vite) {
    vite.middlewares.use('/__input-typography-review', async (_request, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(await vite.transformIndexHtml('/__input-typography-review', '<html data-theme="dark"><body><div id="root"></div><script type="module" src="/@id/virtual:input-typography-review"></script></body></html>'))
    })
  },
}], server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__input-typography-review`)
  await page.locator('[data-context="6"] input').first().waitFor({ state: 'attached' })
  // This is a typography fixture; suppress workspace page-positioning rules.
  await page.addStyleTag({ content: '[data-context]{position:relative!important;display:block!important;width:360px!important;height:auto!important;overflow:visible!important;margin:20px!important}.vsm-modal[data-context]{max-height:none!important}body,html,#root{height:auto!important;overflow:auto!important}' })
  async function verify(phase) {
    const values = await page.locator('[data-context] :is(.dv-text-input,.drm-dropdown__value,.dv-scrub-value),.drm-dropdown__option-label').evaluateAll(nodes => nodes.map(node => {
      const style = globalThis.getComputedStyle(node)
      const font = [style.fontFamily.split(',')[0].replaceAll('"', '').trim(), style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing]
      const placeholder = node.matches('input[placeholder],textarea[placeholder]') ? globalThis.getComputedStyle(node, '::placeholder') : null
      return { name: node.getAttribute('aria-label') ?? node.className, font, placeholder: placeholder ? [placeholder.fontFamily.split(',')[0].replaceAll('"', '').trim(), placeholder.fontSize, placeholder.fontWeight, placeholder.lineHeight, placeholder.letterSpacing] : null }
    }))
    assert(values.length > 100, 'Actual component fixture did not mount')
    for (const value of values) {
      assert.deepEqual(value.font, ['Manrope', '13px', '700', '15.6px', 'normal'], `${phase}: ${value.name}`)
      if (value.placeholder) assert.deepEqual([value.placeholder[0], value.placeholder[1], value.placeholder[2], value.placeholder[4]], [value.font[0], value.font[1], value.font[2], value.font[4]], `${phase}: placeholder ${value.name}`)
    }
    return values.length
  }
  const count = await verify('initial')
  // Exercise an actual portaled menu and selection through the real component.
  const trigger = page.locator('[data-context="0"] [aria-label="compact filled"]')
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('option').first().waitFor()
  await verify('portaled options')
  await page.getByRole('option').filter({ hasText: 'Afterhours' }).click()
  await page.addStyleTag({ content: styles.filter(path => !path.endsWith('typography.css')).map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n') })
  await verify('late styles')
  await page.setViewportSize({ width: 420, height: 900 })
  await verify('narrow')
  assert.deepEqual(errors, [])
  console.log(`Passed: ${count} actual rendered input/value elements across seven workspace contexts, including dropdown sizes, search, textareas, read-only fields, placeholders, real portaled options, late styles, and narrow viewport.`)
} finally {
  if (browser) await browser.close()
  await server.close()
}

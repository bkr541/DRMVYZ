import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const reactViewSource = readFileSync(new URL('../ReactView.tsx', import.meta.url), 'utf8')
const reactViewCss = readFileSync(new URL('../../../../styles/reactView.css', import.meta.url), 'utf8')

describe('React left-rail description density', () => {
  it('scopes compact description treatment to the left workspace only', () => {
    expect(reactViewSource).toContain(
      'className="rv-left-workspace-shell" data-description-density="compact"',
    )
    expect(reactViewSource).not.toContain(
      'className="vz-panel-body" data-description-density="compact"',
    )
  })

  it('removes shared and standalone helper copy from layout without hiding operational status classes', () => {
    expect(reactViewCss).toContain(
      ".rv-left-workspace-shell[data-description-density='compact'] .rv-ctrl-description",
    )
    expect(reactViewCss).toContain(
      ".rv-left-workspace-shell[data-description-density='compact'] .rv-control-helper-copy",
    )
    expect(reactViewCss).toContain('position: absolute !important;')
    expect(reactViewCss).toContain('clip: rect(0, 0, 0, 0) !important;')
    expect(reactViewCss).not.toContain(
      ".rv-left-workspace-shell[data-description-density='compact'] .rv-ctrl-info {",
    )
  })
})

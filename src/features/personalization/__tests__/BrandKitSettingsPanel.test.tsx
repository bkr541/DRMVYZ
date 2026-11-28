// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactPalette } from '../../../components/vyzualz/react/ReactTypes'
import { ReactPresetBrowser } from '../../../components/vyzualz/react/ReactPresetBrowser'
import { SettingsModal } from '../../../components/vyzualz/settings/SettingsModal'
import { useMediaStore } from '../../../stores/mediaStore'
import type { BrandKit } from '../BrandKitTypes'
import { useBrandKitStore } from '../brandKitStore'
import { BrandKitSettingsPanel } from '../components/BrandKitSettingsPanel'

vi.mock('../../../lib/profileDb', async importOriginal => {
  const original = await importOriginal<typeof import('../../../lib/profileDb')>()
  return {
    ...original,
    getProfile: vi.fn(async () => ({
      profile: { artist_name: 'DVYDRM', display_name: 'Kody' },
      error: null,
    })),
  }
})

const BRAND: ReactPalette = {
  primary: '#FF3366', secondary: '#20D6A7', accent: '#7C5CFF',
  background: '#05070A', highlight: '#FFE66D', text: '#F7FAFC',
}

function makeKit(): BrandKit {
  return {
    id: 'kit-a', userId: 'user-a', name: 'DVYDRM Brand Kit', palette: BRAND,
    extractedPalette: null, extractionMetadata: null, defaultStrength: 1,
    engineRules: { pixGrid: { mode: 'brand', strength: 1 } },
    presetRules: {}, useForAppAccent: true, autoApply: true,
    createdAt: '', updatedAt: '',
  }
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>
const originalBrandState = useBrandKitStore.getState()
const originalMediaState = useMediaStore.getState()

async function render(element: React.ReactNode) {
  await act(async () => root.render(element))
}

async function openGroup(label: string) {
  const header = [...container.querySelectorAll<HTMLButtonElement>('.drc-header')].find(button => button.textContent === label)!
  await act(async () => header.click())
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useBrandKitStore.setState(originalBrandState, true)
  useMediaStore.setState(originalMediaState, true)
  useMediaStore.setState({ items: [], loading: false, storageAvailable: false, authRequired: false })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useBrandKitStore.setState(originalBrandState, true)
  useMediaStore.setState(originalMediaState, true)
})

describe('Brand Kit Settings states and accessibility', () => {
  it('renders a loading state while cloud data is being refreshed', async () => {
    useBrandKitStore.setState({ currentUserId: 'user-a', kits: [], activeKit: null, loading: true, syncing: true, error: null })
    await render(<BrandKitSettingsPanel />)
    expect(container.textContent).toContain('Loading from cloud')
    expect(container.querySelector('#bk-first-name')).toBeNull()
  })

  it('renders empty-state onboarding with a labeled name field', async () => {
    useBrandKitStore.setState({ currentUserId: 'user-a', kits: [], activeKit: null, loading: false, syncing: false, error: null })
    await render(<BrandKitSettingsPanel />)
    expect(container.querySelector('.vsm-settings-group h2')?.textContent).toContain('Brand Kit')
    const label = [...container.querySelectorAll('label')].find(candidate => candidate.textContent === 'Brand Kit name') as HTMLLabelElement
    expect(label).toBeTruthy()
    expect(label.control).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('button')?.textContent).toContain('Create Brand Kit')
  })

  it('shows an active cached kit, textual status, accessible switches, and retry action', async () => {
    const kit = makeKit()
    const updateKit = vi.fn(async (_id: string, patch: Partial<BrandKit>) => ({ ...kit, ...patch }))
    useBrandKitStore.setState({
      currentUserId: 'user-a', kits: [kit], activeKit: kit, activeAssets: [], assetsByKitId: { [kit.id]: [] },
      loading: false, syncing: false, error: 'Cloud refresh failed', usingCachedActiveKit: true,
      updateKit, loadAssetsForKit: vi.fn(async () => []), refresh: vi.fn(async () => undefined), clearError: vi.fn(),
    })
    await render(<BrandKitSettingsPanel />)

    expect(container.textContent).toContain('Using cached Brand Kit')
    expect(container.textContent).toContain('Active kit')
    expect(container.textContent).toContain('Cloud refresh failed')
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Retry')).toBe(true)

    const switches = [...container.querySelectorAll<HTMLButtonElement>('button[role="switch"]')]
    expect(switches).toHaveLength(2)
    expect(document.getElementById(switches[0].getAttribute('aria-labelledby')!)?.textContent).toBe('Automatic visual personalization')
    expect(switches[0].getAttribute('aria-checked')).toBe('true')
    await act(async () => switches[0].click())
    expect(updateKit).toHaveBeenCalledWith(kit.id, { autoApply: false })

    expect(container.querySelector('label[for]')?.textContent).toBeTruthy()
    await openGroup('Engine personalization')
    expect(container.querySelector('.bk-engine-list .dv-underline-dropdown')).toBeTruthy()
    const triggerSemantics = [...container.querySelectorAll('label')].find(label => label.textContent?.includes('Preserve trigger semantics'))
    expect(triggerSemantics?.querySelector('input[type="checkbox"]')).toBeInstanceOf(HTMLInputElement)
    const displayAssetLabel = [...container.querySelectorAll('label')].find(label => label.textContent === 'Display asset') as HTMLLabelElement
    expect(displayAssetLabel.control?.id).toBe('bk-display-asset')
    expect(container.textContent).toContain('Personalization diagnostics')
  })

  it('opens a saved kit for editing and activates it only on request', async () => {
    const kits = Array.from({ length: 10 }, (_, index) => ({ ...makeKit(), id: `kit-${index}`, name: `Brand ${index + 1}` }))
    const updateKit = vi.fn(async (id: string, patch: Partial<BrandKit>) => ({ ...kits.find(kit => kit.id === id)!, ...patch }))
    const activateKit = vi.fn(async () => true)
    useBrandKitStore.setState({
      currentUserId: 'user-a', kits, activeKit: kits[0], activeAssets: [], assetsByKitId: {},
      loading: false, syncing: false, error: null, updateKit, activateKit, loadAssetsForKit: vi.fn(async () => []),
    })
    await render(<BrandKitSettingsPanel />)
    const selector = container.querySelector<HTMLButtonElement>('#bk-selected-kit')!
    await act(async () => selector.click())
    expect(document.body.querySelector('[placeholder="Search Brand Kits"]')).toBeTruthy()
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(row => row.textContent === 'Brand 10')!
    await act(async () => option.click())
    expect(container.querySelector<HTMLInputElement>('#bk-kit-name')?.value).toBe('Brand 10')
    expect(activateKit).not.toHaveBeenCalled()

    await openGroup('Palette')
    const reset = container.querySelector<HTMLButtonElement>('[aria-label="Reset Primary color"]')!
    await act(async () => reset.click())
    expect(updateKit).toHaveBeenCalledWith('kit-9', { palette: { ...BRAND, primary: expect.any(String) } })
    const activate = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Activate')!
    await act(async () => activate.click())
    expect(activateKit).toHaveBeenCalledWith('kit-9')
  })

  it('uses shared Settings groups with nested asset disclosures', async () => {
    const kit = makeKit()
    useBrandKitStore.setState({ currentUserId: 'user-a', kits: [kit], activeKit: kit, assetsByKitId: { [kit.id]: [] }, loading: false, syncing: false, loadAssetsForKit: vi.fn(async () => []) })
    await render(<BrandKitSettingsPanel />)
    expect(container.querySelectorAll('.bk-settings > .vsm-settings-group')).toHaveLength(5)
    expect(container.querySelector('.rw-window-header, [role="tablist"]')).toBeNull()
    const editor = container.querySelector('.bk-assets-editor')!
    expect(editor.closest('[hidden]')).toBeTruthy()
    await openGroup('Brand assets')
    expect(editor.closest('[hidden]')).toBeNull()
    expect(editor.querySelectorAll(':scope > .drc-group[data-drc-depth="1"]')).toHaveLength(10)
    expect(container.querySelectorAll('.bk-assets-editor .bk-asset-role')).toHaveLength(0)
    expect(container.querySelector('#bk-display-asset')?.closest('.dv-underline-dropdown')).toBeTruthy()
    await openGroup('Brand assets')
    expect(editor.closest('[hidden]')).toBeTruthy()
  })

  it('keeps Settings navigation keyboard accessible and preserves Escape closing', async () => {
    const onClose = vi.fn()
    await render(<SettingsModal onClose={onClose} />)
    const account = container.querySelector('#vsm-tab-account') as HTMLButtonElement
    const appearance = container.querySelector('#vsm-tab-appearance') as HTMLButtonElement
    const brand = container.querySelector('#vsm-tab-brand') as HTMLButtonElement
    const system = container.querySelector('#vsm-tab-system') as HTMLButtonElement
    const modal = container.querySelector('.vsm-modal') as HTMLDivElement
    const contentClassName = container.querySelector('.vsm-content')?.className
    const initialModalClassName = modal.className
    expect(account.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('#vsm-tab-shortcuts')).toBeNull()

    await act(async () => account.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(appearance.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('vsm-tab-appearance')

    await act(async () => appearance.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(brand.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('vsm-tab-brand')
    expect(container.querySelector('[role="tabpanel"]')?.className).toBe(contentClassName)
    expect(modal.className).toBe(initialModalClassName)

    await act(async () => system.click())
    expect(container.textContent).toContain('Keyboard Shortcuts')

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Brand Kit preset preview surfaces', () => {
  it('renders preset card swatches and engine accents from the effective palette', async () => {
    const kit = makeKit()
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'pixGrid')
    if (!preset) throw new Error('Missing PixGrid fixture')
    useBrandKitStore.setState({ currentUserId: 'user-a', kits: [kit], activeKit: kit })

    await render(<ReactPresetBrowser presets={[preset]} activePresetId={preset.id} onSelect={vi.fn()} />)

    const swatches = [...container.querySelectorAll<HTMLElement>('.rv-palette-swatch')]
    expect(swatches.map(swatch => swatch.title)).toEqual(Object.values(BRAND).slice(0, 5))
    const icon = container.querySelector<HTMLElement>('.rv-preset-engine-icon')
    expect(icon?.style.color.toLowerCase()).toBe('rgb(255, 51, 102)')
    const card = container.querySelector<HTMLElement>('.rv-preset-card')
    expect(card?.style.getPropertyValue('--accent')).toBe(BRAND.primary)
  })
})

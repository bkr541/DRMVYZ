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
    engineRules: { oscilloscope: { mode: 'brand', strength: 1 } },
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
    expect(container.textContent).toContain('Loading…')
  })

  it('renders empty-state onboarding with a labeled name field', async () => {
    useBrandKitStore.setState({ currentUserId: 'user-a', kits: [], activeKit: null, loading: false, syncing: false, error: null })
    await render(<BrandKitSettingsPanel />)
    expect(container.textContent).toContain('Make DRMVYZ feel like your booth')
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
    expect(container.textContent).toContain('ACTIVE KIT')
    expect(container.textContent).toContain('Cloud refresh failed')
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Retry')).toBe(true)

    const switches = [...container.querySelectorAll<HTMLButtonElement>('button[role="switch"]')]
    expect(switches).toHaveLength(2)
    expect(switches[0].getAttribute('aria-label')).toBe('Automatic visual personalization')
    expect(switches[0].getAttribute('aria-checked')).toBe('true')
    await act(async () => switches[0].click())
    expect(updateKit).toHaveBeenCalledWith(kit.id, { autoApply: false })
  })

  it('keeps Settings navigation keyboard accessible and preserves Escape closing', async () => {
    const onClose = vi.fn()
    await render(<SettingsModal onClose={onClose} />)
    const account = container.querySelector('#vsm-tab-account') as HTMLButtonElement
    const brand = container.querySelector('#vsm-tab-brand') as HTMLButtonElement
    expect(account.getAttribute('aria-selected')).toBe('true')

    await act(async () => account.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(brand.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('vsm-tab-brand')

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Brand Kit preset preview surfaces', () => {
  it('renders preset card swatches and engine accents from the effective palette', async () => {
    const kit = makeKit()
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'oscilloscope')
    if (!preset) throw new Error('Missing Sound Drawing fixture')
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

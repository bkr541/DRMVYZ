// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'
import { supabaseConfigured } from '../../lib/supabase'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('AuthPage configuration gate', () => {
  it.runIf(!supabaseConfigured)('shows setup guidance without unusable authentication controls', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<AuthPage onAuth={vi.fn()} />)
    })

    expect(container.textContent).toContain('Supabase not configured')
    expect(container.textContent).toContain('VITE_SUPABASE_URL')
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })
})

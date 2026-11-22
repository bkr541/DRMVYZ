// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type AuthListener = (event: string) => void
const auth = vi.hoisted(() => ({
  listeners: [] as ((event: string) => void)[],
  pending: [] as { resolve: (value: unknown) => void; reject: (error: unknown) => void }[],
}))
vi.mock('./supabase', () => ({
  supabaseConfigured: true,
  supabase: { auth: {
    onAuthStateChange: (listener: AuthListener) => { auth.listeners.push(listener); return { data: { subscription: { unsubscribe: () => { auth.listeners = auth.listeners.filter(entry => entry !== listener) } } } } },
    getUser: () => new Promise((resolve, reject) => { auth.pending.push({ resolve, reject }) }),
  } },
}))

import { useAdminAccess, useAdminAccessStatus, type AdminAccessStatus } from './adminAccess'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let seen: { status: AdminAccessStatus }
let allowedFlag: boolean | null = null

function Probe() { seen = { status: useAdminAccessStatus() }; return null }
function FlagProbe() { allowedFlag = useAdminAccess(); return null }

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve() }) }
/** Answer the oldest outstanding getUser call. */
const answer = async (user: { app_metadata?: Record<string, unknown> } | null, error: unknown = null) => {
  const next = auth.pending.shift()!
  await act(async () => { next.resolve({ data: { user }, error }) })
  await settle()
}
const fireAuthEvent = async (event: string) => { await act(async () => { auth.listeners.forEach(listener => listener(event)) }); await settle() }

beforeEach(async () => {
  auth.listeners = []; auth.pending = []
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(async () => root.render(<Probe />)); await settle()
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('admin access status', () => {
  it('useAdminAccess is true exactly while the status is granted', async () => {
    auth.pending = [] // the probe from beforeEach is replaced, so its check no longer matters
    await act(async () => root.render(<FlagProbe />)); await settle()
    expect(allowedFlag).toBe(false)
    await answer({ app_metadata: { role: 'admin' } }); expect(allowedFlag).toBe(true)
    await fireAuthEvent('TOKEN_REFRESHED'); expect(allowedFlag).toBe(true)
    await answer({ app_metadata: { role: 'authenticated' } }); expect(allowedFlag).toBe(false)
  })

  it('is checking until the server answers, then granted only for a verified admin', async () => {
    expect(seen).toEqual({ status: 'checking' })
    await answer({ app_metadata: { role: 'admin' } })
    expect(seen).toEqual({ status: 'granted' })
  })

  it('is denied for someone who is not an admin, signed out, or whose check failed', async () => {
    await answer({ app_metadata: { role: 'authenticated' } }); expect(seen).toEqual({ status: 'denied' })
    await fireAuthEvent('SIGNED_IN'); await answer(null); expect(seen.status).toBe('denied')
    await fireAuthEvent('TOKEN_REFRESHED'); await answer({ app_metadata: { role: 'admin' } }, new Error('offline')); expect(seen.status).toBe('denied')
    await fireAuthEvent('TOKEN_REFRESHED'); await act(async () => { auth.pending.shift()!.reject(new Error('network')) }); await settle(); expect(seen.status).toBe('denied')
  })

  it('keeps a verified admin granted through a routine re-check, so a token refresh or a focus event never pulls them out of Admin', async () => {
    await answer({ app_metadata: { role: 'admin' } })
    const trace: AdminAccessStatus[] = []
    for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN', 'USER_UPDATED']) {
      await fireAuthEvent(event)
      trace.push(seen.status)                       // the re-check is still on its way
      await answer({ app_metadata: { role: 'admin' } })
      trace.push(seen.status)
    }
    expect(trace).toEqual(Array(6).fill('granted'))
  })

  it('takes access away at once on sign-out, and when a re-check says the role is gone', async () => {
    await answer({ app_metadata: { role: 'admin' } })
    await fireAuthEvent('SIGNED_OUT'); expect(seen.status).toBe('denied')
    await answer(null)
    await fireAuthEvent('SIGNED_IN'); expect(seen.status).toBe('checking'); await answer({ app_metadata: { role: 'admin' } }); expect(seen.status).toBe('granted')
    await fireAuthEvent('USER_UPDATED'); expect(seen.status).toBe('granted'); await answer({ app_metadata: { role: 'authenticated' } }); expect(seen.status).toBe('denied')
  })

  it('ignores an answer that a newer check has already replaced', async () => {
    await fireAuthEvent('TOKEN_REFRESHED')            // two checks outstanding: the first (initial) and this one
    expect(auth.pending).toHaveLength(2)
    await answer({ app_metadata: { role: 'admin' } }) // the older answer arrives first and is stale
    expect(seen.status).toBe('checking')
    await answer({ app_metadata: { role: 'authenticated' } })
    expect(seen.status).toBe('denied')
  })
})

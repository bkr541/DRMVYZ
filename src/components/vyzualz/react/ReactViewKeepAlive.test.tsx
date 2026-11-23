/** @vitest-environment jsdom */
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ReactViewKeepAlive } from './ReactViewKeepAlive'
import { useReactBackgrounded } from './reactBackground'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let mounts = 0
let unmounts = 0
let latestBackgrounded = false
function Probe() {
  const backgrounded = useReactBackgrounded()
  latestBackgrounded = backgrounded
  const [count, setCount] = useState(0)
  React.useEffect(() => { mounts += 1; return () => { unmounts += 1 } }, [])
  return <main data-probe data-count={count} onClick={() => setCount(value => value + 1)}>view</main>
}

// The same shape as VyzualzView: the shell is the first child; the host is its first child on every page; some pages return the shell alone and some wrap it in a fragment with dialogs.
function Shell({ page, host }: { page: string; host: React.ReactNode }) {
  return <div className="frame">{host}{page === 'react' ? null : <section data-page={page}>{page}</section>}</div>
}
function Router({ page, casting }: { page: string; casting: boolean }) {
  const host = (page === 'react' || casting) ? <ReactViewKeepAlive foreground={page === 'react'}><Probe /></ReactViewKeepAlive> : null
  if (page === 'media') return <><Shell page={page} host={host} /><div data-dialog /></>
  return <Shell page={page} host={host} />
}

let container: HTMLDivElement
let root: Root
const render = (page: string, casting: boolean) => act(async () => { root.render(<Router page={page} casting={casting} />) })
beforeEach(() => { mounts = 0; unmounts = 0; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('React view keep-alive', () => {
  it('keeps the same view instance (and its state) while a cast is live and the user moves between pages', async () => {
    await render('react', true)
    await act(async () => container.querySelector<HTMLElement>('[data-probe]')!.click())
    expect(container.querySelector('[data-probe]')?.getAttribute('data-count')).toBe('1')

    for (const page of ['presetManager', 'media', 'showManager', 'react']) {
      await render(page, true)
      expect(container.querySelectorAll('[data-probe]')).toHaveLength(1)
      expect(container.querySelector('[data-probe]')?.getAttribute('data-count')).toBe('1')
    }
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
  })

  it('hides the view and tells it so while it is behind another page, and shows it again on return', async () => {
    await render('react', true)
    const host = () => container.querySelector<HTMLElement>('.vz-react-host')!
    expect(host().style.display).toBe('contents')
    expect(host().hasAttribute('inert')).toBe(false)
    expect(latestBackgrounded).toBe(false)

    await render('media', true)
    expect(host().dataset.backgrounded).toBe('true')
    expect(host().hasAttribute('inert')).toBe(true)
    expect(host().style.visibility).toBe('hidden')
    expect(host().style.pointerEvents).toBe('none')
    expect(latestBackgrounded).toBe(true)
    expect(container.querySelector('[data-page="media"]')).not.toBeNull()

    await render('react', true)
    expect(host().style.display).toBe('contents')
    expect(host().hasAttribute('inert')).toBe(false)
    expect(latestBackgrounded).toBe(false)
  })

  it('is not mounted behind another page when nothing is casting, and goes away when the cast ends', async () => {
    await render('react', false)
    expect(container.querySelector('.vz-react-host')).not.toBeNull()
    await render('presetManager', false)
    expect(container.querySelector('.vz-react-host')).toBeNull()
    expect(unmounts).toBe(1)

    await render('react', true)
    await render('presetManager', true)
    expect(container.querySelector('.vz-react-host')).not.toBeNull()
    await render('presetManager', false)
    expect(container.querySelector('.vz-react-host')).toBeNull()
  })
})

// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { mirrorAppStylesInto } from '../../LayoutLabModal'
it('copies styles loaded after the popup opens and stops watching on close', async()=>{
  const target=document.implementation.createHTMLDocument('Layout Lab')
  const stop=mirrorAppStylesInto(target)
  const style=document.createElement('style');style.dataset.labMirrorTest='true';style.textContent='.preview { color: red; }';document.head.appendChild(style)
  await new Promise(resolve=>setTimeout(resolve,0))
  expect(target.head.querySelector('[data-lab-mirror-test]')?.textContent).toContain('red')
  style.textContent='.preview { color: blue; }'
  await new Promise(resolve=>setTimeout(resolve,0))
  expect(target.head.querySelector('[data-lab-mirror-test]')?.textContent).toContain('blue')
  stop();style.remove()
  await new Promise(resolve=>setTimeout(resolve,0))
  expect(target.head.querySelector('[data-lab-mirror-test]')).not.toBeNull()
})

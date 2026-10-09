import { beforeEach, describe, expect, it } from 'vitest'
import { hasLockedFrame } from './frames'

function frame(attrs: string, size: { width: number; height: number }): HTMLIFrameElement {
  document.body.innerHTML = `<iframe ${attrs}></iframe>`
  const element = document.querySelector('iframe')!
  element.getBoundingClientRect = () => ({ ...size, x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height, toJSON: () => ({}) })
  return element
}

describe('hasLockedFrame', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('is false for a page without frames', () => {
    document.body.innerHTML = '<p>Halo</p>'

    expect(hasLockedFrame(document)).toBe(false)
  })

  it('is true for a big frame from another site that the page cannot read', () => {
    frame('src="https://forms.other-site.test/apply"', { width: 600, height: 500 })

    expect(hasLockedFrame(document)).toBe(true)
  })

  it('ignores a tiny frame such as a tracking pixel', () => {
    frame('src="https://ads.other-site.test/pixel"', { width: 1, height: 1 })

    expect(hasLockedFrame(document)).toBe(false)
  })
})

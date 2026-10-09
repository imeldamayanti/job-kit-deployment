import { beforeEach, describe, expect, it } from 'vitest'
import { formIsLocked, hasLockedFrame } from './frames'

// A cross-origin frame answers null for contentDocument; stubbing that avoids loading a real address in the test.
function frame(readable: boolean, size: { width: number; height: number }, src = ''): HTMLIFrameElement {
  document.body.innerHTML = '<iframe title="Form"></iframe>'
  const element = document.querySelector('iframe')!
  if (src) Object.defineProperty(element, 'src', { get: () => src })
  if (!readable) Object.defineProperty(element, 'contentDocument', { get: () => null })
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
    frame(false, { width: 600, height: 500 })

    expect(hasLockedFrame(document)).toBe(true)
  })

  it('ignores a tiny frame such as a tracking pixel', () => {
    frame(false, { width: 1, height: 1 })

    expect(hasLockedFrame(document)).toBe(false)
  })

  it('counts a hiring-platform frame even while it is still collapsed to nothing', () => {
    frame(false, { width: 0, height: 0 }, 'https://job-boards.greenhouse.io/embed/job_app?for=airbnb')

    expect(hasLockedFrame(document)).toBe(true)
  })

  it('still ignores a collapsed frame from an unrelated site', () => {
    frame(false, { width: 0, height: 0 }, 'https://tracker.example.test/pixel')

    expect(hasLockedFrame(document)).toBe(false)
  })

  it('is false for a big frame the page can read', () => {
    frame(true, { width: 600, height: 500 })

    expect(hasLockedFrame(document)).toBe(false)
  })
})

describe('formIsLocked', () => {
  it('is true when a locked frame is there and nothing on the page matched the profile', () => {
    expect(formIsLocked(0, true)).toBe(true)
  })

  it('is false when something matched, or when there is no locked frame', () => {
    expect(formIsLocked(3, true)).toBe(false)
    expect(formIsLocked(0, false)).toBe(false)
  })
})

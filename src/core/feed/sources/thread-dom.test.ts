import { beforeEach, describe, expect, it } from 'vitest'
import { isLoginWall, readThreadPosts } from './thread-dom'

const post = (code: string, lines: string[], user = 'loker.id', time = '2026-10-19T01:02:03.000Z') => `
<div data-pressable-container="true">
  <a href="/@${user}"><span dir="auto">${user}</span></a>
  <a href="/@${user}/post/${code}?xmt=abc"><time datetime="${time}">1h</time></a>
  ${lines.map((line) => `<span dir="auto">${line}</span>`).join('')}
</div>`

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('readThreadPosts', () => {
  it('reads the link, the date and the text lines of each post', () => {
    document.body.innerHTML = post('C1', ["We're hiring: Backend Engineer", 'Jakarta, remote'])
    expect(readThreadPosts(document)).toEqual([
      { url: 'https://www.threads.com/@loker.id/post/C1', postedAt: '2026-10-19', text: "We're hiring: Backend Engineer\nJakarta, remote" },
    ])
  })

  it('skips containers without a post link and reads a post only once', () => {
    document.body.innerHTML = `<div data-pressable-container="true"><span dir="auto">Iklan</span></div>${post('C1', ['a'])}${post('C1', ['a'])}`
    expect(readThreadPosts(document).map((p) => p.url)).toEqual(['https://www.threads.com/@loker.id/post/C1'])
  })

  it('counts nested text spans once', () => {
    document.body.innerHTML = post('C2', []).replace('</div>', '<span dir="auto">Halo <span dir="auto">dunia</span></span></div>')
    expect(readThreadPosts(document)[0]?.text).toBe('Halo dunia')
  })

  it('drops the post age and the counters that sit among the text', () => {
    document.body.innerHTML = post('C4', ['20h', 'We are hiring', 'Translate', '36', '1.2K', '2025 target'])
    expect(readThreadPosts(document)[0]?.text).toBe('We are hiring\n2025 target')
  })

  it('leaves the date empty when the post has no valid time', () => {
    document.body.innerHTML = post('C3', ['x'], 'a', 'bukan-tanggal')
    expect(readThreadPosts(document)[0]?.postedAt).toBe('')
  })
})

describe('isLoginWall', () => {
  it('sees a login form or a login address', () => {
    document.body.innerHTML = '<form><input type="password"></form>'
    expect(isLoginWall(document, 'https://www.threads.com/')).toBe(true)
    document.body.innerHTML = post('C1', ['a'])
    expect(isLoginWall(document, 'https://www.threads.com/login')).toBe(true)
    expect(isLoginWall(document, 'https://www.threads.com/')).toBe(false)
  })
})

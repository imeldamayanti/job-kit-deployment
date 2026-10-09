import { describe, expect, it } from 'vitest'
import { htmlToText, truncateText } from './text'

describe('htmlToText', () => {
  it('turns markup into plain lines', () => {
    expect(htmlToText('<p>Bangun <b>UI</b></p><ul><li>React</li><li>TypeScript</li></ul>')).toBe('Bangun UI\nReact\nTypeScript')
  })

  it('decodes entities, also when they are escaped twice', () => {
    expect(htmlToText('R&amp;D &lt;p&gt;Tim&lt;/p&gt; &nbsp;kami &#39;ok&#39;')).toBe("R&D\nTim\nkami 'ok'")
  })

  it('drops script and style content', () => {
    expect(htmlToText('<style>p{}</style><script>alert(1)</script><p>Isi</p>')).toBe('Isi')
  })

  it('squeezes blank space', () => {
    expect(htmlToText('<p>  a   b </p>\n\n\n<p>c</p>')).toBe('a b\nc')
  })
})

describe('truncateText', () => {
  it('leaves short text alone', () => {
    expect(truncateText('pendek', 20)).toBe('pendek')
  })

  it('cuts at a word and marks it', () => {
    expect(truncateText('satu dua tiga empat', 12)).toBe('satu dua…')
  })
})

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { Select } from './Select'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null
async function render(node: React.ReactNode): Promise<HTMLElement> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(node))
  return container
}
afterEach(() => {
  container?.remove()
  container = null
})

describe('Select', () => {
  it('shows its label by default', async () => {
    const el = await render(<Select label="Status"><option>A</option></Select>)

    expect(el.querySelector('label')?.className).not.toContain('sr-only')
  })

  it('keeps the label for screen readers only when hideLabel is set, and still draws the custom chevron', async () => {
    const el = await render(<Select label="Urutkan" hideLabel><option>A</option></Select>)

    expect(el.querySelector('label')?.className).toContain('sr-only')
    expect(el.querySelector('label')?.textContent).toBe('Urutkan')
    expect(el.querySelector('select')?.className).toContain('appearance-none')
    expect(el.querySelector('svg')).not.toBeNull()
  })
})

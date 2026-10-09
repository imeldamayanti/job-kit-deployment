import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createFiller } from './apply'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Form({ onState }: { onState: (value: string) => void }) {
  const [value, setValue] = useState('')
  onState(value)
  return <input type="text" value={value} onChange={(event) => setValue(event.target.value)} />
}

describe('createFiller with a React controlled input', () => {
  it('the value reaches React state and survives the next render', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    let state = ''
    const root = createRoot(container)
    await act(async () => root.render(<Form onState={(value) => (state = value)} />))
    const input = container.querySelector('input')!

    await act(async () => {
      createFiller().fill([{ element: input, value: 'Imelda' }])
    })
    await act(async () => root.render(<Form onState={(value) => (state = value)} />))

    expect(state).toBe('Imelda')
    expect(input.value).toBe('Imelda')
  })
})

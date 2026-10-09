import { describe, expect, it } from 'vitest'
import { checkExtractedPages, classifyPdfError, itemsToText, looksLikePdf, type PdfTextItem } from './pdf-text'

const bytes = (text: string) => new TextEncoder().encode(text)

function item(str: string, x: number, y: number, width = str.length * 5, hasEOL = false): PdfTextItem {
  return { str, transform: [10, 0, 0, 10, x, y], width, hasEOL }
}

describe('looksLikePdf', () => {
  it('accepts bytes that start with the PDF signature', () => {
    expect(looksLikePdf(bytes('%PDF-1.7\n...'))).toBe(true)
  })

  it('accepts the signature a few bytes in, as some files carry leading junk', () => {
    expect(looksLikePdf(bytes('\n\n  %PDF-1.4'))).toBe(true)
  })

  it('rejects other content even when the name says .pdf', () => {
    expect(looksLikePdf(bytes('{"app":"job-kit"}'))).toBe(false)
    expect(looksLikePdf(bytes(''))).toBe(false)
  })
})

describe('classifyPdfError', () => {
  it('maps a password exception to encrypted', () => {
    expect(classifyPdfError({ name: 'PasswordException', message: 'No password given' })).toBe('encrypted')
  })

  it('maps anything else pdf.js throws to unreadable', () => {
    expect(classifyPdfError({ name: 'InvalidPDFException' })).toBe('unreadable')
    expect(classifyPdfError(new Error('boom'))).toBe('unreadable')
    expect(classifyPdfError('weird')).toBe('unreadable')
  })
})

describe('checkExtractedPages', () => {
  it('passes pages that have text', () => {
    const pages = ['Sari Contoh\nsari@example.test\nBandung, Indonesia', 'Pendidikan\nUniversitas Contoh']
    expect(checkExtractedPages(pages)).toEqual({ ok: true, pages })
  })

  it('reports no text layer when every page is empty or only whitespace', () => {
    expect(checkExtractedPages(['', '  \n '])).toEqual({ ok: false, reason: 'no-text-layer' })
    expect(checkExtractedPages([])).toEqual({ ok: false, reason: 'no-text-layer' })
  })

  it('treats a page with only a few stray characters as having no text layer', () => {
    expect(checkExtractedPages(['1', '2'])).toEqual({ ok: false, reason: 'no-text-layer' })
  })
})

describe('itemsToText', () => {
  it('puts items on the same baseline on one line, separated by a space when there is a gap', () => {
    const items = [item('Sari', 10, 700), item('Contoh', 40, 700)]
    expect(itemsToText(items)).toBe('Sari Contoh')
  })

  it('does not add a space between pieces that touch', () => {
    const items = [item('sari@', 10, 700, 20), item('example.test', 30, 700)]
    expect(itemsToText(items)).toBe('sari@example.test')
  })

  it('starts a new line when the baseline moves', () => {
    const items = [item('Nama', 10, 700), item('Email', 10, 680)]
    expect(itemsToText(items)).toBe('Nama\nEmail')
  })

  it('starts a new line after an item that ends a line', () => {
    const items = [item('Satu', 10, 700, 20, true), item('Dua', 10, 700)]
    expect(itemsToText(items)).toBe('Satu\nDua')
  })

  it('keeps the order pdf.js gives, so a two-column CV is read column by column', () => {
    const items = [item('Kiri atas', 10, 700), item('Kiri bawah', 10, 680), item('Kanan atas', 300, 700), item('Kanan bawah', 300, 680)]
    expect(itemsToText(items)).toBe('Kiri atas\nKiri bawah\nKanan atas\nKanan bawah')
  })

  it('skips empty items without leaving blank lines', () => {
    const items = [item('A', 10, 700), item('', 20, 700), item('B', 10, 680)]
    expect(itemsToText(items)).toBe('A\nB')
  })
})

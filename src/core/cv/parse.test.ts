import { describe, expect, it } from 'vitest'
import {
  CLEAN_EN,
  CLEAN_ID,
  LABELLED_ID,
  NO_IDENTITY,
  TWO_COLUMN_EN,
  TWO_COLUMN_ID,
  TWO_EMAILS,
  UNVOUCHED_NAME,
} from '../../../fixtures/cv/text-fixtures'
import { parseCv } from './parse'

const high = (value: string) => ({ value, confidence: 'high' })
const low = (value: string) => ({ value, confidence: 'low' })

describe('parseCv identity and contact', () => {
  it('reads a single-column Indonesian CV', () => {
    const cv = parseCv(CLEAN_ID)
    expect(cv.personal).toEqual({ firstName: high('Rani'), middleName: high('Wijaya'), lastName: high('Contoh') })
    expect(cv.contact).toEqual({
      email: high('rani.contoh@example.test'),
      phone: high('+62 812-0000-0001'),
      linkedin: high('linkedin.com/in/rani-contoh-sintetis'),
      city: high('Bandung'),
    })
  })

  it('finds the name in the main column of a two-column CV, vouched for by the email', () => {
    const cv = parseCv(TWO_COLUMN_EN)
    expect(cv.personal).toEqual({ firstName: high('Dewi'), middleName: high('Anggraini'), lastName: high('Sample') })
    expect(cv.contact.email).toEqual(high('dewi.sample@example.test'))
    expect(cv.contact.phone).toEqual(high('+62 21 5555 0002'))
    expect(cv.contact.city).toEqual(high('Jakarta'))
  })

  it('joins a LinkedIn address that wraps onto the next line, but asks for a second look', () => {
    expect(parseCv(TWO_COLUMN_EN).contact.linkedin).toEqual(low('linkedin.com/in/dewi-sample-synthetic'))
  })

  it('reads labelled lines, an upper-case name, and drops the degree after the comma', () => {
    const cv = parseCv(LABELLED_ID)
    expect(cv.personal).toEqual({ firstName: high('Budi'), middleName: high('Santoso'), lastName: high('Contoh') })
    expect(cv.contact).toEqual({
      email: high('budi.santoso@example.test'),
      phone: high('0812-0000-0003'),
      city: high('Surabaya'),
    })
  })

  it('reads an international phone format, a full LinkedIn URL, and city with country', () => {
    const cv = parseCv(CLEAN_EN)
    expect(cv.contact).toEqual({
      email: high('alex.rivera@example.test'),
      phone: high('(+62) 811 0000 0004'),
      linkedin: high('https://www.linkedin.com/in/alex-rivera-sample'),
      city: high('Yogyakarta'),
    })
  })

  it('reads a two-column CV whose contact column comes first', () => {
    const cv = parseCv(TWO_COLUMN_ID)
    expect(cv.personal).toEqual({ firstName: high('Sinta'), middleName: high('Lestari'), lastName: high('Contoh') })
    expect(cv.contact).toEqual({
      email: high('sinta.lestari@example.test'),
      phone: high('0857-0000-0005'),
      city: high('Depok'),
    })
  })

  it('marks a name low when it is not on the first line and nothing vouches for it', () => {
    const cv = parseCv(UNVOUCHED_NAME)
    expect(cv.personal).toEqual({ firstName: low('Made'), middleName: low('Wirawan'), lastName: low('Sampel') })
    expect(cv.contact.phone).toEqual(high('021-5550-0006'))
  })

  it('does not pick one of two different emails with full confidence', () => {
    expect(parseCv(TWO_EMAILS).contact.email).toEqual(low('tia.contoh@example.test'))
  })

  it('returns an empty result, not an error, when nothing is recognised', () => {
    const empty = { personal: {}, contact: {}, education: [], experience: [], unparsed: [] }
    expect(parseCv(NO_IDENTITY)).toEqual(empty)
    expect(parseCv('')).toEqual(empty)
    expect(parseCv('   \n  ')).toEqual(empty)
  })
})

describe('parseCv phone numbers', () => {
  const phoneIn = (line: string) => parseCv(`Telp ${line}`).contact.phone?.value

  it.each([
    ['0812 3456 7890', '0812 3456 7890'],
    ['+62-812-3456-7890', '+62-812-3456-7890'],
    ['(021) 555 0100', '(021) 555 0100'],
    ['62 812 0000 0009', '62 812 0000 0009'],
  ])('reads %s', (line, expected) => {
    expect(phoneIn(line)).toBe(expected)
  })

  it('does not mistake a year range for a phone number', () => {
    expect(parseCv('Pendidikan\n2018 - 2022').contact.phone).toBeUndefined()
  })
})

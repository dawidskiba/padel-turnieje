import { describe, expect, it } from 'vitest'

import { splitPasted } from '../ChipInput'

/**
 * The paste path is the one that matters: an organiser with sixteen names in a
 * WhatsApp message should be finished in one gesture, and those messages
 * arrive in every shape.
 */
describe('splitting a pasted roster', () => {
  it('splits on newlines', () => {
    expect(splitPasted('Ann\nBob\nCara')).toEqual(['Ann', 'Bob', 'Cara'])
  })

  it('splits on commas and semicolons', () => {
    expect(splitPasted('Ann, Bob; Cara')).toEqual(['Ann', 'Bob', 'Cara'])
  })

  it('splits on tabs, which is what a spreadsheet column pastes as', () => {
    expect(splitPasted('Ann\tBob\tCara')).toEqual(['Ann', 'Bob', 'Cara'])
  })

  it('drops blank lines and trailing separators', () => {
    expect(splitPasted('Ann\n\nBob\n\n\n')).toEqual(['Ann', 'Bob'])
  })

  it('trims surrounding whitespace', () => {
    expect(splitPasted('  Ann  \n  Bob  ')).toEqual(['Ann', 'Bob'])
  })

  it('keeps a name that contains spaces', () => {
    expect(splitPasted('Ann Kowalska\nBob Nowak')).toEqual(['Ann Kowalska', 'Bob Nowak'])
  })

  it('keeps an ampersand team name intact', () => {
    // Teams format entries look like "Ann & Bob"; splitting those would be wrong.
    expect(splitPasted('Ann & Bob\nCara & Dan')).toEqual(['Ann & Bob', 'Cara & Dan'])
  })
})

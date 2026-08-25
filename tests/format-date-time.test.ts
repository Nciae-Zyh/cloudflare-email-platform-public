import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../app/utils/formatDateTime'

describe('formatDateTime', () => {
  it('treats D1 timestamps as UTC and renders Shanghai time deterministically', () => {
    expect(formatDateTime('2026-07-28 00:06:56')).toBe('2026/7/28 08:06:56')
  })

  it('keeps explicit offsets unambiguous', () => {
    expect(formatDateTime('2026-07-27T16:06:56-08:00')).toBe('2026/7/28 08:06:56')
  })

  it('returns a placeholder for invalid timestamps', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
  })
})

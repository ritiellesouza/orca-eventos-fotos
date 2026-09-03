import { describe, it, expect } from 'vitest'

function projectName() {
  return 'orca-eventos-fotos'
}

describe('smoke', () => {
  it('test runner works', () => {
    expect(projectName()).toBe('orca-eventos-fotos')
  })
})

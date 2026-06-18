import { describe, expect, it } from 'vitest'

import { buildTeleopPayload, teleopDirectionFromKey } from './teleop'

describe('teleop keyboard mapping', () => {
  it('maps AZERTY movement keys and arrows', () => {
    expect(teleopDirectionFromKey('z')).toBe('forward')
    expect(teleopDirectionFromKey('q')).toBe('left')
    expect(teleopDirectionFromKey('s')).toBe('backward')
    expect(teleopDirectionFromKey('d')).toBe('right')
    expect(teleopDirectionFromKey('ArrowUp')).toBe('forward')
    expect(teleopDirectionFromKey(' ')).toBe('stop')
  })

  it('builds a bounded twist payload from active directions', () => {
    expect(buildTeleopPayload(new Set(['forward', 'left']))).toEqual({
      linear_x: 0.2,
      angular_z: 0.8,
      duration_ms: 500,
    })
    expect(buildTeleopPayload(new Set(['forward', 'stop']))).toEqual({
      linear_x: 0,
      angular_z: 0,
      duration_ms: 500,
    })
  })
})

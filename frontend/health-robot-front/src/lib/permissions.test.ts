import { describe, expect, it } from 'vitest'

import type { User } from './auth'
import { canNavigateRobot, canUseAdminControls, canUseTeleop } from './permissions'

const admin = { id: '1', email: 'admin@health-robot.local', name: 'Admin', role: 'admin' } satisfies User
const caregiver = { id: '2', email: 'caregiver@health-robot.local', name: 'Caregiver', role: 'caregiver' } satisfies User

describe('permissions', () => {
  it('allows caregivers to navigate but not use admin controls or teleop', () => {
    expect(canNavigateRobot(caregiver)).toBe(true)
    expect(canUseAdminControls(caregiver)).toBe(false)
    expect(canUseTeleop(caregiver)).toBe(false)
  })

  it('allows admins to use admin controls and teleop', () => {
    expect(canNavigateRobot(admin)).toBe(true)
    expect(canUseAdminControls(admin)).toBe(true)
    expect(canUseTeleop(admin)).toBe(true)
  })
})

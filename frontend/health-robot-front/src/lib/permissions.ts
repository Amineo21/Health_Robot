import type { User, UserRole } from './auth'

export const CAREGIVER_OR_ADMIN_ROLES: UserRole[] = ['admin', 'caregiver']
export const ADMIN_ROLES: UserRole[] = ['admin']

export function hasRole(user: Pick<User, 'role'> | null | undefined, allowedRoles: readonly UserRole[]) {
  return Boolean(user && allowedRoles.includes(user.role))
}

export function canAccessRobot(user: Pick<User, 'role'> | null | undefined) {
  return hasRole(user, CAREGIVER_OR_ADMIN_ROLES)
}

export function canUseAdminControls(user: Pick<User, 'role'> | null | undefined) {
  return hasRole(user, ADMIN_ROLES)
}

export function canNavigateRobot(user: Pick<User, 'role'> | null | undefined) {
  return canAccessRobot(user)
}

export function canUseTeleop(user: Pick<User, 'role'> | null | undefined) {
  return canUseAdminControls(user)
}

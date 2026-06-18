import type { ReactNode } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/lib/auth'
import { hasRole } from '@/lib/permissions'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: readonly UserRole[]
  fallback?: ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user } = useAuth()

  if (!hasRole(user, allowedRoles)) {
    return fallback
  }

  return children
}

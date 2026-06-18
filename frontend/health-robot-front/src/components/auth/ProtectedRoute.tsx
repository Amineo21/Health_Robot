import { useEffect, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/lib/auth'
import { hasRole } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: readonly UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/auth/login', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (isLoading) {
    return <AuthLoader />
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (allowedRoles && !hasRole(user, allowedRoles)) {
    return <AccessDenied />
  }

  return children
}

export function AuthLoader() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-slate-300">
          Chargement de la session...
        </div>
      </div>
    </div>
  )
}

export function AccessDenied() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-3xl items-center justify-center">
        <section className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-8 text-center shadow-2xl shadow-rose-950/20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-200">Acces refuse</p>
          <h1 className="mt-3 text-3xl font-black">Accès refusé</h1>
          <p className="mt-3 text-sm leading-6 text-rose-100/80">
            Ton rôle ne permet pas d'accéder à cette page ou à cette action.
          </p>
        </section>
      </div>
    </div>
  )
}

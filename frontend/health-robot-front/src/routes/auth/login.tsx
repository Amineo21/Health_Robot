import { useEffect } from 'react'

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/contexts/AuthContext'

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  return (
    <AuthShell
      eyebrow="Connexion"
      title="Accède à ton espace CareBot"
      description="Connecte-toi pour superviser les missions, suivre l'activité et piloter les flux du robot."
    >
      <LoginForm />
    </AuthShell>
  )
}
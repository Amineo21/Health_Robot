import { useEffect } from 'react'

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { useAuth } from '@/contexts/AuthContext'

export const Route = createFileRoute('/auth/signup')({
  component: SignupPage,
})

function SignupPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  return (
      <AuthShell
        eyebrow="Création de compte"
        title="Création uniquement par admin"
        description="Il n'y a pas d'inscription publique. Les administrateurs gèrent les comptes depuis l'espace admin."
      >
      <SignupForm />
    </AuthShell>
  )
}

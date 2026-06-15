import { createFileRoute } from '@tanstack/react-router'

import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Mot de passe oublié"
      title="Réinitialiser l'accès"
      description="Indique ton email pour lancer la procédure de réinitialisation."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
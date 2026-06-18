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
        title="Fonction non disponible"
        description="Le backend MVP ne fournit pas de réinitialisation publique de mot de passe."
      >
      <ForgotPasswordForm />
    </AuthShell>
  )
}

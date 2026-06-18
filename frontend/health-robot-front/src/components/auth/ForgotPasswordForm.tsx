import { Link } from '@tanstack/react-router'

export function ForgotPasswordForm() {
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
        La réinitialisation publique de mot de passe n'est pas disponible sur le backend MVP. Demande à un administrateur de définir un nouveau mot de passe.
      </div>
      <Link to="/auth/login" className="inline-flex rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300">
        Retour à la connexion
      </Link>
    </div>
  )
}

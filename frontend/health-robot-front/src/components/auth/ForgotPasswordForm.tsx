import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    try {
      // TODO: Implement actual forgot password API call
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la demande de réinitialisation')
      }

      setMessage('Un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.')
      setTimeout(() => {
        navigate({ to: '/auth/login' })
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur s\'est produite')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-300 mb-4">
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-white/10 border border-cyan-400/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 transition-colors"
          placeholder="exemple@email.com"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3 bg-green-500/20 border border-green-400/50 rounded-lg text-green-300 text-sm">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-gradient-to-r from-cyan-400 to-cyan-300 text-slate-950 font-bold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Envoi...' : 'Envoyer le lien'}
      </button>

      <div className="pt-4 border-t border-white/10 text-center text-sm text-slate-400">
        <a href="/auth/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
          Retour à la connexion
        </a>
      </div>
    </form>
  )
}

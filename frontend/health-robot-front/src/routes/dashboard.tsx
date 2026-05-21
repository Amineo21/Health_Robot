import { useEffect } from 'react'

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/auth/login', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-slate-300">
            Chargement du tableau de bord...
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/50 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Bonjour {user.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Ton espace de supervision est prêt. Ici tu pourras brancher les missions, les
                indicateurs robot et les actions de l’équipe.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Se déconnecter
              </button>
              <Link
                to="/auth/signup"
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Ajouter un compte
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Missions actives', value: '08' },
            { label: 'Alertes', value: '02' },
            { label: 'Équipe connectée', value: '14' },
            { label: 'Systèmes en ligne', value: '99.8%' },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur"
            >
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Prochaine étape</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Ce dashboard sert de base de migration. Tu peux maintenant raccrocher les vraies
              données robot, puis remplacer le mock local par ton backend quand tu veux.
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Compte actif</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <dt>Email</dt>
                <dd className="text-right text-white">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Rôle</dt>
                <dd className="text-right text-white capitalize">{user.role}</dd>
              </div>
            </dl>
          </article>
        </section>
      </div>
    </div>
  )
}
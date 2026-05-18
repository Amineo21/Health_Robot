import type { ReactNode } from 'react'

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="hidden rounded-3xl border border-cyan-400/20 bg-slate-950/50 p-8 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                {eyebrow}
              </div>
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-white xl:text-5xl">
                CareBot Control, version front moderne.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Un espace de connexion clair, rapide et prêt à être relié à tes flux robots,
                missions et supervision.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Authentification mock persistante via localStorage
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Routes TanStack Start: login, signup, forgot-password, dashboard
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Adaptable ensuite vers une API FastAPI réelle
              </div>
            </div>
          </aside>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  {eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
              </div>
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
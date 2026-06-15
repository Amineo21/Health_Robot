import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(34,211,238,0.15),rgba(79,70,229,0.1),transparent_90%)] bg-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl opacity-20"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          <section className="group rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-950/90 p-12 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition-all duration-500 hover:shadow-cyan-500/20 hover:border-cyan-400/50">
            <div className="mb-8 inline-flex rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-400/20 to-indigo-400/10 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-300 shadow-lg shadow-cyan-500/10">
              <span className="animate-pulse mr-2">●</span>
              CareBot Control
            </div>
            <h1 className="max-w-xl text-5xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-300 to-white leading-tight">
              Une base unique pour piloter le robot et l'équipe.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300 font-light">
              Le front a été porté sur <span className="text-cyan-300 font-semibold">TanStack Start</span>. Accédez au dashboard, connectez-vous et explorez les pages de supervision adaptées à ce projet.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to="/dashboard"
                className="group/btn relative px-8 py-4 font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-300 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/50 hover:-translate-y-1 active:translate-y-0 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 to-cyan-200 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center gap-2">
                  Ouvrir le dashboard
                  <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>

              <Link
                to="/auth/login"
                className="group/btn px-8 py-4 font-bold text-cyan-300 bg-white/5 border-2 border-cyan-400/30 rounded-xl transition-all duration-300 hover:bg-white/10 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-1 active:translate-y-0"
              >
                <span className="flex items-center justify-center gap-2">
                  Se connecter
                  <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            </div>

            <p className="mt-12 pt-8 border-t border-white/10 text-sm text-slate-400">
              Bienvenue sur le centre de contrôle <span className="text-cyan-400 font-semibold">CareBot</span> pour les maisons de retraite.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

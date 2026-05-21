import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/50 p-8 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur">
            <div className="mb-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              CareBot Control
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white xl:text-5xl">
              Une base unique pour piloter le robot et l’équipe.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Le front a été porté sur TanStack Start. Tu peux ouvrir le dashboard, te connecter et
              retrouver les pages de supervision adaptées à ce projet.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Ouvrir le dashboard
              </Link>
              <Link
                to="/auth/login"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Se connecter
              </Link>
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-lg shadow-black/20 backdrop-blur">
            <h2 className="text-xl font-semibold">Routes disponibles</h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-300">
              <li>/dashboard</li>
              <li>/auth/login</li>
              <li>/auth/signup</li>
              <li>/auth/forgot-password</li>
              <li>/control</li>
              <li>/missions</li>
              <li>/deliveries</li>
              <li>/map</li>
              <li>/meals</li>
              <li>/status</li>
              <li>/settings</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}

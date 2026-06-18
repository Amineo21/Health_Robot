import type { ReactNode } from 'react'

interface AuthShellProps {
  children: ReactNode
  eyebrow?: string
  title?: string
  description?: string
}

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(34,211,238,0.15),rgba(79,70,229,0.1),transparent_90%)] bg-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl opacity-20"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-950/90 p-8 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
            {eyebrow && (
              <div className="inline-flex rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-400/20 to-indigo-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300 shadow-lg shadow-cyan-500/10 mb-4">
                {eyebrow}
              </div>
            )}

            {title && (
              <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-300 to-white">
                {title}
              </h1>
            )}

            {description && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {description}
              </p>
            )}

            <div className={title || description ? 'mt-8' : ''}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

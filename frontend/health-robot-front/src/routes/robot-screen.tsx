import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Loader2, PackageCheck, RefreshCw } from 'lucide-react'

import { fetchRobotScreenStatus, type RobotScreenStatus } from '@/lib/robot-api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/robot-screen')({ component: RobotScreenRoute })

const TOKEN_STORAGE_KEY = 'health-robot-front:robot-screen-token'

function RobotScreenRoute() {
  const [token, setToken] = useState(() => readStoredToken())
  const [tokenInput, setTokenInput] = useState('')
  const [status, setStatus] = useState<RobotScreenStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = async (currentToken = token) => {
    if (!currentToken) return
    setIsLoading(true)
    try {
      const nextStatus = await fetchRobotScreenStatus(currentToken)
      setStatus(nextStatus)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Écran robot indisponible')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    void loadStatus(token)
    const interval = window.setInterval(() => {
      void loadStatus(token)
    }, 2000)
    return () => window.clearInterval(interval)
  }, [token])

  const submitToken = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextToken = tokenInput.trim()
    if (!nextToken) return
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setTokenInput('')
  }

  const resetToken = () => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setStatus(null)
    setError('')
  }

  const robotState = status?.robot_state ?? 'IDLE'
  const isIdle = robotState === 'IDLE'

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <form onSubmit={submitToken} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">CareBot</p>
          <h1 className="mt-3 text-3xl font-black">Écran robot</h1>
          <p className="mt-3 text-sm text-slate-400">Saisis le token dédié à l'écran robot. Il sera stocké localement sur cet appareil.</p>
          <label className="mt-6 block space-y-2 text-sm">
            <span className="text-slate-300">Robot screen token</span>
            <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white" autoFocus />
          </label>
          <button type="submit" disabled={!tokenInput.trim()} className="mt-5 w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">
            Connecter l'écran
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_30%)]" />
      <div className="relative flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-200">CareBot</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Écran robot</h1>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />}
            <button type="button" onClick={() => void loadStatus()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-3xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-5xl rounded-[2.5rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-12">
            <div className={cn('mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border', robotState === 'EMERGENCY_STOP' ? 'border-rose-300/40 bg-rose-400/15 text-rose-100' : isIdle ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-cyan-300/30 bg-cyan-400/15 text-cyan-100')}>
              {robotState === 'EMERGENCY_STOP' ? <AlertTriangle className="h-12 w-12" /> : <PackageCheck className="h-12 w-12" />}
            </div>
            <p className={cn('text-xl font-semibold uppercase tracking-[0.25em]', isIdle ? 'text-emerald-100/90' : 'text-cyan-100/80')}>{isIdle ? 'IDLE / PRÊT' : robotState}</p>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-7xl">{isIdle ? 'CareBot' : status?.screen_title_fr ?? 'CareBot'}</h2>
            <p className="mx-auto mt-6 max-w-3xl text-2xl leading-relaxed text-slate-100/85 sm:text-3xl">{status?.screen_message_fr ?? 'Chargement de l’état mission...'}</p>

            {status?.current_mission && (
              <div className="mx-auto mt-10 grid max-w-3xl gap-4 rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-left sm:grid-cols-2">
                <Info label="Fourniture" value={status.current_mission.supply_label_fr} />
                <Info label="Destination" value={status.current_mission.destination_label_fr} />
                <Info label="Mission" value={status.current_mission.id} mono />
                <Info label="Statut" value={status.current_mission.status} mono />
              </div>
            )}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Mis à jour: {status?.updated_at ? new Date(status.updated_at).toLocaleTimeString() : 'en attente'}</span>
          <button type="button" onClick={resetToken} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 transition hover:bg-white/10">Changer token</button>
        </footer>
      </div>
    </main>
  )
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={cn('mt-2 text-lg font-semibold text-white', mono && 'font-mono text-sm')}>{value}</p>
    </div>
  )
}

function readStoredToken() {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

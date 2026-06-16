import { createFileRoute } from '@tanstack/react-router'
import { Bot, CheckCircle, Clock, Loader2, Radio, Server, Wifi, XCircle } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useRobot, type ConnectionStatus } from '@/lib/robot-context'
import { CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const statusConfig: Record<ConnectionStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  connected: { icon: CheckCircle, color: 'text-emerald-200', bg: 'bg-emerald-400/10', label: 'Connected' },
  disconnected: { icon: XCircle, color: 'text-rose-200', bg: 'bg-rose-400/10', label: 'Disconnected' },
  connecting: { icon: Loader2, color: 'text-amber-200', bg: 'bg-amber-400/10', label: 'Connecting' },
}

const connectionIcons: Record<string, typeof Wifi> = {
  'Backend API': Server,
  'Robot status': Bot,
  'MQTT command bridge': Radio,
}

export const Route = createFileRoute('/status')({ component: SystemStatusRoute })

function SystemStatusRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <SystemStatusPage />
    </ProtectedRoute>
  )
}

function formatLastPing(date?: Date): string {
  if (!date) return 'Never'
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

function formatValue(value: string | number | boolean | null | undefined, unit = '') {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non'
  }
  return `${value}${unit}`
}

function formatEvent(event: unknown) {
  if (!event) {
    return 'Aucun'
  }

  if (typeof event !== 'object') {
    return String(event)
  }

  const record = event as Record<string, unknown>
  return [record.timestamp, record.status ?? record.reason, record.severity].filter(Boolean).join(' · ')
}

function SystemStatusPage() {
  const { connections, backendStatus, statusError, isStatusLoading } = useRobot()
  const allConnected = connections.every((connection) => connection.status === 'connected')

  const snapshotRows = [
    { label: 'mode', value: formatValue(backendStatus?.mode) },
    { label: 'battery_level', value: formatValue(backendStatus?.battery_level, '%') },
    { label: 'battery_status', value: formatValue(backendStatus?.battery_status) },
    { label: 'emergency_active', value: formatValue(backendStatus?.emergency_active) },
    { label: 'mission_id', value: formatValue(backendStatus?.mission_id) },
    { label: 'eta_to_base_seconds', value: formatValue(backendStatus?.eta_to_base_seconds, 's') },
    { label: 'distance_remaining_m', value: formatValue(backendStatus?.distance_remaining_m, 'm') },
    { label: 'current_speed_mps', value: formatValue(backendStatus?.current_speed_mps, ' m/s') },
    { label: 'last_battery_event', value: formatEvent(backendStatus?.last_battery_event) },
    { label: 'last_emergency_event', value: formatEvent(backendStatus?.last_emergency_event) },
  ]

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
        <p className="text-sm text-slate-400">Snapshot backend /api/robot/status avec polling toutes les 3 secondes</p>
      </div>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Backend Health</h2>
            <p className="mt-1 text-sm text-slate-400">Etat des appels frontend vers le backend FastAPI</p>
          </div>
          <span className={cn('rounded-full border px-3 py-1 text-sm font-medium', allConnected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200')}>
            {allConnected ? 'Backend reachable' : 'Backend issue'}
          </span>
        </div>

        {statusError && (
          <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {statusError}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => {
            const config = statusConfig[connection.status]
            const Icon = config.icon
            const ConnectionIcon = connectionIcons[connection.name] || Wifi

            return (
              <article key={connection.name} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 text-center">
                <div className={cn('mx-auto rounded-full p-4', config.bg)}>
                  <ConnectionIcon className={cn('h-8 w-8', config.color)} />
                </div>
                <p className="mt-3 font-semibold text-white">{connection.name}</p>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <Icon className={cn('h-4 w-4', config.color, connection.status === 'connecting' && 'animate-spin')} />
                  <span className={cn('text-sm', config.color)}>{config.label}</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3 w-3" /> Last ping: {formatLastPing(connection.lastPing)}
                </div>
              </article>
            )
          })}
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Robot Status Snapshot</h2>
            <p className="mt-1 text-sm text-slate-400">Données exposées par le backend MVP</p>
          </div>
          {isStatusLoading && <span className="text-sm text-cyan-200">Actualisation...</span>}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {snapshotRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm">
              <span className="font-mono text-slate-400">{row.label}</span>
              <span className="text-right font-medium text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

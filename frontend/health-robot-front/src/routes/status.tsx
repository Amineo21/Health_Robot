import { createFileRoute } from '@tanstack/react-router'
import { Bot, CheckCircle, Clock, Loader2, Radio, Server, Wifi, XCircle } from 'lucide-react'

import { useRobot, type ConnectionStatus } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

const statusConfig: Record<ConnectionStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  connected: { icon: CheckCircle, color: 'text-emerald-200', bg: 'bg-emerald-400/10', label: 'Connected' },
  disconnected: { icon: XCircle, color: 'text-rose-200', bg: 'bg-rose-400/10', label: 'Disconnected' },
  connecting: { icon: Loader2, color: 'text-amber-200', bg: 'bg-amber-400/10', label: 'Connecting' },
}

const connectionIcons: Record<string, typeof Wifi> = {
  ROS2: Server,
  'MQTT Broker': Radio,
  Robot: Bot,
  'WebSocket Server': Wifi,
}

function formatLastPing(date?: Date): string {
  if (!date) return 'Never'
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export const Route = createFileRoute('/status')({ component: SystemStatusPage })

function SystemStatusPage() {
  const { connections, telemetry } = useRobot()
  const allConnected = connections.every((connection) => connection.status === 'connected')

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
        <p className="text-sm text-slate-400">Monitor system connections and health</p>
      </div>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">System Health</h2>
            <p className="mt-1 text-sm text-slate-400">Overall status of all connected systems</p>
          </div>
          <span className={cn('rounded-full border px-3 py-1 text-sm font-medium', allConnected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200')}>
            {allConnected ? 'All Systems Operational' : 'System Issues Detected'}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Connection Details</h2>
          <p className="mt-2 text-sm text-slate-400">Technical connection information</p>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">ROS2 Bridge</span>
              <span className="font-mono text-slate-400">ws://localhost:9090</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">MQTT Broker</span>
              <span className="font-mono text-slate-400">mqtt://broker:1883</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">Robot IP</span>
              <span className="font-mono text-slate-400">192.168.1.100</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-medium">WebSocket Server</span>
              <span className="font-mono text-slate-400">ws://localhost:8080</span>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">System Metrics</h2>
          <p className="mt-2 text-sm text-slate-400">Real-time performance indicators</p>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">Connection Quality</span>
              <span className={cn('rounded-full px-3 py-1 font-mono', telemetry.connectionQuality > 80 ? 'bg-emerald-400/10 text-emerald-200' : telemetry.connectionQuality > 50 ? 'bg-amber-400/10 text-amber-200' : 'bg-rose-400/10 text-rose-200')}>
                {Math.round(telemetry.connectionQuality)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">Latency</span>
              <span className="font-mono text-slate-400">12ms</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2">
              <span className="font-medium">Packet Loss</span>
              <span className="font-mono text-slate-400">0.1%</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-medium">Uptime</span>
              <span className="font-mono text-slate-400">4h 32m</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
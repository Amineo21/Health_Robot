'use client'

import { Battery, Bot, Gauge, MapPin } from 'lucide-react'

import { useRobot, type RobotStatus } from '@/lib/robot-context'

const statusConfig: Record<RobotStatus, { label: string; color: string; accent: string; badge: string }> = {
  idle: { label: 'Idle', color: 'text-slate-300', accent: 'bg-white/10', badge: 'status-idle' },
  moving: { label: 'Moving', color: 'text-cyan-200', accent: 'bg-cyan-400/10', badge: 'status-online' },
  charging: { label: 'Charging', color: 'text-amber-200', accent: 'bg-amber-400/10', badge: 'status-warning' },
  delivering: { label: 'Delivering', color: 'text-emerald-200', accent: 'bg-emerald-400/10', badge: 'status-online' },
}

export function RobotStatusCard() {
  const { status, telemetry } = useRobot()
  const config = statusConfig[status]

  return (
    <article className="card-elevated animate-slide-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Robot Status</p>
          <div className="mt-2 flex items-center gap-2">
            <p className={`text-3xl font-black ${config.color}`}>{config.label}</p>
            <div className={`${config.badge} w-fit`}>
              <div className="h-2 w-2 rounded-full bg-current animate-pulse"></div>
              <span className="text-xs">Live</span>
            </div>
          </div>
        </div>
        <div className={`stat-icon-wrapper ${config.accent}`}>
          <Bot className={`h-6 w-6 ${config.color}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="card-base border-white/5 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Battery className="h-4 w-4" />
            <span className="text-sm font-medium">Battery</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{Math.round(telemetry.battery)}%</p>
          <div className="mt-2 h-1 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${telemetry.battery}%` }}
            />
          </div>
        </div>

        <div className="card-base border-white/5 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Gauge className="h-4 w-4" />
            <span className="text-sm font-medium">Speed</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{telemetry.speed.toFixed(2)} m/s</p>
          <p className="mt-2 text-xs text-slate-400">Max: 1.5 m/s</p>
        </div>

        <div className="card-base border-white/5 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium">Position</span>
          </div>
          <p className="mt-3 text-sm font-medium text-white">
            Floor {telemetry.position.floor}
          </p>
          <p className="text-xs text-slate-400">({telemetry.position.x.toFixed(1)}, {telemetry.position.y.toFixed(1)})</p>
        </div>
      </div>
    </article>
  )
}
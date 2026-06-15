'use client'

import { Battery, BellRing, Moon, Sun, User } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

export function TopBar() {
  const { telemetry, activeMission, alerts, status } = useRobot()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-slate-950/80 px-4 text-white backdrop-blur">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className="rounded-full bg-white/10 px-3 py-1 capitalize">{status}</span>
        {activeMission ? <span className="hidden sm:inline">Mission: {activeMission.destination}</span> : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1 text-xs text-slate-300 sm:flex">
          <Battery className="h-4 w-4" /> {Math.round(telemetry.battery)}%
        </span>
        <button type="button" className="relative rounded-2xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10">
          <BellRing className="h-4 w-4" />
          {alerts.length > 0 ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-400" /> : null}
        </button>
        <button type="button" className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10">
          <Sun className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10">
          <Moon className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
'use client'

import { AlertTriangle, ListTodo, Truck, Zap } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

export function StatsCards() {
  const { deliveriesToday, alerts, activeMission, telemetry } = useRobot()

  const stats = [
    {
      title: 'Deliveries Today',
      value: deliveriesToday,
      icon: Truck,
      description: 'Completed deliveries',
      color: 'text-emerald-300',
      accent: 'bg-emerald-400/10',
      badgeClass: 'badge-success',
    },
    {
      title: 'Active Mission',
      value: activeMission ? '1' : '0',
      icon: ListTodo,
      description: activeMission?.destination || 'No active mission',
      color: 'text-cyan-200',
      accent: 'bg-cyan-400/10',
      badgeClass: 'badge-primary',
    },
    {
      title: 'System Alerts',
      value: alerts.length,
      icon: AlertTriangle,
      description: alerts.length > 0 ? 'Requires attention' : 'All systems normal',
      color: alerts.length > 0 ? 'text-amber-200' : 'text-slate-200',
      accent: alerts.length > 0 ? 'bg-amber-400/10' : 'bg-white/10',
      badgeClass: alerts.length > 0 ? 'badge-warning' : 'badge-base',
    },
    {
      title: 'Connection Quality',
      value: `${Math.round(telemetry.connectionQuality)}%`,
      icon: Zap,
      description: 'Signal strength',
      color: telemetry.connectionQuality > 80 ? 'text-emerald-200' : 'text-amber-200',
      accent: telemetry.connectionQuality > 80 ? 'bg-emerald-400/10' : 'bg-amber-400/10',
      badgeClass: telemetry.connectionQuality > 80 ? 'badge-success' : 'badge-warning',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.title} className="card-elevated animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">{stat.title}</p>
              <p className={`mt-2 text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`stat-icon-wrapper ${stat.accent}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">{stat.description}</p>
        </article>
      ))}
    </div>
  )
}
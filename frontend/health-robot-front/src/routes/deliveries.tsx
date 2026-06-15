import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Clock, Package, Truck } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/deliveries')({ component: DeliveriesPage })

function DeliveriesPage() {
  const { missions, deliveriesToday } = useRobot()

  const completedMissions = missions.filter((mission) => mission.status === 'completed')
  const medicalDeliveries = completedMissions.filter((mission) => mission.type === 'medical')
  const mealDeliveries = completedMissions.filter((mission) => mission.type === 'meal')

  const stats = [
    { title: 'Total Deliveries', value: deliveriesToday, icon: Truck, color: 'text-cyan-200', bg: 'bg-cyan-400/10' },
    { title: 'Medical Deliveries', value: medicalDeliveries.length, icon: Package, color: 'text-cyan-200', bg: 'bg-cyan-400/10' },
    { title: 'Meal Deliveries', value: mealDeliveries.length, icon: Clock, color: 'text-emerald-200', bg: 'bg-emerald-400/10' },
    { title: 'Success Rate', value: '100%', icon: CheckCircle, color: 'text-emerald-200', bg: 'bg-emerald-400/10' },
  ]

  return (
    <div className="space-y-4 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliveries</h1>
        <p className="text-sm text-slate-400">Track all medical equipment and supply deliveries</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{stat.title}</p>
                <p className={cn('mt-2 text-3xl font-black', stat.color)}>{stat.value}</p>
              </div>
              <div className={cn('rounded-2xl p-3', stat.bg)}>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="text-lg font-semibold">Recent Deliveries</h2>
        <p className="mt-2 text-sm text-slate-400">Completed delivery history</p>

        <div className="mt-5 space-y-3">
          {completedMissions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">
              No completed deliveries yet
            </div>
          ) : (
            completedMissions.map((mission) => (
              <div key={mission.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-4">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', mission.type === 'medical' ? 'bg-cyan-400/10' : 'bg-emerald-400/10')}>
                    <Package className={cn('h-5 w-5', mission.type === 'medical' ? 'text-cyan-200' : 'text-emerald-200')} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{mission.destination}</p>
                    <p className="text-sm text-slate-400 capitalize">{mission.type} delivery</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">Completed</span>
                  <p className="mt-1 text-xs text-slate-500">{mission.startTime.toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  )
}
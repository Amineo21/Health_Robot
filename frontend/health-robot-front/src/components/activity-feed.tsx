'use client'

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

import { useRobot, type ActivityEvent } from '@/lib/robot-context'

const config: Record<ActivityEvent['type'], { icon: typeof Info; color: string; badge: string }> = {
  info: { icon: Info, color: 'text-cyan-200', badge: 'status-idle' },
  success: { icon: CheckCircle, color: 'text-emerald-200', badge: 'status-online' },
  warning: { icon: AlertTriangle, color: 'text-amber-200', badge: 'status-warning' },
  error: { icon: XCircle, color: 'text-rose-200', badge: 'status-error' },
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return date.toLocaleDateString()
}

export function ActivityFeed() {
  const { activityFeed } = useRobot()

  return (
    <article className="card-elevated h-full flex flex-col animate-fade-in">
      <div>
        <p className="text-sm text-slate-400">Live Activity</p>
        <h3 className="mt-2 text-xl font-semibold text-white">System Feed</h3>
      </div>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto scrollbar-thin">
        {activityFeed.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          activityFeed.map((event) => {
            const eventConfig = config[event.type]
            const Icon = eventConfig.icon

            return (
              <div key={event.id} className="list-item animate-slide-up">
                <Icon className={`h-4 w-4 shrink-0 ${eventConfig.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight text-white">{event.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatTimeAgo(event.timestamp)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}
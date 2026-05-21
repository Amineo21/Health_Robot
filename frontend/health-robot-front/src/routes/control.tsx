import { createFileRoute } from '@tanstack/react-router'
import { Battery, Bot, Gauge, MapPin, OctagonX, Video, Wifi } from 'lucide-react'

import { RobotJoystick } from '@/components/robot-joystick'
import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/control')({ component: ControlPage })

function ControlPage() {
  const { telemetry, status, emergencyStop } = useRobot()

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Robot Control</h1>
        <p className="text-sm text-slate-400">Manual control and telemetry monitoring</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">Manual Control</h2>
            <p className="mt-2 text-sm text-slate-400">Use the directional controls to manually navigate the robot</p>

            <div className="mt-8 flex flex-col items-center gap-6">
              <RobotJoystick />

              <button
                type="button"
                onClick={emergencyStop}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-rose-400 active:scale-95"
              >
                <OctagonX className="mr-2 h-6 w-6" />
                EMERGENCY STOP
              </button>

              <p className="max-w-md text-center text-sm text-slate-400">
                Press and hold directional buttons to move. Release to stop. Use the Emergency Stop button to immediately halt all robot operations.
              </p>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Video className="h-5 w-5" /> Camera Feed
            </h2>
            <div className="mt-4 flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-slate-950/40">
              <div className="text-center text-slate-400">
                <Bot className="mx-auto mb-3 h-16 w-16 text-slate-500/60" />
                <p>Camera feed placeholder</p>
                <p className="mt-1 text-xs text-slate-500">Connect to robot for live video stream</p>
              </div>
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-base font-semibold">Robot Telemetry</h2>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Position</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-2">
                    <p className="text-xs text-slate-500">X</p>
                    <p className="text-sm font-mono font-medium">{telemetry.position.x.toFixed(2)}m</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-2">
                    <p className="text-xs text-slate-500">Y</p>
                    <p className="text-sm font-mono font-medium">{telemetry.position.y.toFixed(2)}m</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-2">
                    <p className="text-xs text-slate-500">Floor</p>
                    <p className="text-sm font-mono font-medium">{telemetry.position.floor}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">Speed</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{telemetry.speed.toFixed(2)} m/s</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, telemetry.speed * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className={cn('h-4 w-4', telemetry.battery > 50 ? 'text-emerald-300' : telemetry.battery > 20 ? 'text-amber-300' : 'text-rose-300')} />
                    <span className="text-sm font-medium">Battery</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{Math.round(telemetry.battery)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full', telemetry.battery > 50 ? 'bg-emerald-400' : telemetry.battery > 20 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${telemetry.battery}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className={cn('h-4 w-4', telemetry.connectionQuality > 80 ? 'text-emerald-300' : telemetry.connectionQuality > 50 ? 'text-amber-300' : 'text-rose-300')} />
                    <span className="text-sm font-medium">Connection Quality</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{Math.round(telemetry.connectionQuality)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full', telemetry.connectionQuality > 80 ? 'bg-emerald-400' : telemetry.connectionQuality > 50 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${telemetry.connectionQuality}%` }} />
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-base font-semibold">Current Status</h2>
            <div className={cn('mt-4 rounded-2xl p-4 text-center', status === 'idle' && 'bg-white/5', status === 'moving' && 'bg-cyan-400/10', status === 'charging' && 'bg-amber-400/10', status === 'delivering' && 'bg-emerald-400/10')}>
              <p className={cn('text-2xl font-bold capitalize', status === 'idle' && 'text-slate-300', status === 'moving' && 'text-cyan-200', status === 'charging' && 'text-amber-200', status === 'delivering' && 'text-emerald-200')}>
                {status}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {status === 'idle' && 'Robot is standing by'}
                {status === 'moving' && 'Robot is in motion'}
                {status === 'charging' && 'Battery is charging'}
                {status === 'delivering' && 'Delivery in progress'}
              </p>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}
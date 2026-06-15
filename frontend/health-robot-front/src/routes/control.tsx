'use client'

import { createFileRoute } from '@tanstack/react-router'
import { Battery, Bot, Gauge, OctagonX, Video, Wifi } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

import { RobotJoystick } from '@/components/robot-joystick'
import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/control')({ component: ControlPage })

const CAMERA_URL = (import.meta.env.VITE_CAMERA_URL ?? 'http://10.10.220.180:8080') as string

const KEY_MAP: Record<string, 'forward' | 'backward' | 'left' | 'right'> = {
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function ControlPage() {
  const { telemetry, status, emergencyStop, sendCommand } = useRobot()
  const [cameraError, setCameraError] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!KEY_MAP[e.key] || e.repeat) return
    e.preventDefault()
    setActiveKey(e.key)
    sendCommand(KEY_MAP[e.key])
  }, [sendCommand])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!KEY_MAP[e.key]) return
    setActiveKey(null)
    sendCommand('stop')
  }, [sendCommand])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Robot Control</h1>
        <p className="text-sm text-slate-400">Contrôle manuel et supervision en temps réel</p>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">

        {/* Caméra — colonne gauche, grande */}
        <section className="lg:col-span-2">
          <article className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Video className="h-4 w-4" /> Caméra live
            </h2>
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
              {cameraError ? (
                <div className="flex h-full min-h-[300px] items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Bot className="mx-auto mb-3 h-14 w-14 text-slate-500/60" />
                    <p className="text-sm">Caméra non disponible</p>
                    <p className="mt-1 text-xs text-slate-500">Lance camera_stream.py sur le robot</p>
                    <button
                      type="button"
                      onClick={() => setCameraError(false)}
                      className="mt-3 rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 hover:bg-white/10"
                    >
                      Réessayer
                    </button>
                  </div>
                </div>
              ) : (
                <img
                  src={`${CAMERA_URL}/stream`}
                  alt="Camera feed"
                  className="h-full w-full object-cover"
                  onError={() => setCameraError(true)}
                />
              )}
            </div>
          </article>
        </section>

        {/* Colonne droite — joystick + télémétrie */}
        <aside className="flex flex-col gap-4">

          {/* Joystick + Emergency Stop */}
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="mb-5 text-base font-semibold">Contrôle manuel</h2>
            <div className="flex flex-col items-center gap-5">
              <RobotJoystick activeKey={activeKey} />
              <p className="text-xs text-slate-500">↑ ↓ ← → clavier ou boutons</p>
              <button
                type="button"
                onClick={emergencyStop}
                className="w-full inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-rose-400 active:scale-95"
              >
                <OctagonX className="mr-2 h-5 w-5" />
                ARRÊT D'URGENCE
              </button>
            </div>
          </article>

          {/* Télémétrie */}
          <article className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-semibold">Statut</h2>
              <span className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold capitalize',
                status === 'idle' && 'bg-white/10 text-slate-300',
                status === 'moving' && 'bg-cyan-400/20 text-cyan-200',
                status === 'charging' && 'bg-amber-400/20 text-amber-200',
                status === 'delivering' && 'bg-emerald-400/20 text-emerald-200',
              )}>
                {status}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">Vitesse</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{telemetry.speed.toFixed(2)} m/s</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, telemetry.speed * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className={cn('h-4 w-4', telemetry.battery > 50 ? 'text-emerald-300' : telemetry.battery > 20 ? 'text-amber-300' : 'text-rose-300')} />
                    <span className="text-sm">Batterie</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{Math.round(telemetry.battery)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full transition-all', telemetry.battery > 50 ? 'bg-emerald-400' : telemetry.battery > 20 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${telemetry.battery}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className={cn('h-4 w-4', telemetry.connectionQuality > 80 ? 'text-emerald-300' : telemetry.connectionQuality > 50 ? 'text-amber-300' : 'text-rose-300')} />
                    <span className="text-sm">Connexion</span>
                  </div>
                  <span className="text-sm font-mono text-slate-300">{Math.round(telemetry.connectionQuality)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full transition-all', telemetry.connectionQuality > 80 ? 'bg-emerald-400' : telemetry.connectionQuality > 50 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${telemetry.connectionQuality}%` }} />
                </div>
              </div>
            </div>
          </article>

        </aside>
      </div>
    </div>
  )
}

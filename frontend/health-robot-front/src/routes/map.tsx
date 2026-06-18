import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Bot, MapPin, Navigation, MousePointer2, CheckCircle } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

export const Route = createFileRoute('/map')({ component: MapPage })

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000') as string

interface MapMeta {
  resolution: number
  origin: [number, number, number]
  width?: number
  height?: number
}

function MapPage() {
  const { telemetry, activeMission, status, sendGoal, lastGoal, arrivalMessage, clearArrivalMessage } = useRobot()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mapMeta, setMapMeta] = useState<MapMeta | null>(null)
  const [mapAvailable, setMapAvailable] = useState(false)
  const imgSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/map/metadata`)
      .then((r) => r.json())
      .then((data) => {
        setMapMeta(data)
        setMapAvailable(true)
      })
      .catch(() => setMapAvailable(false))
  }, [])

  useEffect(() => {
    if (!mapAvailable || !canvasRef.current || !mapMeta) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = `${BACKEND_URL}/api/map/image`
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      imgSizeRef.current = { w: img.width, h: img.height }
      ctx.drawImage(img, 0, 0)

      const resolution = mapMeta.resolution
      const originX = mapMeta.origin[0]
      const originY = mapMeta.origin[1]
      const pose = (telemetry as any).pose ?? { x: 0, y: 0 }

      const px = Math.round((pose.x - originX) / resolution)
      const py = img.height - Math.round((pose.y - originY) / resolution)

      ctx.beginPath()
      ctx.arc(px, py, 8, 0, 2 * Math.PI)
      ctx.fillStyle = status === 'delivering' ? 'rgba(52,211,153,0.4)' : 'rgba(34,211,238,0.4)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, 2 * Math.PI)
      ctx.fillStyle = status === 'delivering' ? '#34d399' : '#22d3ee'
      ctx.fill()

      // Trajet Nav2
      const navPath = (telemetry as any).navPath as { x: number; y: number }[] | undefined
      if (navPath && navPath.length > 1) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(34,211,238,0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        navPath.forEach((p, i) => {
          const nx = Math.round((p.x - originX) / resolution)
          const ny = img.height - Math.round((p.y - originY) / resolution)
          if (i === 0) ctx.moveTo(nx, ny)
          else ctx.lineTo(nx, ny)
        })
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (lastGoal) {
        const gx = Math.round((lastGoal.x - originX) / resolution)
        const gy = img.height - Math.round((lastGoal.y - originY) / resolution)
        ctx.beginPath()
        ctx.arc(gx, gy, 6, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(251,191,36,0.4)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(gx, gy, 3, 0, 2 * Math.PI)
        ctx.fillStyle = '#fbbf24'
        ctx.fill()
      }
    }
  }, [mapAvailable, mapMeta, telemetry, status, lastGoal])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapMeta || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const pixelX = (e.clientX - rect.left) * scaleX
    const pixelY = (e.clientY - rect.top) * scaleY
    const worldX = pixelX * mapMeta.resolution + mapMeta.origin[0]
    const worldY = (canvas.height - pixelY) * mapMeta.resolution + mapMeta.origin[1]
    const rounded = { x: Math.round(worldX * 100) / 100, y: Math.round(worldY * 100) / 100 }
    sendGoal(rounded.x, rounded.y)
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Map</h1>
        <p className="text-sm text-slate-400">Real-time robot position and navigation</p>
      </div>

      {arrivalMessage && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{arrivalMessage}</span>
          </div>
          <button type="button" onClick={clearArrivalMessage} className="text-emerald-400 hover:text-white text-lg leading-none">×</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">Carte SLAM</h2>
            <p className="mt-2 text-sm text-slate-400">
              {mapAvailable ? 'Carte chargée depuis le robot' : 'Carte non disponible — lance fetch_map.sh pour la récupérer'}
            </p>

            {mapAvailable && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <MousePointer2 className="h-4 w-4" />
                Clique sur la carte pour envoyer le robot à cet endroit
                {lastGoal && <span className="ml-2 text-amber-300">→ Goal : ({lastGoal.x}m, {lastGoal.y}m)</span>}
              </p>
            )}

            <div className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-slate-950/40">
              {mapAvailable ? (
                <canvas
                  ref={canvasRef}
                  className="max-w-full cursor-crosshair"
                  style={{ imageRendering: 'pixelated' }}
                  onClick={handleCanvasClick}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Bot className="mx-auto mb-3 h-16 w-16 text-slate-500/60" />
                    <p>Carte non disponible</p>
                    <p className="mt-1 text-xs text-slate-500">Lance : <code>bash infra/fetch_map.sh</code></p>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Bot className="h-4 w-4" /> Position robot</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-center">
                <p className="text-xs text-slate-500">X</p>
                <p className="text-lg font-mono font-semibold">{((telemetry as any).pose?.x ?? 0).toFixed(2)}m</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-center">
                <p className="text-xs text-slate-500">Y</p>
                <p className="text-lg font-mono font-semibold">{((telemetry as any).pose?.y ?? 0).toFixed(2)}m</p>
              </div>
            </div>
          </article>

          {activeMission && (
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="flex items-center gap-2 text-base font-semibold"><Navigation className="h-5 w-5" /> Mission active</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Destination</span><span className="font-medium text-white">{activeMission.destination}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Type</span><span className="rounded-full border border-white/10 px-3 py-1 capitalize text-white">{activeMission.type}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Statut</span><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-cyan-200">En cours</span></div>
              </div>
            </article>
          )}

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><MapPin className="h-5 w-5" /> Légende</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><div className="h-4 w-4 rounded-full bg-cyan-300" /> Position robot</div>
              <div className="flex items-center gap-3"><div className="h-4 w-4 rounded-full bg-amber-300" /> Destination</div>
              <div className="flex items-center gap-3"><div className="h-4 w-4 rounded-full bg-emerald-300" /> En livraison</div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Compass, Crosshair, HardDrive, Layers3, Loader2, MapPinned, Play, RefreshCw, Save, Trash2 } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RobotKeyboardTeleop } from '@/components/robot-keyboard-teleop'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { canUseAdminControls, CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import {
  deleteSavedRobotMap,
  fetchCurrentRobotMap,
  fetchRobotMapMode,
  fetchSavedRobotMaps,
  loadSavedRobotMap,
  saveCurrentRobotMap,
  setPoseOrigin,
  startMappingMode,
  type RobotMapSnapshot,
  type SavedRobotMap,
} from '@/lib/robot-api'
import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/map')({ component: MapRoute })

function MapRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <MapPage />
    </ProtectedRoute>
  )
}

function MapPage() {
  const { user } = useAuth()
  const { backendStatus, statusError, refreshStatus } = useRobot()
  const [currentMap, setCurrentMap] = useState<RobotMapSnapshot | null>(null)
  const [savedMaps, setSavedMaps] = useState<SavedRobotMap[]>([])
  const [modeState, setModeState] = useState<Record<string, unknown> | null>(null)
  const [mapName, setMapName] = useState(defaultMapName)
  const [isLoading, setIsLoading] = useState(false)
  const [isActionRunning, setIsActionRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isAdmin = canUseAdminControls(user)
  const modeProgress = getModeStateText(modeState, 'progress')
  const modeError = getModeStateText(modeState, 'error')
  const modeLogTail = getModeStateText(modeState, 'log_tail')
  const hasModeFailure = modeState?.ok === false || modeProgress === 'error' || Boolean(modeError)

  const refreshMaps = async () => {
    setIsLoading(true)
    try {
      const [mapResult, savedResult, modeResult] = await Promise.allSettled([
        fetchCurrentRobotMap(),
        fetchSavedRobotMaps(),
        fetchRobotMapMode(),
      ])

      if (mapResult.status === 'fulfilled') {
        setCurrentMap(mapResult.value)
      } else if (!(mapResult.reason instanceof ApiError && mapResult.reason.status === 404)) {
        throw mapResult.reason
      }

      if (savedResult.status === 'fulfilled') {
        setSavedMaps(savedResult.value.maps)
      } else {
        throw savedResult.reason
      }

      if (modeResult.status === 'fulfilled') {
        setModeState(modeResult.value.result)
      } else {
        throw modeResult.reason
      }

      setError('')
    } catch (refreshError) {
      setError(getErrorMessage(refreshError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshMaps()
    const interval = window.setInterval(() => {
      void refreshMaps()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  const runMapAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setError('')
    setMessage('')
    setIsActionRunning(true)
    try {
      await action()
      await Promise.all([refreshMaps(), refreshStatus()])
      setMessage(successMessage)
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      setIsActionRunning(false)
    }
  }

  const handleStartMapping = () => {
    if (!window.confirm('Démarrer le mode de cartographie sur le robot ? Cela peut relancer la pile ROS active.')) return
    void runMapAction(startMappingMode, 'Mode cartographie demandé au robot')
  }

  const handleSaveMap = () => {
    void runMapAction(() => saveCurrentRobotMap(mapName), `Carte sauvegardée dans /root/maps/${sanitizeMapName(mapName)}`)
  }

  const handleLoadMap = (name: string) => {
    if (!window.confirm(`Charger la carte "é${name}" en navigation ? Cela arrête la cartographie manuelle et démarre Nav2.`)) return
    void runMapAction(() => loadSavedRobotMap(name), `Chargement de la carte ${name} demandé`)
  }

  const handleDeleteMap = (name: string) => {
    if (!window.confirm(`Supprimer la carte "é${name}" depuis /root/maps ?`)) return
    void runMapAction(() => deleteSavedRobotMap(name), `Carte ${name} supprimée`)
  }

  const handleSetPoseOrigin = () => {
    if (!window.confirm('Définir la pose du robot à l’origine de la carte (0, 0, 0) ?')) return
    void runMapAction(setPoseOrigin, 'Pose origine envoyée au robot')
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartographie du robot</h1>
          <p className="text-sm text-slate-400">Construction, sauvegarde et affichage de la carte ROS depuis le backend sécurisé.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSetPoseOrigin}
            disabled={!isAdmin || isActionRunning}
            className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Crosshair className="mr-2 h-4 w-4" /> Pose = origine
          </button>
          <button
            type="button"
            onClick={() => void refreshMaps()}
            disabled={isLoading || isActionRunning}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualiser
          </button>
        </div>
      </div>

      {(message || error || statusError) && (
        <div className={cn('rounded-3xl border p-4 text-sm', message && !error && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', (error || statusError) && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {error || statusError || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <article className="sticky top-0 z-30 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPinned className="h-5 w-5 text-cyan-200" /> Carte ROS en direct</h2>
                <p className="mt-2 text-sm text-slate-400">Affichage direct de `/map` reçu par rosbridge puis servi par le backend.</p>
              </div>
              <MapMeta map={currentMap} />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-3">
              <OccupancyGridView map={currentMap} pose={backendStatus?.pose ?? null} />
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Compass className="h-4 w-4 text-cyan-200" /> Statut cartographie</h2>
            <div className="mt-4 space-y-3 text-sm">
              <InfoRow label="Mode" value={String(modeState?.active ?? backendStatus?.mode ?? 'N/A')} />
              <InfoRow label="Progression" value={modeProgress || 'inactif'} />
              <InfoRow label="En attente" value={String(modeState?.pending ?? 'aucun')} />
              <InfoRow label="Position du robot" value={backendStatus?.pose ? `${backendStatus.pose.x.toFixed(2)}, ${backendStatus.pose.y.toFixed(2)}` : 'N/A'} />
            </div>
            {hasModeFailure && (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
                <p className="font-semibold">Erreur du robot</p>
                <p className="mt-1 text-rose-100/90">{modeError || 'Le tableau de bord du robot a signalé une erreur lors du changement de mode.'}</p>
                {modeLogTail && <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 font-mono text-[11px] text-rose-50/80">{modeLogTail}</pre>}
              </div>
            )}
          </article>

          <RobotKeyboardTeleop isAdmin={isAdmin} />

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Save className="h-4 w-4 text-emerald-200" /> Construire une carte</h2>
            <p className="mt-2 text-sm text-slate-400">Les fichiers sont sauvegardés dans le conteneur robot sous `/root/maps`.</p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Nom de map</span>
                <input
                  value={mapName}
                  onChange={(event) => setMapName(event.target.value)}
                  disabled={!isAdmin || isActionRunning}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button
                  type="button"
                  onClick={handleStartMapping}
                  disabled={!isAdmin || isActionRunning}
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="mr-2 h-4 w-4" /> Démarrer la cartographie
                </button>
                <button
                  type="button"
                  onClick={handleSaveMap}
                  disabled={!isAdmin || isActionRunning || !mapName.trim()}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Sauvegarder
                </button>
              </div>
              {!isAdmin && <p className="text-xs text-amber-200">Les actions mapping/save/load/delete sont réservées aux administrateurs.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><HardDrive className="h-4 w-4 text-cyan-200" /> Maps sauvegardées</h2>
            <div className="mt-4 space-y-3">
              {savedMaps.length === 0 && <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-center text-sm text-slate-400">Aucune map dans `/root/maps`.</p>}
              {savedMaps.map((map) => (
                <SavedMapRow
                  key={map.name}
                  map={map}
                  disabled={!isAdmin || isActionRunning}
                  onLoad={() => handleLoadMap(map.name)}
                  onDelete={() => handleDeleteMap(map.name)}
                />
              ))}
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}

function OccupancyGridView({ map, pose }: { map: RobotMapSnapshot | null; pose: { x: number; y: number; yaw?: number | null } | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !map) return

    canvas.width = map.width
    canvas.height = map.height
    const context = canvas.getContext('2d')
    if (!context) return

    const image = context.createImageData(map.width, map.height)
    for (let screenY = 0; screenY < map.height; screenY += 1) {
      const sourceY = map.height - 1 - screenY
      for (let x = 0; x < map.width; x += 1) {
        const value = map.data[sourceY * map.width + x] ?? -1
        const offset = (screenY * map.width + x) * 4
        const [r, g, b] = occupancyColor(value)
        image.data[offset] = r
        image.data[offset + 1] = g
        image.data[offset + 2] = b
        image.data[offset + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)

    if (pose) {
      const x = (pose.x - map.origin_x) / map.resolution
      const y = map.height - (pose.y - map.origin_y) / map.resolution
      if (x >= 0 && x <= map.width && y >= 0 && y <= map.height) {
        context.save()
        context.fillStyle = '#34d399'
        context.strokeStyle = '#ecfeff'
        context.lineWidth = Math.max(1, Math.min(map.width, map.height) / 90)
        context.beginPath()
        context.arc(x, y, Math.max(2, Math.min(map.width, map.height) / 35), 0, Math.PI * 2)
        context.fill()
        context.stroke()
        const yaw = pose.yaw ?? 0
        const length = Math.max(5, Math.min(map.width, map.height) / 12)
        context.beginPath()
        context.moveTo(x, y)
        context.lineTo(x + Math.cos(yaw) * length, y - Math.sin(yaw) * length)
        context.stroke()
        context.restore()
      }
    }
  }, [map, pose])

  if (!map) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
        <div>
          <Layers3 className="mx-auto mb-3 h-12 w-12 text-slate-500" />
          <p className="font-semibold text-white">Aucune OccupancyGrid reçue</p>
          <p className="mt-2">Démarre le mode mapping ou attends que le robot publie `/map`.</p>
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-auto max-h-[68vh] w-full rounded-xl bg-slate-950 [image-rendering:pixelated]"
      style={{ aspectRatio: `${map.width} / ${map.height}` }}
      aria-label="Carte occupancy grid du robot"
    />
  )
}

function SavedMapRow({ map, disabled, onLoad, onDelete }: { map: SavedRobotMap; disabled: boolean; onLoad: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-white">{map.name}</p>
          <p className="mt-1 text-xs text-slate-400">{formatBytes(map.size)} · {formatTimestamp(map.mtime)}</p>
          <p className="mt-1 text-xs text-cyan-100/80">{Object.keys(map.parts).sort().map((part) => `.${part}`).join(' ') || 'aucun fichier'}</p>
        </div>
        {!map.loadable && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-100">incomplete</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onLoad}
          disabled={disabled || !map.loadable}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="mr-1.5 h-3.5 w-3.5" /> Load
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function MapMeta({ map }: { map: RobotMapSnapshot | null }) {
  if (!map) {
    return <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">en attente</span>
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2 text-right font-mono text-xs text-slate-300">
      <p>{map.width}x{map.height} @ {map.resolution.toFixed(3)}m</p>
      <p>{(map.width * map.resolution).toFixed(2)}m x {(map.height * map.resolution).toFixed(2)}m</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-mono text-sm text-white">{value}</span>
    </div>
  )
}

function occupancyColor(value: number): [number, number, number] {
  if (value < 0) return [30, 41, 59]
  if (value === 0) return [226, 232, 240]
  const shade = Math.max(15, 210 - value * 1.8)
  return [shade, shade, shade]
}

function defaultMapName() {
  return `map_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
}

function sanitizeMapName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 80) || defaultMapName()
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(0)} KB`
}

function formatTimestamp(value: number) {
  if (!value) return 'date inconnue'
  return new Date(value * 1000).toLocaleString()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erreur map robot'
}

function getModeStateText(modeState: Record<string, unknown> | null, key: string) {
  const value = modeState?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : ''
}

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Compass, Crosshair, HardDrive, Loader2, MapPinned, Package, Play, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

import { MissionMapView } from '@/components/mission-map-view'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RobotKeyboardTeleop } from '@/components/robot-keyboard-teleop'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { canUseAdminControls, CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import {
  deleteSavedRobotMap,
  createAnnotatedPoint,
  deactivateAnnotatedPoint,
  fetchAnnotatedPoints,
  fetchCurrentRobotMap,
  fetchRobotMapMode,
  fetchSavedRobotMaps,
  fetchStockPointSupplies,
  loadSavedRobotMap,
  saveCurrentRobotMap,
  setPoseOrigin,
  startMappingMode,
  updateAnnotatedPoint,
  updateStockPointSupplies,
  type AnnotatedPoint,
  type AnnotatedPointType,
  type RobotMapSnapshot,
  type SavedRobotMap,
  type StockPointSupply,
  type SupplyType,
} from '@/lib/robot-api'
import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/map')({ component: MapRoute })

const POINT_TYPE_OPTIONS: { value: AnnotatedPointType; label: string }[] = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'DELIVERY_ROOM', label: 'Chambre de livraison' },
  { value: 'ROBOT_BASE', label: 'Base robot' },
]

const SUPPLY_OPTIONS: { value: SupplyType; label: string }[] = [
  { value: 'serviettes', label: 'Serviettes' },
  { value: 'papier_toilette', label: 'Papier toilette' },
  { value: 'gants', label: 'Gants' },
  { value: 'protections', label: 'Protections' },
  { value: 'linge', label: 'Linge' },
]

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
  const [annotatedPoints, setAnnotatedPoints] = useState<AnnotatedPoint[]>([])
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

      await refreshAnnotatedPoints()

      setError('')
    } catch (refreshError) {
      setError(getErrorMessage(refreshError))
    } finally {
      setIsLoading(false)
    }
  }

  const refreshAnnotatedPoints = async () => {
    const points = await fetchAnnotatedPoints()
    setAnnotatedPoints(points)
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
              <MissionMapView map={currentMap} pose={backendStatus?.pose ?? null} points={annotatedPoints} />
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

          <AnnotatedPointsPanel isAdmin={isAdmin} robotPose={backendStatus?.pose ?? null} onPointsChanged={refreshAnnotatedPoints} />

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

function AnnotatedPointsPanel({ isAdmin, robotPose, onPointsChanged }: { isAdmin: boolean; robotPose: { x: number; y: number; yaw?: number | null } | null; onPointsChanged: () => Promise<void> }) {
  const [points, setPoints] = useState<AnnotatedPoint[]>([])
  const [suppliesByStock, setSuppliesByStock] = useState<Record<string, StockPointSupply[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'DELIVERY_ROOM' as AnnotatedPointType, x: '0', y: '0', yaw: '0', is_active: true })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPoints = async () => {
    setIsLoading(true)
    try {
      const nextPoints = await fetchAnnotatedPoints()
      setPoints(nextPoints)
      const stockSupplies = await Promise.all(
        nextPoints
          .filter((point) => point.type === 'STOCK')
          .map(async (point) => [point.id, await fetchStockPointSupplies(point.id)] as const),
      )
      setSuppliesByStock(Object.fromEntries(stockSupplies))
      setError('')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPoints()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm({ name: '', type: 'DELIVERY_ROOM', x: '0', y: '0', yaw: '0', is_active: true })
  }

  const useRobotPose = () => {
    if (!robotPose) return
    setForm((previous) => ({
      ...previous,
      x: robotPose.x.toFixed(2),
      y: robotPose.y.toFixed(2),
      yaw: (robotPose.yaw ?? 0).toFixed(2),
    }))
  }

  const submitPoint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const x = Number(form.x)
    const y = Number(form.y)
    const yaw = Number(form.yaw)
    if (!form.name.trim() || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(yaw)) {
      setError('Renseigne un nom et des coordonnées numériques.')
      return
    }

    setMessage('')
    setError('')
    setIsSaving(true)
    try {
      const payload = { name: form.name.trim(), type: form.type, x, y, yaw, is_active: form.is_active }
      if (editingId) {
        await updateAnnotatedPoint(editingId, payload)
        setMessage('Point annoté mis à jour')
      } else {
        await createAnnotatedPoint(payload)
        setMessage('Point annoté créé')
      }
      resetForm()
      await loadPoints()
      await onPointsChanged()
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const editPoint = (point: AnnotatedPoint) => {
    setEditingId(point.id)
    setForm({
      name: point.name,
      type: point.type,
      x: String(point.x),
      y: String(point.y),
      yaw: String(point.yaw),
      is_active: point.is_active,
    })
  }

  const deactivatePoint = async (point: AnnotatedPoint) => {
    if (!window.confirm(`Désactiver le point "${point.name}" ?`)) return
    setIsSaving(true)
    setMessage('')
    setError('')
    try {
      await deactivateAnnotatedPoint(point.id)
      setMessage('Point désactivé')
      await loadPoints()
      await onPointsChanged()
    } catch (deactivateError) {
      setError(getErrorMessage(deactivateError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Package className="h-4 w-4 text-emerald-200" /> Points mission</h2>
          <p className="mt-2 text-sm text-slate-400">Stocks, chambres et base robot utilisés par le contrôle mission.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPoints()}
          disabled={isLoading || isSaving}
          className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Points
        </button>
      </div>

      {(message || error) && (
        <div className={cn('mt-4 rounded-2xl border p-3 text-sm', message && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', error && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {error || message}
        </div>
      )}

      {isAdmin ? (
        <form className="mt-5 space-y-3" onSubmit={submitPoint}>
          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Nom</span>
            <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Type</span>
            <select value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value as AnnotatedPointType }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
              {POINT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <CoordinateField label="X" value={form.x} onChange={(value) => setForm((previous) => ({ ...previous, x: value }))} />
            <CoordinateField label="Y" value={form.y} onChange={(value) => setForm((previous) => ({ ...previous, y: value }))} />
            <CoordinateField label="Yaw" value={form.yaw} onChange={(value) => setForm((previous) => ({ ...previous, yaw: value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((previous) => ({ ...previous, is_active: event.target.checked }))} className="h-4 w-4 accent-cyan-300" />
            Actif
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useRobotPose} disabled={!robotPose || isSaving} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50">
              Utiliser pose robot
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center rounded-2xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">
              {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
              {editingId ? 'Mettre à jour' : 'Créer'}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">Annuler édition</button>}
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">La création et la modification des points sont réservées aux administrateurs.</p>
      )}

      <div className="mt-5 space-y-3">
        {points.length === 0 && <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-center text-sm text-slate-400">Aucun point annoté.</p>}
        {points.map((point) => (
          <div key={point.id} className={cn('rounded-2xl border p-3', point.is_active ? 'border-white/10 bg-slate-950/40' : 'border-white/5 bg-slate-950/20 opacity-60')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{point.name}</p>
                <p className="mt-1 text-xs text-slate-400">{formatPointType(point.type)} · {point.x.toFixed(2)}, {point.y.toFixed(2)}, yaw {point.yaw.toFixed(2)}</p>
              </div>
              <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', point.is_active ? 'bg-emerald-400/10 text-emerald-100' : 'bg-slate-400/10 text-slate-300')}>{point.is_active ? 'actif' : 'inactif'}</span>
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => editPoint(point)} disabled={isSaving} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">Éditer</button>
                <button type="button" onClick={() => void deactivatePoint(point)} disabled={isSaving || !point.is_active} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50">Désactiver</button>
              </div>
            )}
            {point.type === 'STOCK' && (
              <StockSupplyEditor point={point} supplies={suppliesByStock[point.id] ?? []} disabled={!isAdmin || isSaving} onSaved={loadPoints} />
            )}
          </div>
        ))}
      </div>
    </article>
  )
}

function StockSupplyEditor({ point, supplies, disabled, onSaved }: { point: AnnotatedPoint; supplies: StockPointSupply[]; disabled: boolean; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState<Record<SupplyType, boolean>>(() => supplySelectionFrom(supplies))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelected(supplySelectionFrom(supplies))
  }, [supplies])

  const saveSupplies = async () => {
    setIsSaving(true)
    setError('')
    try {
      await updateStockPointSupplies(
        point.id,
        SUPPLY_OPTIONS.filter((option) => selected[option.value]).map((option, index) => ({ supply_type: option.value, priority_order: index + 1, is_active: true })),
      )
      await onSaved()
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Fournitures stock</p>
      <div className="mt-3 grid gap-2">
        {SUPPLY_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(selected[option.value])}
              disabled={disabled || isSaving}
              onChange={(event) => setSelected((previous) => ({ ...previous, [option.value]: event.target.checked }))}
              className="h-4 w-4 accent-emerald-300 disabled:opacity-50"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-2 text-xs text-rose-100">{error}</p>}
      <button type="button" disabled={disabled || isSaving} onClick={() => void saveSupplies()} className="mt-3 inline-flex items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50">
        {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
        Enregistrer fournitures
      </button>
    </div>
  )
}

function CoordinateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white" />
    </label>
  )
}

function supplySelectionFrom(supplies: StockPointSupply[]) {
  return Object.fromEntries(SUPPLY_OPTIONS.map((option) => [option.value, supplies.some((supply) => supply.supply_type === option.value && supply.is_active)])) as Record<SupplyType, boolean>
}

function formatPointType(type: AnnotatedPointType) {
  return POINT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
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

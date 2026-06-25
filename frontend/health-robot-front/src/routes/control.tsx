import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, MapPinned, OctagonX, PackageCheck, RefreshCw, RotateCcw, ShieldAlert, Truck } from 'lucide-react'

import { MissionMapView } from '@/components/mission-map-view'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { canUseAdminControls, CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import {
  cancelMission,
  confirmMissionDelivery,
  confirmMissionRecovery,
  createMission,
  fetchAnnotatedPoints,
  fetchCurrentRobotMap,
  fetchMissions,
  resetEmergency,
  returnBase,
  triggerEmergencyStop,
  type AnnotatedPoint,
  type Mission,
  type MissionStatus,
  type RobotMapSnapshot,
  type SupplyType,
} from '@/lib/robot-api'
import { useRobot } from '@/lib/robot-context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/control')({ component: ControlRoute })

const SUPPLY_OPTIONS: { value: SupplyType; label: string }[] = [
  { value: 'serviettes', label: 'Serviettes' },
  { value: 'papier_toilette', label: 'Papier toilette' },
  { value: 'gants', label: 'Gants' },
  { value: 'protections', label: 'Protections' },
  { value: 'linge', label: 'Linge' },
]

const ACTIVE_STATUSES: MissionStatus[] = [
  'NAVIGATING_TO_STOCK',
  'WAITING_FOR_RECOVERY_CONFIRMATION',
  'NAVIGATING_TO_DELIVERY',
  'WAITING_FOR_DELIVERY_CONFIRMATION',
]

const CANCELLABLE_STATUSES: MissionStatus[] = ['PENDING', ...ACTIVE_STATUSES]

const STATUS_LABELS: Record<MissionStatus, string> = {
  PENDING: 'En attente',
  NAVIGATING_TO_STOCK: 'Vers le stock',
  WAITING_FOR_RECOVERY_CONFIRMATION: 'Attente récupération',
  NAVIGATING_TO_DELIVERY: 'Vers la chambre',
  WAITING_FOR_DELIVERY_CONFIRMATION: 'Attente livraison',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  FAILED: 'Échec',
}

function ControlRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <ControlPage />
    </ProtectedRoute>
  )
}

function ControlPage() {
  const { user } = useAuth()
  const { backendStatus, isStatusLoading, statusError, refreshStatus } = useRobot()
  const [missions, setMissions] = useState<Mission[]>([])
  const [deliveryRooms, setDeliveryRooms] = useState<AnnotatedPoint[]>([])
  const [missionPoints, setMissionPoints] = useState<AnnotatedPoint[]>([])
  const [currentMap, setCurrentMap] = useState<RobotMapSnapshot | null>(null)
  const [selectedSupply, setSelectedSupply] = useState<SupplyType>('gants')
  const [selectedDeliveryRoomId, setSelectedDeliveryRoomId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isActionRunning, setIsActionRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isAdmin = canUseAdminControls(user)

  const activeMission = missions.find((mission) => ACTIVE_STATUSES.includes(mission.status)) ?? null
  const queuedMissions = missions.filter((mission) => mission.status === 'PENDING')
  const statusRows = [
    { label: 'mode', value: backendStatus?.mode ?? 'N/A' },
    { label: 'emergency_active', value: backendStatus?.emergency_active ? 'Actif' : 'Inactif' },
    { label: 'mission_id', value: backendStatus?.mission_id ?? 'Aucune' },
    { label: 'battery_level', value: backendStatus?.battery_level == null ? 'N/A' : `${backendStatus.battery_level}%` },
    { label: 'pose', value: backendStatus?.pose ? `${backendStatus.pose.x.toFixed(2)}, ${backendStatus.pose.y.toFixed(2)}` : 'N/A' },
  ]

  const loadMissionData = async () => {
    setIsLoading(true)
    try {
      const [missionsResult, roomsResult, pointsResult, mapResult] = await Promise.allSettled([
        fetchMissions({ include_terminal: false }),
        fetchAnnotatedPoints({ type: 'DELIVERY_ROOM', active_only: true }),
        fetchAnnotatedPoints({ active_only: true }),
        fetchCurrentRobotMap(),
      ])

      if (missionsResult.status === 'rejected') throw missionsResult.reason
      if (roomsResult.status === 'rejected') throw roomsResult.reason
      if (pointsResult.status === 'rejected') throw pointsResult.reason

      const nextMissions = missionsResult.value
      const rooms = roomsResult.value
      setMissions(nextMissions)
      setDeliveryRooms(rooms)
      setMissionPoints(pointsResult.value)
      setSelectedDeliveryRoomId((previous) => previous || rooms[0]?.id || '')
      if (mapResult.status === 'fulfilled') {
        setCurrentMap(mapResult.value)
      } else if (!(mapResult.reason instanceof ApiError && mapResult.reason.status === 404)) {
        throw mapResult.reason
      }
      setError('')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMissionData()
    const interval = window.setInterval(() => {
      void loadMissionData()
    }, 3000)
    return () => window.clearInterval(interval)
  }, [])

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setIsActionRunning(true)
    setMessage('')
    setError('')
    try {
      await action()
      await Promise.all([loadMissionData(), refreshStatus()])
      setMessage(successMessage)
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      setIsActionRunning(false)
    }
  }

  const submitMission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDeliveryRoomId) {
      setError('Crée une chambre de livraison active dans /map avant de lancer une mission.')
      return
    }
    await runAction(
      () => createMission({ supply_type: selectedSupply, delivery_room_id: selectedDeliveryRoomId }),
      'Mission créée. Le backend la démarre automatiquement si le robot est libre.',
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Mission control</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Livraisons CareBot</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Le backend possède l'état mission, choisit le stock compatible et pilote les transitions jusqu'à la confirmation humaine.</p>
        </div>
        <button type="button" onClick={() => void loadMissionData()} disabled={isLoading} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualiser
        </button>
      </div>

      {backendStatus?.emergency_active && (
        <div className="flex items-start gap-3 rounded-3xl border border-rose-400/40 bg-rose-500/15 p-4 text-sm text-rose-50 shadow-lg shadow-rose-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
          <div>
            <p className="font-bold">Urgence active</p>
            <p className="mt-1 text-rose-100/80">Aucune navigation mission ne sera publiée tant que l'arrêt d'urgence est actif.</p>
          </div>
        </div>
      )}

      {(message || error || statusError) && (
        <div className={cn('rounded-3xl border p-4 text-sm', message && !error && !statusError && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', (error || statusError) && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {error || statusError || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold"><PackageCheck className="h-5 w-5 text-emerald-200" /> Créer une mission</h2>
                <p className="mt-2 text-sm text-slate-400">Choisis une fourniture et une chambre active. Le stock est sélectionné automatiquement par le backend.</p>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-100">FIFO</span>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={submitMission}>
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Fourniture</span>
                <select value={selectedSupply} onChange={(event) => setSelectedSupply(event.target.value as SupplyType)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
                  {SUPPLY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Chambre</span>
                <select value={selectedDeliveryRoomId} onChange={(event) => setSelectedDeliveryRoomId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
                  {deliveryRooms.length === 0 && <option value="">Aucune chambre active</option>}
                  {deliveryRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={isActionRunning || !selectedDeliveryRoomId} className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
                {isActionRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                Lancer
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-xl font-bold"><MapPinned className="h-5 w-5 text-cyan-200" /> Mission active</h2>
            {activeMission ? (
              <MissionCard mission={activeMission} isActionRunning={isActionRunning} onAction={runAction} />
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-slate-400">
                <Clock3 className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                Aucune mission active. La prochaine mission en attente démarrera automatiquement si le robot est libre.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-xl font-bold">File de missions</h2>
            <div className="mt-5 space-y-3">
              {queuedMissions.length === 0 && <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-center text-sm text-slate-400">Aucune mission en attente.</p>}
              {queuedMissions.map((mission, index) => (
                <div key={mission.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">#{index + 1} · {formatSupplyLabel(mission.supply_type)} vers {mission.delivery_room_name_snapshot}</p>
                      <p className="mt-1 text-xs text-slate-500">Créée par {mission.created_by_name_snapshot} · {formatDateTime(mission.created_at)}</p>
                    </div>
                    <button type="button" disabled={isActionRunning} onClick={() => void runAction(() => cancelMission(mission.id), 'Mission annulée')} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50">
                      Annuler
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 shadow-lg shadow-rose-950/10">
            <h2 className="text-lg font-bold">Sécurité</h2>
            <p className="mt-2 text-sm text-rose-100/80">Emergency stop reste disponible aux aides-soignants et admins.</p>
            <div className="mt-5 space-y-3">
              <button type="button" disabled={isActionRunning} onClick={() => void runAction(() => triggerEmergencyStop('manual_ui_stop'), 'Emergency stop envoyé')} className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-500 px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-rose-400 disabled:opacity-60">
                <OctagonX className="mr-2 h-6 w-6" /> EMERGENCY STOP
              </button>
              {isAdmin && (
                <button type="button" disabled={isActionRunning} onClick={() => void runAction(resetEmergency, 'Emergency reset envoyé')} className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-60">
                  <ShieldAlert className="mr-2 h-4 w-4" /> Reset emergency
                </button>
              )}
              {isAdmin && (
                <button type="button" disabled={isActionRunning || Boolean(activeMission)} onClick={() => void runAction(returnBase, 'Retour base envoyé')} className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retour base explicite
                </button>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Robot status</h2>
                <p className="mt-1 text-xs text-slate-400">GET /api/robot/status</p>
              </div>
              {isStatusLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />}
            </div>
            <div className="mt-5 space-y-3">
              {statusRows.map((row) => <StatusRow key={row.label} label={row.label} value={row.value} danger={row.label === 'emergency_active' && row.value === 'Actif'} />)}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-bold"><MapPinned className="h-5 w-5 text-cyan-200" /> Points mission</h2>
            <p className="mt-2 text-sm text-slate-400">Carte opérationnelle interne: points configurés dans `/map`, robot, stock sélectionné et chambre de livraison.</p>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-2">
              <MissionMapView
                map={currentMap}
                pose={backendStatus?.pose ?? null}
                points={missionPoints}
                activeMission={activeMission}
                selectedPointId={selectedDeliveryRoomId}
                className="max-h-[360px]"
              />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-300">
              <LegendDot color="bg-emerald-300" label="Stock" />
              <LegendDot color="bg-sky-300" label="Chambre" />
              <LegendDot color="bg-amber-300" label="Base robot" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function MissionCard({ mission, isActionRunning, onAction }: { mission: Mission; isActionRunning: boolean; onAction: (action: () => Promise<unknown>, successMessage: string) => Promise<void> }) {
  return (
    <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusClass(mission.status))}>{STATUS_LABELS[mission.status]}</span>
          <h3 className="mt-4 text-2xl font-black text-white">{formatSupplyLabel(mission.supply_type)} vers {mission.delivery_room_name_snapshot}</h3>
          <p className="mt-2 text-sm text-cyan-50/80">Stock sélectionné: {mission.stock_point_name_snapshot}</p>
          <p className="mt-1 font-mono text-xs text-cyan-100/70">{mission.id}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right text-xs text-slate-300">
          <p>Créée: {formatDateTime(mission.created_at)}</p>
          {mission.started_at && <p className="mt-1">Démarrée: {formatDateTime(mission.started_at)}</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <RoutePoint title="1. Stock" name={mission.stock_point_name_snapshot} x={mission.stock_x_snapshot} y={mission.stock_y_snapshot} reached={Boolean(mission.arrived_at_stock_at)} />
        <RoutePoint title="2. Chambre" name={mission.delivery_room_name_snapshot} x={mission.delivery_x_snapshot} y={mission.delivery_y_snapshot} reached={Boolean(mission.arrived_at_delivery_at)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {mission.status === 'WAITING_FOR_RECOVERY_CONFIRMATION' && (
          <button type="button" disabled={isActionRunning} onClick={() => void onAction(() => confirmMissionRecovery(mission.id), 'Récupération confirmée. Navigation vers la chambre publiée.')} className="inline-flex items-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmer récupération
          </button>
        )}
        {mission.status === 'WAITING_FOR_DELIVERY_CONFIRMATION' && (
          <button type="button" disabled={isActionRunning} onClick={() => void onAction(() => confirmMissionDelivery(mission.id), 'Livraison confirmée. Mission terminée.')} className="inline-flex items-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmer livraison
          </button>
        )}
        {CANCELLABLE_STATUSES.includes(mission.status) && (
          <button type="button" disabled={isActionRunning} onClick={() => void onAction(() => cancelMission(mission.id), 'Mission annulée')} className="inline-flex items-center rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-60">
            Annuler mission
          </button>
        )}
      </div>
    </div>
  )
}

function RoutePoint({ title, name, x, y, reached }: { title: string; name: string; x: number; y: number; reached: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p>
          <p className="mt-2 font-semibold text-white">{name}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{x.toFixed(2)}, {y.toFixed(2)}</p>
        </div>
        {reached && <CheckCircle2 className="h-5 w-5 text-emerald-200" />}
      </div>
    </div>
  )
}

function StatusRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={cn('font-mono text-sm text-white', danger && 'font-bold text-rose-200')}>{value}</span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      <span>{label}</span>
    </div>
  )
}

function formatSupplyLabel(value: SupplyType) {
  return SUPPLY_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function statusClass(status: MissionStatus) {
  if (status === 'PENDING') return 'bg-slate-400/10 text-slate-200'
  if (status.includes('WAITING')) return 'bg-amber-400/10 text-amber-100'
  if (status.includes('NAVIGATING')) return 'bg-cyan-400/10 text-cyan-100'
  if (status === 'COMPLETED') return 'bg-emerald-400/10 text-emerald-100'
  return 'bg-rose-400/10 text-rose-100'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erreur mission'
}

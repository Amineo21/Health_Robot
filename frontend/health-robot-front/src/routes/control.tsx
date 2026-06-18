import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Battery, Camera, Crosshair, Gauge, Loader2, MapPinned, Music2, OctagonX, Play, RefreshCw, Send, ShieldAlert, SlidersHorizontal, Trash2, Upload, Video, Wifi } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { formatMapCoordinate, mapCoordinatesToPercent, mapMetadataToBounds, screenPointToMapCoordinates, type ControlMapBounds } from '@/lib/control-map'
import { commandRobotArm, deleteRobotSound, fetchRobotArmState, fetchRobotCameraSnapshot, fetchRobotSounds, navigateToPosition, playRobotSound, resetEmergency, returnBase, triggerEmergencyStop, uploadRobotSound, type RobotMapMetadata, type RobotPose, type RobotSound } from '@/lib/robot-api'
import { useRobot } from '@/lib/robot-context'
import { canUseAdminControls, CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/control')({ component: ControlRoute })

const DEFAULT_ARM_JOINTS = [90, 90, 90, 90, 90, 90]
const ARM_PRESETS = [
  { name: 'Centre', joints: [90, 90, 90, 90, 90, 90] },
  { name: 'Caméra avant', joints: [90, 60, 45, 90, 90, 90] },
  { name: 'Caméra haut', joints: [90, 30, 60, 90, 90, 90] },
]

function ControlRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <ControlPage />
    </ProtectedRoute>
  )
}

function ControlPage() {
  const { user } = useAuth()
  const { telemetry, status, backendStatus, isStatusLoading, statusError, refreshStatus } = useRobot()
  const [destination, setDestination] = useState({ x: '1.5', y: '2.3', yaw: '0', label: 'position libre' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAdmin = canUseAdminControls(user)
  const canSubmitNavigate = isValidNumberInput(destination.x) && isValidNumberInput(destination.y) && isValidNumberInput(destination.yaw) && !isSubmitting
  const statusRows = [
    { label: 'mode', value: backendStatus?.mode ?? status },
    { label: 'battery_level', value: backendStatus?.battery_level == null ? 'N/A' : `${backendStatus.battery_level}%` },
    { label: 'battery_status', value: backendStatus?.battery_status ?? 'N/A' },
    { label: 'emergency_active', value: backendStatus?.emergency_active ? 'Actif' : 'Inactif' },
    { label: 'mission_id', value: backendStatus?.mission_id ?? 'Aucune' },
    { label: 'eta_to_base_seconds', value: backendStatus?.eta_to_base_seconds == null ? 'N/A' : `${backendStatus.eta_to_base_seconds}s` },
    { label: 'distance_remaining_m', value: backendStatus?.distance_remaining_m == null ? 'N/A' : `${backendStatus.distance_remaining_m}m` },
    { label: 'current_speed_mps', value: formatSpeed(backendStatus?.current_speed_mps) },
    { label: 'pose', value: formatPose(backendStatus?.pose) },
    { label: 'map', value: formatMapMetadata(backendStatus?.map) },
    { label: 'min_obstacle_distance_m', value: backendStatus?.min_obstacle_distance_m == null ? 'N/A' : `${backendStatus.min_obstacle_distance_m.toFixed(2)}m` },
  ]

  const runCommand = async (action: () => Promise<unknown>, successMessage: string) => {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await action()
      await refreshStatus()
      setMessage(successMessage)
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : 'Commande refusée par le backend')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNavigate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmitNavigate) {
      setError('Destination invalide : renseigne x, y et yaw avec des valeurs numériques.')
      return
    }

    await runCommand(
      () =>
        navigateToPosition({
          x: Number(destination.x),
          y: Number(destination.y),
          yaw: Number(destination.yaw),
          label: destination.label || 'position libre',
        }),
      'Navigation envoyée au backend',
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contrôle du robot</h1>
        <p className="text-sm text-slate-400">Commandes API FastAPI vers MQTT. Accès direct ROS2 depuis le frontend non disponible.</p>
      </div>

      {backendStatus?.emergency_active && (
        <div className="flex items-start gap-3 rounded-3xl border border-rose-400/40 bg-rose-500/15 p-4 text-sm text-rose-50 shadow-lg shadow-rose-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
          <div>
            <p className="font-bold">Urgence active</p>
            <p className="mt-1 text-rose-100/80">Le backend indique un arrêt d'urgence actif. Le reset est réservé aux administrateurs.</p>
          </div>
        </div>
      )}

      {(message || error) && (
        <div className={cn('rounded-3xl border p-4 text-sm', message && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', error && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {message || error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <article className="sticky top-0 z-30 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">Navigation libre</h2>
            <p className="mt-2 text-sm text-slate-400">Disponible pour admin et caregiver via POST /api/robot/command/navigate.</p>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(280px,0.95fr)_1fr]">
              <RobotMapView
                map={backendStatus?.map ?? null}
                robotPose={backendStatus?.pose ?? null}
                destinationX={destination.x}
                destinationY={destination.y}
                onSelect={(point) =>
                  setDestination((previous) => ({
                    ...previous,
                    x: formatMapCoordinate(point.x),
                    y: formatMapCoordinate(point.y),
                    label: previous.label || 'position libre',
                  }))
                }
              />

              <div>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleNavigate}>
                  <NumberField label="X" value={destination.x} onChange={(value) => setDestination((previous) => ({ ...previous, x: value }))} />
                  <NumberField label="Y" value={destination.y} onChange={(value) => setDestination((previous) => ({ ...previous, y: value }))} />
                  <NumberField label="Yaw" value={destination.yaw} onChange={(value) => setDestination((previous) => ({ ...previous, yaw: value }))} />
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Label</span>
                    <input
                      value={destination.label}
                      onChange={(event) => setDestination((previous) => ({ ...previous, label: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!canSubmitNavigate}
                      className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {isSubmitting ? 'Envoi...' : 'Envoyer navigation'}
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin || isSubmitting}
                      onClick={() => void runCommand(returnBase, 'Retour à la base envoyé')}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MapPinned className="mr-2 h-4 w-4" /> Retour base
                    </button>
                  </div>
                </form>

                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  <p className="font-semibold">Carte ROS</p>
                  <p className="mt-1 text-cyan-100/80">
                    Les coordonnees viennent de la map publiee par le bridge ROS2/MQTT. Le bouton envoie ensuite la destination via le backend.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-white shadow-lg shadow-rose-950/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Actions sécurité</h3>
                  <p className="mt-1 text-sm text-rose-100/80">Emergency stop est disponible pour admin et caregiver.</p>
                </div>
                {isStatusLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void runCommand(() => triggerEmergencyStop('manual_ui_stop'), 'Emergency stop envoyé')}
                  className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-rose-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <OctagonX className="mr-2 h-6 w-6" /> EMERGENCY STOP
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void runCommand(resetEmergency, 'Emergency reset envoyé')}
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" /> Reset emergency
                  </button>
                )}
              </div>

              {!isAdmin && (
                <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                  Reset emergency est réservé aux administrateurs.
                </p>
              )}
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <CameraFeed />

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Robot Status</h2>
                <p className="mt-1 text-xs text-slate-400">GET /api/robot/status</p>
              </div>
              {isStatusLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />}
            </div>

            {statusError && (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
                {statusError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {statusRows.map((row) => (
                <StatusRow key={row.label} label={row.label} value={row.value} danger={row.label === 'emergency_active' && row.value === 'Actif'} />
              ))}
            </div>
          </article>

          <RobotArmPanel isAdmin={isAdmin} />
          <RobotSoundsPanel isAdmin={isAdmin} />

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-base font-semibold">Cache télémétrie local</h2>
            <div className="mt-5 space-y-4">
              <MetricRow icon={Gauge} label="Speed" value={`${telemetry.speed.toFixed(2)} m/s`} />
              <MetricRow icon={Battery} label="Battery" value={`${Math.round(telemetry.battery)}%`} />
              <MetricRow icon={Wifi} label="État du backend" value={`${Math.round(telemetry.connectionQuality)}%`} />
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-base font-semibold">État actuel</h2>
            <div className={cn('mt-4 rounded-2xl p-4 text-center', status === 'idle' && 'bg-white/5', status === 'moving' && 'bg-cyan-400/10', status === 'charging' && 'bg-amber-400/10', status === 'delivering' && 'bg-emerald-400/10')}>
              <p className={cn('text-2xl font-bold capitalize', status === 'idle' && 'text-slate-300', status === 'moving' && 'text-cyan-200', status === 'charging' && 'text-amber-200', status === 'delivering' && 'text-emerald-200')}>
                {backendStatus?.mode ?? status}
              </p>
              <p className="mt-1 text-sm text-slate-400">{backendStatus?.battery_status ?? 'Interrogation du backend'}</p>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}

function CameraFeed() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSnapshot = async () => {
    setError('')
    setIsLoading(true)
    try {
      const blob = await fetchRobotCameraSnapshot()
      setImageUrl(URL.createObjectURL(blob))
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : 'Camera robot indisponible')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
  }, [])

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Video className="h-5 w-5" /> Camera Feed
          </h2>
          <p className="mt-2 text-sm text-slate-400">JPEG proxifie via GET /api/robot/camera/snapshot avec JWT backend.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadSnapshot()}
          disabled={isLoading}
          className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}

      <div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
        {imageUrl ? (
          <img src={imageUrl} alt="Flux camera robot" className="h-full w-full object-contain" />
        ) : (
          <div className="text-center text-slate-400">
            <Camera className="mx-auto mb-3 h-16 w-16 text-slate-500/60" />
            <p>{isLoading ? 'Chargement camera...' : 'Snapshot camera en attente'}</p>
            <p className="mt-1 text-xs text-slate-500">Le frontend ne se connecte pas directement au robot.</p>
          </div>
        )}

        {isLoading && imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-sm text-cyan-100 backdrop-blur-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mise a jour camera
          </div>
        )}
      </div>
    </article>
  )
}

function RobotArmPanel({ isAdmin }: { isAdmin: boolean }) {
  const [joints, setJoints] = useState(DEFAULT_ARM_JOINTS)
  const [timeMs, setTimeMs] = useState('800')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadArmState = async () => {
    setError('')
    setIsLoading(true)
    try {
      const state = await fetchRobotArmState()
      setJoints(normalizeArmJoints(state.joints))
    } catch (armError) {
      setError(armError instanceof Error ? armError.message : 'Etat bras indisponible')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadArmState()
  }, [])

  const sendArmCommand = async () => {
    if (!isAdmin) {
      return
    }

    const duration = Math.round(Number(timeMs))
    if (!Number.isFinite(duration) || duration < 100 || duration > 5000) {
      setError('time_ms doit etre compris entre 100 et 5000.')
      return
    }

    setError('')
    setMessage('')
    setIsSending(true)
    try {
      const state = await commandRobotArm(joints, duration)
      setJoints(normalizeArmJoints(state.joints))
      setMessage('Commande bras envoyee')
    } catch (armError) {
      setError(armError instanceof Error ? armError.message : 'Commande bras refusee')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal className="h-5 w-5" /> Bras robot
          </h2>
          <p className="mt-2 text-sm text-slate-400">Lecture pour admin/caregiver, commande reservee admin via POST /api/robot/arm.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadArmState()}
          disabled={isLoading}
          className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Etat
        </button>
      </div>

      {(message || error) && (
        <div className={cn('mt-4 rounded-2xl border p-3 text-sm', message && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', error && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {message || error}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {joints.map((joint, index) => (
          <label key={index} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
            <span className="flex items-center justify-between gap-3 text-slate-300">
              <span>Joint {index + 1}</span>
              <span className="font-mono text-white">{joint} deg</span>
            </span>
            <input
              type="range"
              min="0"
              max="180"
              value={joint}
              disabled={!isAdmin || isSending}
              onChange={(event) => setJoints((previous) => previous.map((value, jointIndex) => (jointIndex === index ? Number(event.target.value) : value)))}
              className="mt-3 w-full accent-cyan-300 disabled:opacity-50"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        {ARM_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            disabled={!isAdmin || isSending}
            onClick={() => setJoints([...preset.joints])}
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preset.name}
          </button>
        ))}

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">time_ms</span>
          <input
            type="number"
            min="100"
            max="5000"
            step="100"
            value={timeMs}
            disabled={!isAdmin || isSending}
            onChange={(event) => setTimeMs(event.target.value)}
            className="w-28 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-white disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          disabled={!isAdmin || isSending}
          onClick={() => void sendArmCommand()}
          className="inline-flex items-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Envoyer bras
        </button>
      </div>

      {!isAdmin && <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Les commandes bras et presets sont réservés aux administrateurs.</p>}
    </article>
  )
}

function RobotSoundsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [sounds, setSounds] = useState<RobotSound[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadSounds = async () => {
    setError('')
    setIsLoading(true)
    try {
      const response = await fetchRobotSounds()
      setSounds(response.sounds)
    } catch (soundError) {
      setError(soundError instanceof Error ? soundError.message : 'Sons robot indisponibles')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSounds()
  }, [])

  const runSoundAction = async (action: () => Promise<unknown>, successMessage: string, refreshAfter = true) => {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await action()
      if (refreshAfter) {
        await loadSounds()
      }
      setMessage(successMessage)
    } catch (soundError) {
      setError(soundError instanceof Error ? soundError.message : 'Operation audio refusee')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAdmin) {
      return
    }
    if (!selectedFile) {
      setError('Choisis un fichier audio a uploader.')
      return
    }

    const name = uploadName.trim() || selectedFile.name
    await runSoundAction(() => uploadRobotSound(name, selectedFile), `Son uploade: ${name}`)
    setSelectedFile(null)
    setUploadName('')
    setFileInputKey((value) => value + 1)
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music2 className="h-5 w-5" /> Audio robot
          </h2>
          <p className="mt-2 text-sm text-slate-400">Liste et lecture pour admin/caregiver. Upload/delete reserves admin.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadSounds()}
          disabled={isLoading}
          className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </button>
      </div>

      {(message || error) && (
        <div className={cn('mt-4 rounded-2xl border p-3 text-sm', message && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', error && 'border-rose-400/30 bg-rose-400/10 text-rose-100')}>
          {message || error}
        </div>
      )}

      {isAdmin && (
        <form className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleUpload}>
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Fichier audio</span>
            <input
              key={fileInputKey}
              type="file"
              accept="audio/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null
                setSelectedFile(file)
                setUploadName(file?.name ?? '')
              }}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Nom sur le robot</span>
            <input
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="message.mp3"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting || !selectedFile}
            className="inline-flex items-center justify-center self-end rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </button>
        </form>
      )}

      {!isAdmin && <p className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Upload et suppression audio sont réservés aux administrateurs.</p>}

      <div className="mt-5 space-y-3">
        {sounds.length === 0 && !isLoading && <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">Aucun son disponible dans /root/sounds.</div>}
        {sounds.map((sound) => (
          <div key={sound.name} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div>
              <p className="font-medium text-white">{sound.name}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">{formatBytes(sound.size)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void runSoundAction(() => playRobotSound(sound.name), `Lecture demandee: ${sound.name}`, false)}
                className="inline-flex items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="mr-2 h-4 w-4" /> Play
              </button>
              {isAdmin && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void runSoundAction(() => deleteRobotSound(sound.name), `Son supprime: ${sound.name}`)}
                  className="inline-flex items-center rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function RobotMapView({
  map,
  robotPose,
  destinationX,
  destinationY,
  onSelect,
}: {
  map: RobotMapMetadata | null
  robotPose: RobotPose | null
  destinationX: string
  destinationY: string
  onSelect: (point: { x: number; y: number }) => void
}) {
  if (!map) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-white">
            <MapPinned className="h-4 w-4 text-cyan-200" /> Map ROS
          </span>
          <span className="font-mono text-xs text-amber-200">en attente MQTT</span>
        </div>
        <div className="flex aspect-[1.25] items-center justify-center rounded-3xl border border-amber-400/20 bg-slate-950/80 p-6 text-center text-sm text-slate-300">
          <div>
            <MapPinned className="mx-auto mb-3 h-10 w-10 text-amber-200/70" />
            <p className="font-semibold text-white">Map ROS non encore recue</p>
            <p className="mt-2 text-slate-400">Le bridge doit publier `/map` vers MQTT avant de choisir une destination sur la carte.</p>
          </div>
        </div>
      </div>
    )
  }

  const bounds = mapMetadataToBounds(map)
  const x = Number(destinationX)
  const y = Number(destinationY)
  const hasDestination = Number.isFinite(x) && Number.isFinite(y) && isInsideBounds(x, y, bounds)
  const destinationMarker = hasDestination ? mapCoordinatesToPercent(x, y, bounds) : null
  const robotMarker = robotPose && isInsideBounds(robotPose.x, robotPose.y, bounds) ? mapCoordinatesToPercent(robotPose.x, robotPose.y, bounds) : null
  const verticalTicks = buildMapTicks(bounds.minX, bounds.maxX)
  const horizontalTicks = buildMapTicks(bounds.minY, bounds.maxY)
  const widthMeters = map.width * map.resolution
  const heightMeters = map.height * map.resolution

  const selectFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    onSelect(screenPointToMapCoordinates(event.clientX, event.clientY, rect, bounds))
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    selectFromEvent(event)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-white">
          <MapPinned className="h-4 w-4 text-cyan-200" /> Map ROS
        </span>
        <span className="font-mono text-xs text-slate-400">
          {map.width}x{map.height} @ {map.resolution.toFixed(2)}m
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choisir une destination sur la map ROS"
        onClick={selectFromEvent}
        onContextMenu={handleContextMenu}
        className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#05070b] shadow-inner shadow-cyan-950/40 cursor-crosshair outline-none transition focus:ring-2 focus:ring-cyan-300"
        style={{ aspectRatio: `${Math.max(map.width, 1)} / ${Math.max(map.height, 1)}` }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-slate-700" aria-hidden="true">
          <defs>
            <radialGradient id="robotMapGlow" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.13)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0)" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#robotMapGlow)" />
          {verticalTicks.map((tick) => {
            const left = mapCoordinatesToPercent(tick, bounds.minY, bounds).left
            return <line key={`x-${tick}`} x1={left} x2={left} y1="0" y2="100" stroke="currentColor" strokeWidth="0.22" />
          })}
          {horizontalTicks.map((tick) => {
            const top = mapCoordinatesToPercent(bounds.minX, tick, bounds).top
            return <line key={`y-${tick}`} x1="0" x2="100" y1={top} y2={top} stroke="currentColor" strokeWidth="0.22" />
          })}
          {bounds.minX <= 0 && bounds.maxX >= 0 && (
            <line x1={mapCoordinatesToPercent(0, bounds.minY, bounds).left} x2={mapCoordinatesToPercent(0, bounds.minY, bounds).left} y1="0" y2="100" stroke="currentColor" strokeWidth="0.55" className="text-cyan-300/60" />
          )}
          {bounds.minY <= 0 && bounds.maxY >= 0 && (
            <line x1="0" x2="100" y1={mapCoordinatesToPercent(bounds.minX, 0, bounds).top} y2={mapCoordinatesToPercent(bounds.minX, 0, bounds).top} stroke="currentColor" strokeWidth="0.55" className="text-cyan-300/60" />
          )}
          <text x="97" y="48" textAnchor="end" className="fill-cyan-100 text-[4px] font-bold">+X</text>
          <text x="52" y="7" className="fill-cyan-100 text-[4px] font-bold">+Y</text>
        </svg>

        <div className="absolute left-3 top-3 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-[11px] text-slate-300 backdrop-blur">
          {bounds.minX.toFixed(2)}..{bounds.maxX.toFixed(2)}m / {bounds.minY.toFixed(2)}..{bounds.maxY.toFixed(2)}m
        </div>

        {robotMarker && (
          <div
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-100 bg-emerald-400 shadow-lg shadow-emerald-500/40"
            style={{ left: `${robotMarker.left}%`, top: `${robotMarker.top}%` }}
            title="Position robot"
          >
            <span
              className="absolute left-1/2 top-1/2 h-1.5 w-5 origin-left rounded-full bg-emerald-100"
              style={{ transform: `translateY(-50%) rotate(${robotPose?.yaw ?? 0}rad)` }}
            />
          </div>
        )}

        {destinationMarker && (
          <div
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-300 shadow-lg shadow-amber-500/40"
            style={{ left: `${destinationMarker.left}%`, top: `${destinationMarker.top}%` }}
            title="Destination selectionnee"
          >
            <span className="absolute inset-[-9px] rounded-full border border-amber-300/60" />
          </div>
        )}
      </div>
      <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <p><Crosshair className="mr-1 inline h-3.5 w-3.5 text-cyan-200" /> Clic ou clic droit = placer un pin, comme le dashboard M3 Pro.</p>
        <p>Dimensions reelles: {widthMeters.toFixed(2)}m x {heightMeters.toFixed(2)}m. Envoi final via backend securise.</p>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
      />
    </label>
  )
}

function MetricRow({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm">
      <span className="inline-flex items-center gap-2 text-slate-300">
        <Icon className="h-4 w-4 text-cyan-200" /> {label}
      </span>
      <span className="font-mono text-white">{value}</span>
    </div>
  )
}

function StatusRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-2xl border px-3 py-2 text-sm', danger ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-slate-950/40')}>
      <span className="font-mono text-xs text-slate-400">{label}</span>
      <span className={cn('text-right font-medium', danger ? 'text-rose-100' : 'text-white')}>{value}</span>
    </div>
  )
}

function formatPose(pose: RobotPose | null | undefined) {
  if (!pose) return 'N/A'
  const yaw = pose.yaw == null ? '' : ` / yaw ${pose.yaw.toFixed(2)}`
  return `${pose.x.toFixed(2)}, ${pose.y.toFixed(2)}${yaw}`
}

function formatMapMetadata(map: RobotMapMetadata | null | undefined) {
  if (!map) return 'N/A'
  return `${map.width}x${map.height} @ ${map.resolution.toFixed(2)}m`
}

function formatSpeed(speed: number | null | undefined) {
  if (speed == null || Math.abs(speed) < 0.001) return '0.00 m/s'
  return `${speed.toFixed(2)} m/s`
}

function isInsideBounds(x: number, y: number, bounds: ControlMapBounds) {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}

function buildMapTicks(min: number, max: number) {
  const start = Math.ceil(min)
  const end = Math.floor(max)
  const span = end - start
  const step = span > 24 ? Math.ceil(span / 24) : 1
  const ticks: number[] = []

  for (let value = start; value <= end; value += step) {
    ticks.push(value)
  }

  return ticks
}

function isValidNumberInput(value: string) {
  return value.trim().length > 0 && Number.isFinite(Number(value))
}

function normalizeArmJoints(joints: number[]) {
  return DEFAULT_ARM_JOINTS.map((fallback, index) => {
    const value = Number(joints[index])
    if (!Number.isFinite(value)) {
      return fallback
    }
    return Math.max(0, Math.min(180, Math.round(value)))
  })
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }
  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

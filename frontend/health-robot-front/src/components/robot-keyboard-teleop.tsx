import { useEffect, useRef, useState } from 'react'
import { Keyboard, Loader2, Square } from 'lucide-react'

import { sendTeleop } from '@/lib/robot-api'
import { buildStopTeleopPayload, buildTeleopPayload, isEditableKeyboardTarget, teleopDirectionFromKey, TELEOP_COMMAND_INTERVAL_MS, type TeleopDirection } from '@/lib/teleop'
import { cn } from '@/lib/utils'

interface RobotKeyboardTeleopProps {
  isAdmin: boolean
  title?: string
  description?: string
}

export function RobotKeyboardTeleop({
  isAdmin,
  title = 'Teleop robot',
  description = 'Conduite manuelle au clavier via le backend. Utilisable en mapping ou navigation, sans accès ROS direct depuis le navigateur.',
}: RobotKeyboardTeleopProps) {
  const [isTeleopOn, setIsTeleopOn] = useState(false)
  const [activeDirections, setActiveDirections] = useState<Set<TeleopDirection>>(() => new Set())
  const [lastPayload, setLastPayload] = useState(buildStopTeleopPayload())
  const [lastSentAt, setLastSentAt] = useState('jamais')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const activeDirectionsRef = useRef<Set<TeleopDirection>>(new Set())
  const isSendingRef = useRef(false)

  const publishTeleopPayload = async (payload = buildTeleopPayload(activeDirectionsRef.current), force = false) => {
    if (!force && isSendingRef.current) {
      return
    }

    isSendingRef.current = true
    setIsSending(true)
    try {
      await sendTeleop(payload)
      setLastPayload(payload)
      setLastSentAt(new Date().toLocaleTimeString())
      setError('')
    } catch (teleopError) {
      setError(getErrorMessage(teleopError))
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const setDirections = (next: Set<TeleopDirection>) => {
    activeDirectionsRef.current = next
    setActiveDirections(new Set(next))
  }

  const updateDirection = (direction: TeleopDirection, pressed: boolean) => {
    const next = new Set(activeDirectionsRef.current)

    if (direction === 'stop') {
      if (pressed) {
        next.clear()
        next.add('stop')
        void publishTeleopPayload(buildStopTeleopPayload(), true)
      } else {
        next.delete('stop')
      }
      setDirections(next)
      return
    }

    if (pressed) {
      next.delete('stop')
      next.add(direction)
    } else {
      next.delete(direction)
    }
    setDirections(next)
  }

  const stopTeleop = () => {
    setDirections(new Set())
    setIsTeleopOn(false)
    void publishTeleopPayload(buildStopTeleopPayload(), true)
  }

  const toggleTeleop = () => {
    if (!isAdmin) {
      return
    }
    if (isTeleopOn) {
      stopTeleop()
      return
    }
    setError('')
    setIsTeleopOn(true)
  }

  useEffect(() => {
    if (!isAdmin && isTeleopOn) {
      stopTeleop()
    }
  }, [isAdmin, isTeleopOn])

  useEffect(() => {
    if (!isTeleopOn || !isAdmin) {
      return
    }

    const tick = () => {
      void publishTeleopPayload()
    }

    tick()
    const interval = window.setInterval(tick, TELEOP_COMMAND_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
      void publishTeleopPayload(buildStopTeleopPayload(), true)
    }
  }, [isTeleopOn, isAdmin])

  useEffect(() => {
    if (!isTeleopOn || !isAdmin) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        stopTeleop()
        return
      }

      const direction = teleopDirectionFromKey(event.key)
      if (!direction) {
        return
      }

      event.preventDefault()
      updateDirection(direction, true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = teleopDirectionFromKey(event.key)
      if (!direction) {
        return
      }
      updateDirection(direction, false)
    }

    const handleBlur = () => {
      setDirections(new Set())
      void publishTeleopPayload(buildStopTeleopPayload(), true)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isTeleopOn, isAdmin])

  const payloadLabel = `${lastPayload.linear_x.toFixed(2)} m/s / ${lastPayload.angular_z.toFixed(2)} rad/s`
  const activeLabel = formatTeleopDirections(activeDirections)

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Keyboard className="h-4 w-4 text-purple-200" /> {title}</h2>
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>
        {isSending && <Loader2 className="mt-1 h-4 w-4 animate-spin text-cyan-200" />}
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}

      <button
        type="button"
        onClick={toggleTeleop}
        disabled={!isAdmin}
        className={cn(
          'mt-4 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
          isTeleopOn ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'bg-purple-400 text-slate-950 hover:bg-purple-300',
        )}
      >
        {isTeleopOn ? <Square className="mr-2 h-4 w-4" /> : <Keyboard className="mr-2 h-4 w-4" />}
        {isTeleopOn ? 'Stop teleop' : 'Activer teleop clavier'}
      </button>

      <div className="mt-4 grid gap-2 text-sm">
        <TeleopInfoRow label="Etat" value={isTeleopOn ? 'actif' : 'inactif'} />
        <TeleopInfoRow label="Touches" value={activeLabel} />
        <TeleopInfoRow label="Dernier cmd_vel" value={payloadLabel} />
        <TeleopInfoRow label="Dernier envoi" value={lastSentAt} />
      </div>

      <div className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-purple-50">
        <p className="font-semibold">Bindings AZERTY</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono text-xs font-bold text-slate-950">
          <span />
          <kbd className="rounded-xl bg-purple-200 px-3 py-2">Z / ↑</kbd>
          <span />
          <kbd className="rounded-xl bg-purple-200 px-3 py-2">Q / ←</kbd>
          <kbd className="rounded-xl bg-rose-200 px-3 py-2">Space</kbd>
          <kbd className="rounded-xl bg-purple-200 px-3 py-2">D / →</kbd>
          <span />
          <kbd className="rounded-xl bg-purple-200 px-3 py-2">S / ↓</kbd>
          <span />
        </div>
        <p className="mt-3 text-xs text-purple-100/80">Escape quitte le teleop. Le relachement des touches renvoie un zero twist.</p>
      </div>

      {!isAdmin && <p className="mt-4 text-xs text-amber-200">Teleop est réservé aux administrateurs.</p>}
    </article>
  )
}

function TeleopInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-mono text-sm text-white">{value}</span>
    </div>
  )
}

function formatTeleopDirections(directions: ReadonlySet<TeleopDirection>) {
  if (directions.size === 0) {
    return 'aucune'
  }

  const labels: Record<TeleopDirection, string> = {
    forward: 'avant',
    backward: 'arriere',
    left: 'gauche',
    right: 'droite',
    stop: 'stop',
  }

  return Array.from(directions).map((direction) => labels[direction]).join(' + ')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Commande teleop refusee'
}

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type RobotStatus = 'idle' | 'moving' | 'charging' | 'delivering'
export type MissionType = 'medical' | 'meal'
export type MissionStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export interface Mission {
  id: string
  type: MissionType
  destination: string
  status: MissionStatus
  startTime: Date
  priority: 'low' | 'medium' | 'high'
  notes?: string
  x?: number
  y?: number
}

export interface RobotTelemetry {
  position: { x: number; y: number; floor: number }
  pose?: { x: number; y: number; z: number; w: number }
  speed: number
  battery: number
  connectionQuality: number
  etaSeconds?: number
  distanceRemaining?: number
  navPath?: { x: number; y: number }[]
}

export interface ActivityEvent {
  id: string
  message: string
  timestamp: Date
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface SystemConnection {
  name: string
  status: ConnectionStatus
  lastPing?: Date
}

interface RobotContextType {
  status: RobotStatus
  telemetry: RobotTelemetry
  missions: Mission[]
  activeMission: Mission | null
  activityFeed: ActivityEvent[]
  connections: SystemConnection[]
  deliveriesToday: number
  alerts: ActivityEvent[]
  lastGoal: { x: number; y: number } | null
  arrivalMessage: string | null
  clearArrivalMessage: () => void
  addMission: (mission: Omit<Mission, 'id' | 'startTime' | 'status'>) => void
  cancelMission: (id: string) => void
  sendCommand: (command: 'forward' | 'backward' | 'left' | 'right' | 'stop') => void
  emergencyStop: () => void
  sendGoal: (x: number, y: number, destinationName?: string) => void
}

const RobotContext = createContext<RobotContextType | null>(null)

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000'
const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws'

export function useRobot() {
  const context = useContext(RobotContext)
  if (!context) throw new Error('useRobot must be used within a RobotProvider')
  return context
}

function generateId() {
  return `MSN-${Date.now().toString(36).toUpperCase()}`
}

function backendModeToStatus(mode: string): RobotStatus {
  switch (mode) {
    case 'NAVIGATING': return 'moving'
    case 'RETURNING_TO_BASE': return 'delivering'
    case 'CHARGING': return 'charging'
    case 'EMERGENCY_STOP': return 'idle'
    default: return 'idle'
  }
}

export function RobotProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RobotStatus>('idle')
  const [telemetry, setTelemetry] = useState<RobotTelemetry>({
    position: { x: 0, y: 0, floor: 1 },
    speed: 0,
    battery: 100,
    connectionQuality: 0,
  })
  const [missions, setMissions] = useState<Mission[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [connections, setConnections] = useState<SystemConnection[]>([
    { name: 'Backend', status: 'connecting' },
    { name: 'Robot', status: 'disconnected' },
  ])
  const [deliveriesToday, setDeliveriesToday] = useState(0)
  const [lastGoal, setLastGoal] = useState<{ x: number; y: number } | null>(null)
  const [arrivalMessage, setArrivalMessage] = useState<string | null>(null)
  const prevStatusRef = useRef<RobotStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)

  const activeMission = missions.find((m) => m.status === 'in-progress') ?? null
  const alerts = activityFeed.filter((e) => e.type === 'warning' || e.type === 'error')

  const addActivity = useCallback((message: string, type: ActivityEvent['type'] = 'info') => {
    setActivityFeed((prev) => [
      { id: Date.now().toString(), message, timestamp: new Date(), type },
      ...prev.slice(0, 49),
    ])
  }, [])

  // WebSocket connection to backend
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      setConnections([
        { name: 'Backend', status: 'connecting' },
        { name: 'Robot', status: 'disconnected' },
      ])

      ws.onopen = () => {
        setConnections([
          { name: 'Backend', status: 'connected', lastPing: new Date() },
          { name: 'Robot', status: 'connected', lastPing: new Date() },
        ])
        addActivity('Connecté au backend', 'success')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setStatus(backendModeToStatus(data.mode))
          setTelemetry((prev) => ({
            ...prev,
            battery: data.battery_level ?? prev.battery,
            speed: data.current_speed_mps ?? prev.speed,
            etaSeconds: data.eta_to_base_seconds,
            distanceRemaining: data.distance_remaining_m,
            pose: data.pose ?? prev.pose,
            navPath: data.nav_path ?? prev.navPath,
          }))
          setConnections([
            { name: 'Backend', status: 'connected', lastPing: new Date() },
            { name: 'Robot', status: data.emergency_active ? 'disconnected' : 'connected', lastPing: new Date() },
          ])
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        setConnections([
          { name: 'Backend', status: 'disconnected' },
          { name: 'Robot', status: 'disconnected' },
        ])
        addActivity('Connexion perdue, reconnexion...', 'warning')
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [addActivity])

  // Détection arrivée : moving → idle avec un goal actif
  useEffect(() => {
    if (prevStatusRef.current === 'moving' && status === 'idle' && lastGoal) {
      setArrivalMessage(`Robot arrivé à destination (${lastGoal.x}m, ${lastGoal.y}m)`)
      setLastGoal(null)
    }
    prevStatusRef.current = status
  }, [status, lastGoal])

  const clearArrivalMessage = useCallback(() => setArrivalMessage(null), [])

  const sendGoal = useCallback(async (x: number, y: number, destinationName?: string) => {
    const missionId = generateId()
    try {
      // Annule le goal précédent s'il y en a un
      await fetch(`${BACKEND_URL}/api/navigation/cancel`, { method: 'POST' })
      await fetch(`${BACKEND_URL}/api/navigation/goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, mission_id: missionId, destination_name: destinationName }),
      })
      setLastGoal({ x, y })
      addActivity(`Goal envoyé : ${destinationName ?? `(${x}, ${y})`}`, 'info')
    } catch {
      addActivity('Erreur envoi goal navigation', 'error')
    }
  }, [addActivity])

  const addMission = useCallback(
    async (mission: Omit<Mission, 'id' | 'startTime' | 'status'>) => {
      const newMission: Mission = {
        ...mission,
        id: generateId(),
        startTime: new Date(),
        status: 'pending',
      }
      setMissions((prev) => [newMission, ...prev])
      addActivity(`Nouvelle mission créée pour ${mission.destination}`, 'info')

      if (mission.x !== undefined && mission.y !== undefined) {
        await sendGoal(mission.x, mission.y, mission.destination)
      }

      setMissions((prev) =>
        prev.map((m) => (m.id === newMission.id ? { ...m, status: 'in-progress' } : m)),
      )
    },
    [addActivity, sendGoal],
  )

  const cancelMission = useCallback(
    async (id: string) => {
      try {
        await fetch(`${BACKEND_URL}/api/safety/emergency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'ui', reason: `Mission ${id} annulée par l'opérateur`, requires_admin_restart: false }),
        })
      } catch {
        // best-effort
      }
      setMissions((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'cancelled' } : m)))
      addActivity(`Mission ${id} annulée`, 'warning')
    },
    [addActivity],
  )

  const sendCommand = useCallback(
    async (command: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
      try {
        await fetch(`${BACKEND_URL}/api/robot/cmd_vel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        })
      } catch {
        addActivity('Erreur envoi commande manuelle', 'error')
      }
    },
    [addActivity],
  )

  const emergencyStop = useCallback(async () => {
    await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/safety/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'ui', reason: "Arrêt d'urgence déclenché depuis l'interface", requires_admin_restart: true }),
      }),
      fetch(`${BACKEND_URL}/api/navigation/cancel`, { method: 'POST' }),
    ])
    setStatus('idle')
    setLastGoal(null)
    setMissions((prev) => prev.map((m) => (m.status === 'in-progress' ? { ...m, status: 'cancelled' } : m)))
    addActivity("ARRÊT D'URGENCE ACTIVÉ", 'error')
  }, [addActivity])

  return (
    <RobotContext.Provider
      value={{
        status,
        telemetry,
        missions,
        activeMission,
        activityFeed,
        connections,
        deliveriesToday,
        alerts,
        lastGoal,
        arrivalMessage,
        clearArrivalMessage,
        addMission,
        cancelMission,
        sendCommand,
        emergencyStop,
        sendGoal,
      }}
    >
      {children}
    </RobotContext.Provider>
  )
}

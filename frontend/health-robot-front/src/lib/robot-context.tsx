'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { fetchRobotStatus, sendTeleop, triggerEmergencyStop, type RobotStatusSnapshot } from './robot-api'

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
}

export interface RobotTelemetry {
  position: { x: number; y: number; floor: number }
  speed: number
  battery: number
  connectionQuality: number
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
  backendStatus: RobotStatusSnapshot | null
  isStatusLoading: boolean
  statusError: string | null
  telemetry: RobotTelemetry
  missions: Mission[]
  activeMission: Mission | null
  activityFeed: ActivityEvent[]
  connections: SystemConnection[]
  deliveriesToday: number
  alerts: ActivityEvent[]
  refreshStatus: () => Promise<void>
  addMission: (mission: Omit<Mission, 'id' | 'startTime' | 'status'>) => void
  cancelMission: (id: string) => void
  sendCommand: (command: 'forward' | 'backward' | 'left' | 'right' | 'stop') => Promise<void>
  emergencyStop: () => Promise<void>
}

const RobotContext = createContext<RobotContextType | null>(null)

const initialConnections: SystemConnection[] = [
  { name: 'Backend API', status: 'connecting' },
  { name: 'Robot status', status: 'connecting' },
  { name: 'MQTT command bridge', status: 'connecting' },
]

export function useRobot() {
  const context = useContext(RobotContext)

  if (!context) {
    throw new Error('useRobot must be used within a RobotProvider')
  }

  return context
}

function generateId() {
  return `MSN-${Date.now().toString(36).toUpperCase()}`
}

function mapBackendMode(snapshot: RobotStatusSnapshot | null): RobotStatus {
  if (!snapshot) {
    return 'idle'
  }

  const mode = snapshot.mode.toLowerCase()
  if (mode.includes('charge')) {
    return 'charging'
  }
  if (mode.includes('deliver')) {
    return 'delivering'
  }
  if (mode.includes('move') || mode.includes('nav') || mode.includes('return')) {
    return 'moving'
  }
  return 'idle'
}

function teleopPayloadForCommand(command: 'forward' | 'backward' | 'left' | 'right' | 'stop') {
  switch (command) {
    case 'forward':
      return { linear_x: 0.1, angular_z: 0, duration_ms: 300 }
    case 'backward':
      return { linear_x: -0.1, angular_z: 0, duration_ms: 300 }
    case 'left':
      return { linear_x: 0, angular_z: 0.2, duration_ms: 300 }
    case 'right':
      return { linear_x: 0, angular_z: -0.2, duration_ms: 300 }
    case 'stop':
      return { linear_x: 0, angular_z: 0, duration_ms: 300 }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erreur backend robot'
}

function normalizeSpeed(speed: number | null) {
  if (speed == null || Math.abs(speed) < 0.001) {
    return 0
  }
  return speed
}

export function RobotProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [backendStatus, setBackendStatus] = useState<RobotStatusSnapshot | null>(null)
  const [isStatusLoading, setIsStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<RobotTelemetry>({
    position: { x: 0, y: 0, floor: 1 },
    speed: 0,
    battery: 0,
    connectionQuality: 0,
  })
  const [missions, setMissions] = useState<Mission[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [connections, setConnections] = useState<SystemConnection[]>(initialConnections)
  const [deliveriesToday, setDeliveriesToday] = useState(0)

  const status = mapBackendMode(backendStatus)
  const activeMission = missions.find((mission) => mission.status === 'in-progress') || null
  const alerts = activityFeed.filter((entry) => entry.type === 'warning' || entry.type === 'error')

  const addActivity = useCallback((message: string, type: ActivityEvent['type'] = 'info') => {
    const event: ActivityEvent = {
      id: Date.now().toString(),
      message,
      timestamp: new Date(),
      type,
    }

    setActivityFeed((previous) => [event, ...previous.slice(0, 49)])
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setBackendStatus(null)
      setTelemetry((previous) => ({ ...previous, speed: 0, battery: 0, connectionQuality: 0 }))
      setConnections(initialConnections)
      return
    }

    setIsStatusLoading(true)
    try {
      const snapshot = await fetchRobotStatus()
      const now = new Date()
      setBackendStatus(snapshot)
      setStatusError(null)
      setTelemetry((previous) => ({
        ...previous,
        position: snapshot.pose ? { ...previous.position, x: snapshot.pose.x, y: snapshot.pose.y } : previous.position,
        speed: normalizeSpeed(snapshot.current_speed_mps),
        battery: snapshot.battery_level,
        connectionQuality: 100,
      }))
      setConnections([
        { name: 'Backend API', status: 'connected', lastPing: now },
        { name: 'Robot status', status: 'connected', lastPing: now },
        { name: 'MQTT command bridge', status: 'connected', lastPing: now },
      ])
    } catch (error) {
      setStatusError(getErrorMessage(error))
      setConnections((previous) =>
        previous.map((connection) => ({
          ...connection,
          status: 'disconnected',
        })),
      )
    } finally {
      setIsStatusLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    void refreshStatus()
    const interval = window.setInterval(() => {
      void refreshStatus()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isAuthenticated, refreshStatus])

  const addMission = useCallback(
    (mission: Omit<Mission, 'id' | 'startTime' | 'status'>) => {
      const newMission: Mission = {
        ...mission,
        id: generateId(),
        startTime: new Date(),
        status: 'pending',
      }

      setMissions((previous) => [newMission, ...previous])
      addActivity(`Mission locale créée pour ${mission.destination}`, 'info')
    },
    [addActivity],
  )

  const cancelMission = useCallback(
    (id: string) => {
      setMissions((previous) => previous.map((mission) => (mission.id === id ? { ...mission, status: 'cancelled' } : mission)))
      addActivity(`Mission ${id} annulée`, 'warning')
    },
    [addActivity],
  )

  const sendCommand = useCallback(
    async (command: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
      await sendTeleop(teleopPayloadForCommand(command))
      addActivity(`Commande téléop envoyée: ${command.toUpperCase()}`, 'info')
      await refreshStatus()
    },
    [addActivity, refreshStatus],
  )

  const emergencyStop = useCallback(async () => {
    await triggerEmergencyStop('manual_ui_stop')
    setMissions((previous) => previous.map((mission) => (mission.status === 'in-progress' ? { ...mission, status: 'cancelled' } : mission)))
    addActivity('ARRÊT D’URGENCE ACTIVÉ', 'error')
    await refreshStatus()
  }, [addActivity, refreshStatus])

  return (
    <RobotContext.Provider
      value={{
        status,
        backendStatus,
        isStatusLoading,
        statusError,
        telemetry,
        missions,
        activeMission,
        activityFeed,
        connections,
        deliveriesToday,
        alerts,
        refreshStatus,
        addMission,
        cancelMission,
        sendCommand,
        emergencyStop,
      }}
    >
      {children}
    </RobotContext.Provider>
  )
}

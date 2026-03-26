"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type RobotStatus = "idle" | "moving" | "charging" | "delivering"
export type MissionType = "medical" | "meal"
export type MissionStatus = "pending" | "in-progress" | "completed" | "cancelled"
export type ConnectionStatus = "connected" | "disconnected" | "connecting"

export interface Mission {
  id: string
  type: MissionType
  destination: string
  status: MissionStatus
  startTime: Date
  priority: "low" | "medium" | "high"
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
  type: "info" | "success" | "warning" | "error"
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
  addMission: (mission: Omit<Mission, "id" | "startTime" | "status">) => void
  cancelMission: (id: string) => void
  sendCommand: (command: "forward" | "backward" | "left" | "right" | "stop") => void
  emergencyStop: () => void
}

const RobotContext = createContext<RobotContextType | null>(null)

export function useRobot() {
  const context = useContext(RobotContext)
  if (!context) {
    throw new Error("useRobot must be used within a RobotProvider")
  }
  return context
}

// Simulated robot data for development
const simulatedRooms = [
  "Room 101", "Room 102", "Room 103", "Room 201", "Room 202", "Room 203",
  "Room 301", "Room 302", "Room 303", "Nurses Station", "Pharmacy", "Kitchen"
]

function generateId() {
  return `MSN-${Date.now().toString(36).toUpperCase()}`
}

export function RobotProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RobotStatus>("idle")
  const [telemetry, setTelemetry] = useState<RobotTelemetry>({
    position: { x: 12.5, y: 8.3, floor: 1 },
    speed: 0,
    battery: 87,
    connectionQuality: 95,
  })
  const [missions, setMissions] = useState<Mission[]>([
    {
      id: "MSN-001",
      type: "medical",
      destination: "Room 203",
      status: "completed",
      startTime: new Date(Date.now() - 3600000),
      priority: "high",
    },
    {
      id: "MSN-002",
      type: "meal",
      destination: "Room 102",
      status: "completed",
      startTime: new Date(Date.now() - 1800000),
      priority: "medium",
    },
    {
      id: "MSN-003",
      type: "medical",
      destination: "Room 301",
      status: "in-progress",
      startTime: new Date(Date.now() - 300000),
      priority: "high",
      notes: "Urgent medication delivery",
    },
  ])
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([
    {
      id: "1",
      message: "Robot delivered medical kit to Room 203",
      timestamp: new Date(Date.now() - 3600000),
      type: "success",
    },
    {
      id: "2",
      message: "Meal delivery completed - Room 102",
      timestamp: new Date(Date.now() - 1800000),
      type: "success",
    },
    {
      id: "3",
      message: "Starting medical delivery to Room 301",
      timestamp: new Date(Date.now() - 300000),
      type: "info",
    },
    {
      id: "4",
      message: "Battery level optimal at 87%",
      timestamp: new Date(Date.now() - 600000),
      type: "info",
    },
  ])
  const [connections, setConnections] = useState<SystemConnection[]>([
    { name: "ROS2", status: "connected", lastPing: new Date() },
    { name: "MQTT Broker", status: "connected", lastPing: new Date() },
    { name: "Robot", status: "connected", lastPing: new Date() },
    { name: "WebSocket Server", status: "connected", lastPing: new Date() },
  ])
  const [deliveriesToday, setDeliveriesToday] = useState(12)

  const activeMission = missions.find((m) => m.status === "in-progress") || null

  const alerts = activityFeed.filter((e) => e.type === "warning" || e.type === "error")

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update telemetry
      setTelemetry((prev) => ({
        ...prev,
        position: {
          x: prev.position.x + (Math.random() - 0.5) * 0.2,
          y: prev.position.y + (Math.random() - 0.5) * 0.2,
          floor: prev.position.floor,
        },
        speed: status === "moving" || status === "delivering" ? 0.5 + Math.random() * 0.3 : 0,
        battery: Math.max(0, prev.battery - 0.01),
        connectionQuality: Math.min(100, Math.max(70, prev.connectionQuality + (Math.random() - 0.5) * 5)),
      }))

      // Update connection pings
      setConnections((prev) =>
        prev.map((c) => ({
          ...c,
          lastPing: c.status === "connected" ? new Date() : c.lastPing,
        }))
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [status])

  // Simulate status changes
  useEffect(() => {
    if (activeMission) {
      setStatus("delivering")
    } else if (telemetry.battery < 20) {
      setStatus("charging")
    } else {
      setStatus("idle")
    }
  }, [activeMission, telemetry.battery])

  const addActivity = useCallback((message: string, type: ActivityEvent["type"] = "info") => {
    const event: ActivityEvent = {
      id: Date.now().toString(),
      message,
      timestamp: new Date(),
      type,
    }
    setActivityFeed((prev) => [event, ...prev.slice(0, 49)])
  }, [])

  const addMission = useCallback(
    (mission: Omit<Mission, "id" | "startTime" | "status">) => {
      const newMission: Mission = {
        ...mission,
        id: generateId(),
        startTime: new Date(),
        status: "pending",
      }
      setMissions((prev) => [newMission, ...prev])
      addActivity(`New ${mission.type} mission created for ${mission.destination}`, "info")

      // Simulate mission starting after a delay
      setTimeout(() => {
        setMissions((prev) =>
          prev.map((m) => (m.id === newMission.id ? { ...m, status: "in-progress" } : m))
        )
        addActivity(`Robot departing for ${mission.destination}`, "info")
      }, 2000)

      // Simulate mission completion
      setTimeout(() => {
        setMissions((prev) =>
          prev.map((m) => (m.id === newMission.id ? { ...m, status: "completed" } : m))
        )
        setDeliveriesToday((prev) => prev + 1)
        addActivity(`Delivery completed at ${mission.destination}`, "success")
      }, 15000)
    },
    [addActivity]
  )

  const cancelMission = useCallback(
    (id: string) => {
      setMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m))
      )
      addActivity(`Mission ${id} cancelled`, "warning")
    },
    [addActivity]
  )

  const sendCommand = useCallback(
    (command: "forward" | "backward" | "left" | "right" | "stop") => {
      addActivity(`Manual command sent: ${command.toUpperCase()}`, "info")
      if (command !== "stop") {
        setStatus("moving")
        setTimeout(() => {
          if (!activeMission) setStatus("idle")
        }, 1000)
      } else {
        setStatus("idle")
      }
    },
    [addActivity, activeMission]
  )

  const emergencyStop = useCallback(() => {
    setStatus("idle")
    setMissions((prev) =>
      prev.map((m) => (m.status === "in-progress" ? { ...m, status: "cancelled" } : m))
    )
    addActivity("EMERGENCY STOP ACTIVATED", "error")
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

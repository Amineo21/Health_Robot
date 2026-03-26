"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRobot, type ConnectionStatus } from "@/lib/robot-context"
import { 
  Wifi, 
  Server, 
  Bot, 
  Radio, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

const statusConfig: Record<ConnectionStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  connected: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Connected" },
  disconnected: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Disconnected" },
  connecting: { icon: Loader2, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Connecting" },
}

const connectionIcons: Record<string, typeof Wifi> = {
  "ROS2": Server,
  "MQTT Broker": Radio,
  "Robot": Bot,
  "WebSocket Server": Wifi,
}

function formatLastPing(date?: Date): string {
  if (!date) return "Never"
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 5) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function SystemStatusPage() {
  const { connections, telemetry } = useRobot()

  const allConnected = connections.every((c) => c.status === "connected")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
        <p className="text-muted-foreground">
          Monitor system connections and health
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Overall status of all connected systems</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-sm",
                allConnected
                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              )}
            >
              {allConnected ? "All Systems Operational" : "System Issues Detected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {connections.map((connection) => {
              const config = statusConfig[connection.status]
              const Icon = config.icon
              const ConnectionIcon = connectionIcons[connection.name] || Wifi

              return (
                <Card key={connection.name} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={cn("rounded-full p-4", config.bg)}>
                        <ConnectionIcon className={cn("h-8 w-8", config.color)} />
                      </div>
                      <div>
                        <p className="font-semibold">{connection.name}</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <Icon className={cn(
                            "h-4 w-4",
                            config.color,
                            connection.status === "connecting" && "animate-spin"
                          )} />
                          <span className={cn("text-sm", config.color)}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last ping: {formatLastPing(connection.lastPing)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>Technical connection information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">ROS2 Bridge</span>
                <span className="text-sm text-muted-foreground font-mono">ws://localhost:9090</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">MQTT Broker</span>
                <span className="text-sm text-muted-foreground font-mono">mqtt://broker:1883</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Robot IP</span>
                <span className="text-sm text-muted-foreground font-mono">192.168.1.100</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">WebSocket Server</span>
                <span className="text-sm text-muted-foreground font-mono">ws://localhost:8080</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
            <CardDescription>Real-time performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Connection Quality</span>
                <Badge
                  variant="outline"
                  className={cn(
                    telemetry.connectionQuality > 80
                      ? "bg-green-500/10 text-green-500"
                      : telemetry.connectionQuality > 50
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-red-500/10 text-red-500"
                  )}
                >
                  {Math.round(telemetry.connectionQuality)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Latency</span>
                <span className="text-sm text-muted-foreground font-mono">12ms</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Packet Loss</span>
                <span className="text-sm text-muted-foreground font-mono">0.1%</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">Uptime</span>
                <span className="text-sm text-muted-foreground font-mono">4h 32m</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { Bot, Battery, Gauge, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useRobot, type RobotStatus } from "@/lib/robot-context"
import { cn } from "@/lib/utils"

const statusConfig: Record<RobotStatus, { label: string; color: string; bgColor: string }> = {
  idle: { label: "Idle", color: "text-muted-foreground", bgColor: "bg-muted" },
  moving: { label: "Moving", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  charging: { label: "Charging", color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  delivering: { label: "Delivering", color: "text-green-500", bgColor: "bg-green-500/10" },
}

export function RobotStatusCard() {
  const { status, telemetry } = useRobot()
  const config = statusConfig[status]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Robot Status</CardTitle>
        <Bot className={cn("h-4 w-4", config.color)} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", config.bgColor)}>
            <Bot className={cn("h-6 w-6", config.color)} />
          </div>
          <div>
            <p className={cn("text-2xl font-bold", config.color)}>{config.label}</p>
            <p className="text-xs text-muted-foreground">Current state</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Battery</span>
            </div>
            <span className="text-sm font-medium">{Math.round(telemetry.battery)}%</span>
          </div>
          <Progress value={telemetry.battery} className="h-2" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Speed</span>
            </div>
            <span className="text-sm font-medium">{telemetry.speed.toFixed(2)} m/s</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Position</span>
            </div>
            <span className="text-sm font-medium">
              Floor {telemetry.position.floor} ({telemetry.position.x.toFixed(1)}, {telemetry.position.y.toFixed(1)})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

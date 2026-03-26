"use client"

import { useTheme } from "next-themes"
import { Battery, Wifi, Moon, Sun, User, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useRobot } from "@/lib/robot-context"
import { cn } from "@/lib/utils"

function StatusIndicator({ connected, label }: { connected: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          connected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>
    </div>
  )
}

function BatteryIndicator({ level }: { level: number }) {
  const getBatteryColor = () => {
    if (level > 50) return "text-green-500"
    if (level > 20) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <div className="flex items-center gap-1.5">
      <Battery className={cn("h-4 w-4", getBatteryColor())} />
      <span className="text-xs font-medium">{Math.round(level)}%</span>
    </div>
  )
}

export function TopBar() {
  const { setTheme, theme } = useTheme()
  const { telemetry, connections, activeMission, alerts, status } = useRobot()

  const robotConnection = connections.find((c) => c.name === "Robot")
  const mqttConnection = connections.find((c) => c.name === "MQTT Broker")

  const statusColors: Record<string, string> = {
    idle: "bg-muted text-muted-foreground",
    moving: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    charging: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    delivering: "bg-green-500/10 text-green-500 border-green-500/20",
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      
      <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
        <div className="hidden xs:flex items-center gap-2 sm:gap-3">
          <StatusIndicator
            connected={robotConnection?.status === "connected"}
            label="Robot"
          />
          <StatusIndicator
            connected={mqttConnection?.status === "connected"}
            label="MQTT"
          />
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <BatteryIndicator level={telemetry.battery} />
        </div>

        <Badge variant="outline" className={cn("capitalize text-[10px] sm:text-xs shrink-0", statusColors[status])}>
          {status}
        </Badge>

        {activeMission && (
          <div className="hidden md:flex items-center gap-2 text-sm truncate">
            <span className="text-muted-foreground">Mission:</span>
            <span className="font-medium truncate">{activeMission.destination}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <BellRing className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {alerts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No alerts
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <DropdownMenuItem key={alert.id} className="flex flex-col items-start gap-1">
                  <span className="text-sm">{alert.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {alert.timestamp.toLocaleTimeString()}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Nurse Station 1</DropdownMenuItem>
            <DropdownMenuItem>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Log Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

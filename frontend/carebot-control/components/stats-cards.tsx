"use client"

import { Truck, AlertTriangle, ListTodo, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRobot } from "@/lib/robot-context"

export function StatsCards() {
  const { deliveriesToday, alerts, activeMission, telemetry } = useRobot()

  const stats = [
    {
      title: "Deliveries Today",
      value: deliveriesToday,
      icon: Truck,
      description: "Completed deliveries",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Active Mission",
      value: activeMission ? "1" : "0",
      icon: ListTodo,
      description: activeMission?.destination || "No active mission",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "System Alerts",
      value: alerts.length,
      icon: AlertTriangle,
      description: alerts.length > 0 ? "Requires attention" : "All systems normal",
      color: alerts.length > 0 ? "text-yellow-500" : "text-muted-foreground",
      bgColor: alerts.length > 0 ? "bg-yellow-500/10" : "bg-muted",
    },
    {
      title: "Connection Quality",
      value: `${Math.round(telemetry.connectionQuality)}%`,
      icon: Zap,
      description: "Signal strength",
      color: telemetry.connectionQuality > 80 ? "text-green-500" : "text-yellow-500",
      bgColor: telemetry.connectionQuality > 80 ? "bg-green-500/10" : "bg-yellow-500/10",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`rounded-md p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

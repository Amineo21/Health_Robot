"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRobot } from "@/lib/robot-context"
import { Package, Truck, Clock, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DeliveriesPage() {
  const { missions, deliveriesToday } = useRobot()

  const completedMissions = missions.filter((m) => m.status === "completed")
  const medicalDeliveries = completedMissions.filter((m) => m.type === "medical")
  const mealDeliveries = completedMissions.filter((m) => m.type === "meal")

  const stats = [
    {
      title: "Total Deliveries",
      value: deliveriesToday,
      icon: Truck,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Medical Deliveries",
      value: medicalDeliveries.length,
      icon: Package,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Meal Deliveries",
      value: mealDeliveries.length,
      icon: Clock,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      title: "Success Rate",
      value: "100%",
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Deliveries</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Track all medical equipment and supply deliveries
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
              <div className={cn("rounded-md p-1.5 sm:p-2", stat.bg)}>
                <stat.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={cn("text-xl sm:text-2xl font-bold", stat.color)}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
          <CardDescription>Completed delivery history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {completedMissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No completed deliveries yet
              </div>
            ) : (
              completedMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        mission.type === "medical" ? "bg-blue-500/10" : "bg-green-500/10"
                      )}
                    >
                      <Package
                        className={cn(
                          "h-5 w-5",
                          mission.type === "medical" ? "text-blue-500" : "text-green-500"
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-medium">{mission.destination}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {mission.type} delivery
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      Completed
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mission.startTime.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

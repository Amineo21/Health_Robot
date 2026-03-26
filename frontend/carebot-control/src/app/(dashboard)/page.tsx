"use client"

import { RobotStatusCard } from "@/components/robot-status-card"
import { ActivityFeed } from "@/components/activity-feed"
import { StatsCards } from "@/components/stats-cards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRobot } from "@/lib/robot-context"
import { Play, Square, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { activeMission, missions } = useRobot()
  const recentMissions = missions.slice(0, 3)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor and control your CareBot assistance robot
        </p>
      </div>

      <StatsCards />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <RobotStatusCard />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Missions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/missions" className="flex items-center gap-1">
                  View all <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          mission.status === "in-progress"
                            ? "bg-blue-500/10"
                            : mission.status === "completed"
                            ? "bg-green-500/10"
                            : "bg-muted"
                        }`}
                      >
                        {mission.status === "in-progress" ? (
                          <Play className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Square className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{mission.destination}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {mission.type} delivery
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          mission.status === "in-progress"
                            ? "bg-blue-500/10 text-blue-500"
                            : mission.status === "completed"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {mission.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}

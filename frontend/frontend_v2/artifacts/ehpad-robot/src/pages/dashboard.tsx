import React from 'react';
import { useSimulation } from '@/hooks/use-simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Battery, Activity, CheckCircle2, Navigation, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';

export default function Dashboard() {
  const { status, activities, connections } = useSimulation();

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'idle': return 'bg-secondary text-secondary-foreground';
      case 'moving': return 'bg-primary/15 text-primary border-primary/30';
      case 'charging': return 'bg-success/15 text-success border-success/30';
      case 'delivering': return 'bg-warning/15 text-warning border-warning/30';
      case 'error': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      default: return <Activity className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-lg">Real-time overview of the EHPAD assistance robot.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Status</CardTitle>
            <Navigation className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold capitalize mt-1 mb-2">
              {status.status}
            </div>
            <Badge variant="outline" className={`capitalize px-2.5 py-0.5 ${getStatusColor(status.status)}`}>
              {status.speed > 0 ? `${status.speed} km/h` : 'Stationary'}
            </Badge>
          </CardContent>
        </Card>

        {/* Battery Card */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Battery Level</CardTitle>
            <Battery className={`w-4 h-4 ${status.battery > 20 ? 'text-success' : 'text-destructive animate-pulse-slow'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold mt-1 mb-3">
              {status.battery}%
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${status.battery > 20 ? 'bg-success' : 'bg-destructive'}`}
                style={{ width: `${status.battery}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Active Mission */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Mission</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold mt-1 mb-2 truncate">
              {status.activeMission || "None"}
            </div>
            <p className="text-sm text-muted-foreground">
              {status.activeMission ? "In progress..." : "Awaiting assignment"}
            </p>
          </CardContent>
        </Card>

        {/* Deliveries Today */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries Today</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold mt-1 mb-2">
              {status.deliveriesToday}
            </div>
            <p className="text-sm text-muted-foreground">
              +3 from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
            <CardTitle className="font-display">Recent Activity</CardTitle>
            <Link href="/missions" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {activities.slice(0, 6).map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 hover:bg-secondary/30 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center shrink-0 shadow-sm">
                    {getEventIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${activity.type === 'error' ? 'text-destructive' : 'text-foreground'}`}>
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(activity.timestamp, 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg text-primary">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/missions">
                <div className="w-full flex items-center justify-between p-3 rounded-xl bg-background border border-border/50 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <span className="font-medium text-sm">Assign New Mission</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
              <Link href="/robot-control">
                <div className="w-full flex items-center justify-between p-3 rounded-xl bg-background border border-border/50 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <span className="font-medium text-sm">Manual Override</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(connections).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground uppercase">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs capitalize">{value}</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${value === 'connected' ? 'bg-success' : 'bg-destructive'}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

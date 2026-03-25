import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSimulation } from '@/hooks/use-simulation';
import { Server, Cpu, Wifi, Database, Activity } from 'lucide-react';

export default function SystemStatus() {
  const { connections, toggleConnection } = useSimulation();

  const getStatusColor = (status: string) => {
    return status === 'connected' ? 'bg-success' : 'bg-destructive';
  };

  const services = [
    { id: 'robot', name: 'Robot Hardware', icon: Cpu, desc: 'Physical robot telemetry link' },
    { id: 'ros', name: 'ROS2 Bridge', icon: Server, desc: 'Navigation and path planning' },
    { id: 'mqtt', name: 'MQTT Broker', icon: Wifi, desc: 'Message passing system' },
    { id: 'ws', name: 'WebSocket Server', icon: Activity, desc: 'Real-time UI updates' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">System Status</h1>
        <p className="text-muted-foreground mt-1">Infrastructure connection health and testing tools.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => {
          const status = connections[service.id as keyof typeof connections];
          const isConnected = status === 'connected';

          return (
            <Card key={service.id} className="border-border/50 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      <service.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">{service.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${getStatusColor(status)} ${isConnected ? 'animate-pulse-slow' : ''}`} />
                      <span className="text-xs font-medium uppercase tracking-wider">{status}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`simulate-${service.id}`} className="text-xs text-muted-foreground">Simulate</Label>
                      <Switch 
                        id={`simulate-${service.id}`}
                        checked={isConnected}
                        onCheckedChange={() => toggleConnection(service.id as any)}
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                  </div>
                </div>
                
                {isConnected && (
                  <div className="mt-6 pt-4 border-t border-border/50 flex justify-between text-xs text-muted-foreground font-mono">
                    <span>Ping: {Math.floor(Math.random() * 20 + 5)}ms</span>
                    <span>Uptime: 99.9%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card className="border-border/50 shadow-sm bg-secondary/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg">PostgreSQL DB</h3>
                  <p className="text-sm text-muted-foreground">Persistent storage</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                <div className="w-2.5 h-2.5 rounded-full bg-success" />
                <span className="text-xs font-medium uppercase tracking-wider">Connected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

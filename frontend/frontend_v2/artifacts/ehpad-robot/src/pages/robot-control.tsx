import React, { useState } from 'react';
import { useSimulation } from '@/hooks/use-simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Video, StopCircle, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function RobotControl() {
  const { status, manualControl, emergencyStop, connections } = useSimulation();
  const [activeDirection, setActiveDirection] = useState<string | null>(null);

  const handleControl = (dir: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
    setActiveDirection(dir);
    manualControl(dir);
    setTimeout(() => setActiveDirection(null), 200);
  };

  const isConnected = connections.robot === 'connected';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          Manual Control 
          {!isConnected && <Badge variant="destructive">Disconnected</Badge>}
        </h1>
        <p className="text-muted-foreground mt-1">Direct teleoperation and live telemetry.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Joystick & E-Stop */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border/50 shadow-sm flex flex-col items-center justify-center py-8">
            <CardHeader className="pb-0 pt-2 w-full">
              <CardTitle className="text-center font-display text-muted-foreground text-sm uppercase tracking-wider">Directional Pad</CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-3 grid-rows-3 gap-3 w-[240px] h-[240px] mx-auto">
                <div />
                <Button 
                  disabled={!isConnected}
                  className={`w-full h-full rounded-2xl transition-all duration-150 ${activeDirection === 'forward' ? 'bg-primary scale-95' : 'bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary'}`}
                  onClick={() => handleControl('forward')}
                >
                  <ArrowUp className="w-8 h-8" />
                </Button>
                <div />
                
                <Button 
                  disabled={!isConnected}
                  className={`w-full h-full rounded-2xl transition-all duration-150 ${activeDirection === 'left' ? 'bg-primary scale-95' : 'bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary'}`}
                  onClick={() => handleControl('left')}
                >
                  <ArrowLeft className="w-8 h-8" />
                </Button>
                
                <Button 
                  disabled={!isConnected}
                  variant="destructive"
                  className={`w-full h-full rounded-full transition-all duration-150 font-bold ${activeDirection === 'stop' ? 'scale-90 shadow-none' : 'shadow-lg shadow-destructive/20 hover:scale-105'}`}
                  onClick={() => handleControl('stop')}
                >
                  STOP
                </Button>
                
                <Button 
                  disabled={!isConnected}
                  className={`w-full h-full rounded-2xl transition-all duration-150 ${activeDirection === 'right' ? 'bg-primary scale-95' : 'bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary'}`}
                  onClick={() => handleControl('right')}
                >
                  <ArrowRight className="w-8 h-8" />
                </Button>
                
                <div />
                <Button 
                  disabled={!isConnected}
                  className={`w-full h-full rounded-2xl transition-all duration-150 ${activeDirection === 'backward' ? 'bg-primary scale-95' : 'bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary'}`}
                  onClick={() => handleControl('backward')}
                >
                  <ArrowDown className="w-8 h-8" />
                </Button>
                <div />
              </div>
            </CardContent>
          </Card>

          <Button 
            variant="destructive" 
            className="w-full h-20 text-xl font-bold rounded-2xl shadow-xl shadow-destructive/20 active:scale-95 transition-transform"
            onClick={emergencyStop}
          >
            <AlertTriangle className="w-8 h-8 mr-3" />
            EMERGENCY STOP
          </Button>
        </div>

        {/* Right Column: Camera & Telemetry */}
        <div className="space-y-6 lg:col-span-2 flex flex-col">
          <Card className="border-border/50 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
            <CardHeader className="bg-secondary/50 border-b border-border/50 py-3 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                Live Camera Feed
              </CardTitle>
              <Badge variant="outline" className="bg-background text-xs font-mono text-muted-foreground border-border/50">
                CAM_FRONT_RGB
              </Badge>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative bg-black/95 flex items-center justify-center">
              {/* Camera Placeholder */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3')] bg-cover bg-center opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              
              <div className="z-10 flex flex-col items-center text-white/50 space-y-4">
                <Radio className="w-12 h-12 animate-pulse-slow" />
                <span className="font-mono text-sm tracking-widest uppercase">Video stream initialized</span>
              </div>

              {/* HUD Overlays */}
              <div className="absolute bottom-4 left-4 z-10 font-mono text-xs text-success/80">
                REC 🔴 <br/>
                {new Date().toISOString().split('T')[1].slice(0,8)}
              </div>
              <div className="absolute top-4 right-4 z-10 font-mono text-xs text-white/70 text-right">
                CH: 1<br/>
                30 FPS
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-x divide-border/50">
                <div className="px-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Speed</div>
                  <div className="text-2xl font-display font-bold text-primary">{status.speed} <span className="text-sm text-muted-foreground">km/h</span></div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Position X</div>
                  <div className="text-2xl font-display font-bold">{status.positionX.toFixed(1)} <span className="text-sm text-muted-foreground">m</span></div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Position Y</div>
                  <div className="text-2xl font-display font-bold">{status.positionY.toFixed(1)} <span className="text-sm text-muted-foreground">m</span></div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Signal</div>
                  <div className="text-2xl font-display font-bold text-success">{status.connectionQuality}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

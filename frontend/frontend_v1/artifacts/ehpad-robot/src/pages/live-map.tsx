import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimulation } from '@/hooks/use-simulation';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation2, Zap } from 'lucide-react';

export default function LiveMap() {
  const { status } = useSimulation();
  
  // Convert real world coordinates to SVG percentages (approximate mapping)
  // Let's assume a 100x100 grid for simplicity
  const robX = Math.max(10, Math.min(90, status.positionX));
  const robY = Math.max(10, Math.min(90, status.positionY));

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">Facility Live Map</h1>
        <p className="text-muted-foreground mt-1">Real-time location tracking on Floor 1.</p>
      </div>

      <Card className="border-border/50 shadow-sm flex-1 min-h-[500px] overflow-hidden flex flex-col rounded-2xl relative">
        <div className="absolute top-6 left-6 z-10 space-y-2">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-md font-mono border-border/50 shadow-sm px-3 py-1.5 flex gap-2">
            <Navigation2 className="w-3 h-3" />
            X: {status.positionX.toFixed(2)} Y: {status.positionY.toFixed(2)}
          </Badge>
          <Badge variant="outline" className="bg-background/80 backdrop-blur-md font-mono border-border/50 shadow-sm px-3 py-1.5 flex gap-2">
            <Zap className={`w-3 h-3 ${status.status === 'moving' ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            Status: {status.status.toUpperCase()}
          </Badge>
        </div>

        <div className="absolute bottom-6 right-6 z-10 bg-background/90 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-lg text-sm">
          <div className="font-display font-semibold mb-2 text-muted-foreground">Legend</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />
              <span>Robot Position</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-md bg-success/10 border border-success/30" />
              <span>Charging Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-md bg-secondary border border-border" />
              <span>Patient Room</span>
            </div>
          </div>
        </div>

        <CardContent className="p-0 flex-1 bg-slate-50 dark:bg-slate-900/50 relative">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" className="text-border/40" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Floor Plan Corridors */}
            <rect x="15" y="45" width="70" height="10" fill="currentColor" className="text-secondary" />
            <rect x="45" y="15" width="10" height="70" fill="currentColor" className="text-secondary" />

            {/* Rooms Top */}
            <rect x="15" y="15" width="25" height="25" fill="currentColor" className="text-background stroke-border stroke-1" rx="1" />
            <text x="27.5" y="28" fontSize="3" fill="currentColor" className="text-muted-foreground font-mono" textAnchor="middle">Room 101</text>
            
            <rect x="60" y="15" width="25" height="25" fill="currentColor" className="text-background stroke-border stroke-1" rx="1" />
            <text x="72.5" y="28" fontSize="3" fill="currentColor" className="text-muted-foreground font-mono" textAnchor="middle">Room 102</text>

            {/* Rooms Bottom */}
            <rect x="15" y="60" width="25" height="25" fill="currentColor" className="text-background stroke-border stroke-1" rx="1" />
            <text x="27.5" y="73" fontSize="3" fill="currentColor" className="text-muted-foreground font-mono" textAnchor="middle">Room 103</text>
            
            <rect x="60" y="60" width="25" height="25" fill="currentColor" className="text-background stroke-border stroke-1" rx="1" />
            <text x="72.5" y="73" fontSize="3" fill="currentColor" className="text-muted-foreground font-mono" textAnchor="middle">Room 104</text>

            {/* Charging Station */}
            <rect x="47.5" y="85" width="5" height="5" fill="currentColor" className="text-success/20 stroke-success/50 stroke-[0.5]" rx="0.5" />
            <path d="M50 86 L49 88 L50 88 L49.5 90 L51.5 87 L50.5 87 Z" fill="currentColor" className="text-success" />

            {/* Simulated Path (if active mission) */}
            {status.activeMission && (
              <motion.path 
                d={`M ${robX} ${robY} L 50 50 L 27.5 28`} 
                fill="none" 
                stroke="currentColor" 
                className="text-primary/50"
                strokeWidth="0.5" 
                strokeDasharray="2,1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}

            {/* Robot Marker */}
            <motion.g
              animate={{ x: robX, y: robY }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
            >
              <circle r="3" fill="currentColor" className="text-primary/20 animate-pulse" />
              <circle r="1.5" fill="currentColor" className="text-primary" />
              {/* Optional facing indicator could be added here if rotation data existed */}
            </motion.g>
          </svg>
        </CardContent>
      </Card>
    </div>
  );
}

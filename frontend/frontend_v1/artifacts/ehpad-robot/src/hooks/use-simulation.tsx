import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RobotStatus, RobotStatusStatus, Mission } from '@workspace/api-client-react';

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface RobotSimulationState {
  status: RobotStatus;
  activities: ActivityEvent[];
  connections: {
    ros: 'connected' | 'disconnected' | 'degraded';
    mqtt: 'connected' | 'disconnected' | 'degraded';
    robot: 'connected' | 'disconnected' | 'degraded';
    ws: 'connected' | 'disconnected' | 'degraded';
  };
  manualControl: (direction: 'forward' | 'backward' | 'left' | 'right' | 'stop') => void;
  emergencyStop: () => void;
  addActivity: (message: string, type?: ActivityEvent['type']) => void;
  toggleConnection: (service: keyof RobotSimulationState['connections']) => void;
}

const defaultStatus: RobotStatus = {
  status: 'idle',
  battery: 87,
  positionX: 45.2,
  positionY: 12.8,
  speed: 0,
  connectionQuality: 98,
  activeMission: null,
  deliveriesToday: 12,
  lastUpdated: new Date().toISOString(),
};

const SimulationContext = createContext<RobotSimulationState | null>(null);

export function RobotSimulationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RobotStatus>(defaultStatus);
  const [activities, setActivities] = useState<ActivityEvent[]>([
    { id: '1', timestamp: new Date(Date.now() - 1000 * 60 * 5), message: 'Robot returned to base', type: 'info' },
    { id: '2', timestamp: new Date(Date.now() - 1000 * 60 * 30), message: 'Meal delivery completed - Floor 2', type: 'success' },
    { id: '3', timestamp: new Date(Date.now() - 1000 * 60 * 120), message: 'Medical kit delivered to Room 203', type: 'success' },
  ]);
  
  const [connections, setConnections] = useState<RobotSimulationState['connections']>({
    ros: 'connected',
    mqtt: 'connected',
    robot: 'connected',
    ws: 'connected',
  });

  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);

  const addActivity = (message: string, type: ActivityEvent['type'] = 'info') => {
    setActivities(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      message,
      type
    }, ...prev].slice(0, 50));
  };

  const manualControl = (direction: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
    if (isEmergencyStopped) return;
    
    if (direction === 'stop') {
      setStatus(prev => ({ ...prev, speed: 0, status: 'idle' }));
      return;
    }

    setStatus(prev => {
      let dx = 0; let dy = 0;
      const speed = 2.5; // km/h
      
      switch (direction) {
        case 'forward': dy = -1; break;
        case 'backward': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }

      return {
        ...prev,
        status: 'moving',
        speed,
        positionX: prev.positionX + dx,
        positionY: prev.positionY + dy,
        lastUpdated: new Date().toISOString()
      };
    });
  };

  const emergencyStop = () => {
    setIsEmergencyStopped(true);
    setStatus(prev => ({ ...prev, status: 'error', speed: 0 }));
    addActivity('EMERGENCY STOP ACTIVATED', 'error');
    setConnections(prev => ({ ...prev, robot: 'disconnected' }));
    
    // Auto reset after a bit for demo purposes
    setTimeout(() => {
      setIsEmergencyStopped(false);
      setStatus(prev => ({ ...prev, status: 'idle' }));
      setConnections(prev => ({ ...prev, robot: 'connected' }));
      addActivity('Emergency stop cleared. Robot ready.', 'success');
    }, 8000);
  };

  const toggleConnection = (service: keyof RobotSimulationState['connections']) => {
    setConnections(prev => {
      const nextState = prev[service] === 'connected' ? 'disconnected' : 'connected';
      addActivity(`${service.toUpperCase()} connection ${nextState}`, nextState === 'connected' ? 'success' : 'error');
      return { ...prev, [service]: nextState };
    });
  };

  // Simulate background battery drain and random minor movement
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => {
        // Only drain if not charging
        const newBattery = prev.status !== 'charging' ? Math.max(0, prev.battery - 0.1) : Math.min(100, prev.battery + 0.5);
        
        // Randomly drop connection quality slightly to look alive
        const newQuality = Math.max(70, Math.min(100, prev.connectionQuality + (Math.random() * 4 - 2)));
        
        return {
          ...prev,
          battery: Number(newBattery.toFixed(1)),
          connectionQuality: Number(newQuality.toFixed(0)),
          lastUpdated: new Date().toISOString()
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SimulationContext.Provider value={{ status, activities, connections, manualControl, emergencyStop, addActivity, toggleConnection }}>
      {children}
    </SimulationContext.Provider>
  );
}

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within RobotSimulationProvider');
  return context;
};

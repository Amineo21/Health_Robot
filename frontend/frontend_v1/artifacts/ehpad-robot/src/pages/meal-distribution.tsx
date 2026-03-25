import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Utensils, CheckCircle2, CircleDashed, User as UserIcon } from 'lucide-react';

export default function MealDistribution() {
  const schedule = [
    { room: '101', resident: 'Mme. Dupont', type: 'Lunch', status: 'completed' },
    { room: '102', resident: 'M. Martin', type: 'Lunch', status: 'completed' },
    { room: '103', resident: 'Mme. Bernard', type: 'Lunch', status: 'completed' },
    { room: '104', resident: 'M. Thomas', type: 'Lunch', status: 'in_progress' },
    { room: '105', resident: 'Mme. Petit', type: 'Lunch', status: 'pending' },
    { room: '106', resident: 'M. Robert', type: 'Lunch', status: 'pending' },
  ];

  const completed = schedule.filter(s => s.status === 'completed').length;
  const total = schedule.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">Meal Distribution</h1>
        <p className="text-muted-foreground mt-1">Today's automated food service schedule.</p>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden bg-gradient-to-r from-primary/5 to-transparent border-primary/10">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Lunch Service</h2>
                  <p className="text-muted-foreground">Floor 1 - Wing A</p>
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-md w-full space-y-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Progress</span>
                <span className="text-primary">{completed} of {total} rooms</span>
              </div>
              <Progress value={progress} className="h-3 bg-secondary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedule.map((item, idx) => (
          <Card 
            key={idx} 
            className={`border-border/50 transition-all duration-300 hover-elevate ${
              item.status === 'in_progress' ? 'ring-2 ring-primary border-transparent' : 
              item.status === 'completed' ? 'bg-secondary/30' : ''
            }`}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono bg-background">{item.room}</Badge>
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : item.status === 'in_progress' ? (
                    <Badge className="bg-primary/20 text-primary border-transparent">En route</Badge>
                  ) : (
                    <CircleDashed className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{item.resident}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 ml-6">{item.type}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

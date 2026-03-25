import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';
import { useSimulation } from '@/hooks/use-simulation';
import { format } from 'date-fns';

export default function Deliveries() {
  const { status } = useSimulation();

  // Simulated static data for history
  const deliveries = [
    { id: 'DEL-8902', room: '203', type: 'Medical Kit', time: new Date(Date.now() - 1000 * 60 * 45), duration: '12m', status: 'completed' },
    { id: 'DEL-8901', room: '105', type: 'Blood Samples', time: new Date(Date.now() - 1000 * 60 * 120), duration: '8m', status: 'completed' },
    { id: 'DEL-8900', room: '310', type: 'Linens', time: new Date(Date.now() - 1000 * 60 * 200), duration: '15m', status: 'completed' },
    { id: 'DEL-8899', room: '112', type: 'Medical Kit', time: new Date(Date.now() - 1000 * 60 * 280), duration: '-', status: 'failed' },
    { id: 'DEL-8898', room: 'Pharmacy', type: 'Restock', time: new Date(Date.now() - 1000 * 60 * 400), duration: '22m', status: 'completed' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">Delivery History</h1>
        <p className="text-muted-foreground mt-1">Log of completed and attempted item transports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Total Today</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">{status.deliveriesToday}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1 flex items-center gap-2">
                  96% <TrendingUp className="w-5 h-5 text-success" />
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Duration</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">11m</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">1</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-secondary/20 border-b border-border/50">
          <CardTitle className="text-lg font-display">Recent Log</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Item Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id} className="hover:bg-secondary/30 border-border/50 transition-colors">
                <TableCell className="font-mono text-xs text-muted-foreground">{delivery.id}</TableCell>
                <TableCell className="font-medium">{format(delivery.time, 'HH:mm')}</TableCell>
                <TableCell>{delivery.room}</TableCell>
                <TableCell>{delivery.type}</TableCell>
                <TableCell className="text-muted-foreground">{delivery.duration}</TableCell>
                <TableCell className="text-right">
                  {delivery.status === 'completed' ? (
                    <Badge className="bg-success/15 text-success hover:bg-success/25 border-transparent pointer-events-none">Completed</Badge>
                  ) : (
                    <Badge variant="destructive" className="pointer-events-none">Failed</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

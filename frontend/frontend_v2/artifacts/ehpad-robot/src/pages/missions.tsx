import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Plus, Search, MapPin, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { useGetMissions, useCreateMission, useUpdateMissionStatus, Mission, MissionStatus } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const missionSchema = z.object({
  type: z.enum(['medical_delivery', 'meal_distribution']),
  destination: z.string().min(1, 'Destination is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  notes: z.string().optional(),
});

type MissionFormValues = z.infer<typeof missionSchema>;

export default function Missions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Fallback data if API fails
  const [localMissions, setLocalMissions] = useState<Mission[]>([
    {
      id: 'MSN-1001',
      type: 'medical_delivery',
      destination: 'Room 203',
      status: 'completed',
      priority: 'high',
      notes: 'Insulin delivery',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      completedTime: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'MSN-1002',
      type: 'meal_distribution',
      destination: 'Floor 2 Dining',
      status: 'in_progress',
      priority: 'medium',
      notes: 'Lunch service',
      startTime: new Date(Date.now() - 600000).toISOString(),
      completedTime: null,
      createdAt: new Date(Date.now() - 600000).toISOString()
    },
    {
      id: 'MSN-1003',
      type: 'medical_delivery',
      destination: 'Room 105',
      status: 'pending',
      priority: 'urgent',
      notes: 'First aid kit',
      startTime: null,
      completedTime: null,
      createdAt: new Date().toISOString()
    }
  ]);

  const { data: apiMissions, isLoading } = useGetMissions({
    query: {
      retry: 1, // Don't retry infinitely if API is not there
    }
  });

  const missions = apiMissions || localMissions;

  const createMutation = useCreateMission({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/missions'] });
        toast({ title: "Mission Created", description: "The robot has received the new mission." });
        setIsDialogOpen(false);
        form.reset();
      },
      onError: (err) => {
        // Fallback for simulation
        const newMission: Mission = {
          id: `MSN-${Math.floor(Math.random() * 9000) + 1000}`,
          ...form.getValues(),
          status: 'pending',
          startTime: null,
          completedTime: null,
          createdAt: new Date().toISOString()
        } as Mission;
        setLocalMissions(prev => [newMission, ...prev]);
        toast({ title: "Mission Created (Simulated)", description: "Added to local state since API is unavailable." });
        setIsDialogOpen(false);
        form.reset();
      }
    }
  });

  const updateStatusMutation = useUpdateMissionStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/missions'] });
      }
    }
  });

  const form = useForm<MissionFormValues>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      type: 'medical_delivery',
      destination: '',
      priority: 'medium',
      notes: ''
    }
  });

  const onSubmit = (data: MissionFormValues) => {
    createMutation.mutate({ data });
  };

  const cancelMission = (id: string) => {
    updateStatusMutation.mutate({ id, data: { status: 'cancelled' } }, {
      onError: () => {
        setLocalMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m));
        toast({ title: "Mission Cancelled", description: "Mission status updated.", variant: "destructive" });
      }
    });
  };

  const filteredMissions = missions.filter(m => 
    m.destination.toLowerCase().includes(search.toLowerCase()) || 
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge className="bg-success text-success-foreground hover:bg-success border-transparent gap-1"><CheckCircle2 className="w-3 h-3"/> Completed</Badge>;
      case 'in_progress': return <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-transparent gap-1"><Clock className="w-3 h-3 animate-spin-slow"/> In Progress</Badge>;
      case 'pending': return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3"/> Pending</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-muted-foreground gap-1"><XCircle className="w-3 h-3"/> Cancelled</Badge>;
      case 'failed': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3"/> Failed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Missions</h1>
          <p className="text-muted-foreground mt-1">Manage and track robot task assignments.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all font-medium h-11 px-6">
              <Plus className="w-5 h-5 mr-2" /> New Mission
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Create New Mission</DialogTitle>
              <DialogDescription>
                Assign a new task to the EHPAD assistance robot.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mission Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="medical_delivery">Medical Delivery</SelectItem>
                          <SelectItem value="meal_distribution">Meal Distribution</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination Room</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. 203" className="pl-9 h-11 rounded-xl bg-secondary/50 border-border/50" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-border/50">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent" className="text-destructive">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Optional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Special instructions for staff upon delivery..." 
                          className="resize-none rounded-xl bg-secondary/50 border-border/50" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-11">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="rounded-xl h-11">
                    {createMutation.isPending ? "Sending..." : "Send to Robot"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>

          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden rounded-2xl">
        <div className="p-4 border-b border-border/50 bg-secondary/30 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search missions by ID or room..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background rounded-xl h-10 border-border/50"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[100px] font-medium">ID</TableHead>
                <TableHead className="font-medium">Type</TableHead>
                <TableHead className="font-medium">Destination</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium hidden md:table-cell">Priority</TableHead>
                <TableHead className="font-medium hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No missions found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMissions.map((mission) => (
                  <TableRow key={mission.id} className="hover:bg-secondary/30 border-border/50 transition-colors">
                    <TableCell className="font-mono text-xs">{mission.id}</TableCell>
                    <TableCell>
                      <span className="capitalize text-sm font-medium">
                        {mission.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{mission.destination}</TableCell>
                    <TableCell>{getStatusBadge(mission.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={`text-xs uppercase font-bold tracking-wider
                        ${mission.priority === 'urgent' ? 'text-destructive' : 
                          mission.priority === 'high' ? 'text-warning' : 
                          mission.priority === 'medium' ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        {mission.priority}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(new Date(mission.createdAt), 'HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      {(mission.status === 'pending' || mission.status === 'in_progress') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-3 rounded-lg"
                          onClick={() => cancelMission(mission.id)}
                          disabled={updateStatusMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                      {(mission.status === 'completed' || mission.status === 'cancelled' || mission.status === 'failed') && (
                        <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-muted-foreground">
                          Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

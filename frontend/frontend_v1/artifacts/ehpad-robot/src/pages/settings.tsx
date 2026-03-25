import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Platform configuration updated successfully.",
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure robot behavior and platform preferences.</p>
      </div>

      <div className="space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Robot Configuration</CardTitle>
            <CardDescription>Adjust physical movement and operating parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Maximum Speed (km/h)</Label>
                <Select defaultValue="2.5">
                  <SelectTrigger className="bg-secondary/50 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.0">1.0 - Very Slow (Crowded)</SelectItem>
                    <SelectItem value="2.5">2.5 - Normal</SelectItem>
                    <SelectItem value="4.0">4.0 - Fast (Empty halls)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Home Base Location</Label>
                <Input defaultValue="Charging Station 1 - Lobby" className="bg-secondary/50 rounded-xl" />
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-border/50 mt-4">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-Return to Base</Label>
                <p className="text-sm text-muted-foreground">Return to charger when battery &lt; 20%</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-primary" />
            </div>
            
            <div className="flex items-center justify-between py-2 border-t border-border/50">
              <div className="space-y-0.5">
                <Label className="text-base">Voice Announcements</Label>
                <p className="text-sm text-muted-foreground">Robot speaks when arriving at destination</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>System Integration</CardTitle>
            <CardDescription>Advanced technical endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>MQTT Broker URL</Label>
              <Input defaultValue="mqtt://broker.ehpad-internal.local:1883" className="font-mono text-sm bg-secondary/50 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>ROS2 WebSocket Bridge</Label>
              <Input defaultValue="ws://robot-core.ehpad.local:9090" className="font-mono text-sm bg-secondary/50 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="rounded-xl px-8 h-11 font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

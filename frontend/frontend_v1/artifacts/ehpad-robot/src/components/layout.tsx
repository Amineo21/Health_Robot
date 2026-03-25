import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Gamepad2, 
  ClipboardList, 
  Map as MapIcon, 
  Package, 
  Utensils, 
  Activity, 
  Settings as SettingsIcon,
  Bell,
  User,
  Moon,
  Sun,
  Menu,
  Stethoscope
} from 'lucide-react';
import { useSimulation } from '@/hooks/use-simulation';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Robot Control", url: "/robot-control", icon: Gamepad2 },
  { title: "Missions", url: "/missions", icon: ClipboardList },
  { title: "Live Map", url: "/live-map", icon: MapIcon },
  { title: "Deliveries", url: "/deliveries", icon: Package },
  { title: "Meal Distribution", url: "/meal-distribution", icon: Utensils },
  { title: "System Status", url: "/system-status", icon: Activity },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { status, connections } = useSimulation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
          <SidebarHeader className="p-4 border-b border-border/50 flex flex-row items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-semibold text-lg leading-tight">EHPAD CareBot</span>
              <span className="text-xs text-muted-foreground">Platform Control</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-2 px-2">
                  {navItems.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className={`
                            rounded-xl px-3 py-2.5 h-auto transition-all duration-200
                            ${isActive 
                              ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15' 
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }
                          `}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                            <span className="text-sm">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 px-4 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                      <div className={`w-2 h-2 rounded-full ${connections.robot === 'connected' ? 'bg-success animate-pulse-slow' : 'bg-destructive'}`} />
                      <span className="text-xs font-medium">Robot {connections.robot}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Physical robot connection</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                      <div className={`w-2 h-2 rounded-full ${connections.mqtt === 'connected' ? 'bg-success animate-pulse-slow' : 'bg-destructive'}`} />
                      <span className="text-xs font-medium">MQTT</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Message broker status</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 mr-4">
                <span className="text-xs text-muted-foreground font-medium">Battery:</span>
                <div className="flex items-center gap-2 w-24">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${status.battery > 20 ? 'bg-success' : 'bg-destructive'}`}
                      style={{ width: `${status.battery}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{status.battery}%</span>
                </div>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-secondary text-muted-foreground"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary text-muted-foreground relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-background" />
              </Button>

              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <User className="w-4 h-4" />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

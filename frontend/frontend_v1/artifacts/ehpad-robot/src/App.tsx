import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { RobotSimulationProvider } from "@/hooks/use-simulation";
import { AppLayout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import RobotControl from "@/pages/robot-control";
import Missions from "@/pages/missions";
import LiveMap from "@/pages/live-map";
import Deliveries from "@/pages/deliveries";
import MealDistribution from "@/pages/meal-distribution";
import SystemStatus from "@/pages/system-status";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/robot-control" component={RobotControl} />
        <Route path="/missions" component={Missions} />
        <Route path="/live-map" component={LiveMap} />
        <Route path="/deliveries" component={Deliveries} />
        <Route path="/meal-distribution" component={MealDistribution} />
        <Route path="/system-status" component={SystemStatus} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="ehpad-theme">
        <RobotSimulationProvider>
          <TooltipProvider delayDuration={300}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </RobotSimulationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

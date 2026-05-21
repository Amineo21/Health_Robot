import { Bot, LayoutDashboard, Gamepad2, ListTodo, Map, Truck, UtensilsCrossed, Activity, Settings } from 'lucide-react'

const navigationItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Robot Control', href: '/control', icon: Gamepad2 },
  { title: 'Missions', href: '/missions', icon: ListTodo },
  { title: 'Live Map', href: '/map', icon: Map },
  { title: 'Deliveries', href: '/deliveries', icon: Truck },
  { title: 'Meal Distribution', href: '/meals', icon: UtensilsCrossed },
  { title: 'System Status', href: '/status', icon: Activity },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export function AppSidebar() {
  return (
    <aside className="hidden h-full w-72 border-r border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/80 text-white backdrop-blur lg:flex lg:flex-col">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/30 to-cyan-400/10 text-cyan-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">CareBot</p>
            <p className="text-xs text-slate-400">EHPAD Control System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3 text-sm">
        {navigationItems.map((item, index) => (
          <a 
            key={item.href} 
            href={item.href} 
            className="nav-link animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{item.title}</span>
          </a>
        ))}
      </nav>

      <div className="border-t border-white/10 bg-gradient-to-t from-black/20 p-4 text-xs text-slate-500">
        <p className="font-semibold text-white/80">CareBot v2.1.0</p>
        <p className="mt-2">© 2024 EHPAD Control</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 p-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-slate-400">System Online</span>
        </div>
      </div>
    </aside>
  )
}
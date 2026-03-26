"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Gamepad2,
  ListTodo,
  Map,
  Truck,
  UtensilsCrossed,
  Activity,
  Settings,
  Bot,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navigationItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Robot Control", href: "/control", icon: Gamepad2 },
  { title: "Missions", href: "/missions", icon: ListTodo },
  { title: "Live Map", href: "/map", icon: Map },
  { title: "Deliveries", href: "/deliveries", icon: Truck },
  { title: "Meal Distribution", href: "/meals", icon: UtensilsCrossed },
  { title: "System Status", href: "/status", icon: Activity },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">CareBot</span>
            <span className="text-xs text-sidebar-foreground/70">EHPAD Control</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn(
                        "h-4 w-4",
                        pathname === item.href && "text-sidebar-primary"
                      )} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-3 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/50">
            CareBot v2.1.0
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

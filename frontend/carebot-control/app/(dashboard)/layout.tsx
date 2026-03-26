"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TopBar } from "@/components/top-bar"
import { RobotProvider } from "@/lib/robot-context"
import { ThemeProvider } from "@/components/theme-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <RobotProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <TopBar />
            <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-auto safe-area-inset">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </RobotProvider>
    </ThemeProvider>
  )
}

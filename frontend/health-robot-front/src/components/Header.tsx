import { Link } from '@tanstack/react-router'

import { useState } from 'react'
import { Home, Menu, X, LayoutDashboard, LogIn, ListTodo, Activity, Map, Settings, Truck, UtensilsCrossed, Gamepad2 } from 'lucide-react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="flex items-center border-b border-white/10 bg-gradient-to-r from-slate-950/95 to-slate-900/90 p-4 text-white shadow-lg backdrop-blur-lg">
        <button
          onClick={() => setIsOpen(true)}
          className="btn-secondary h-10 w-10 p-0 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="ml-4 text-xl font-semibold">
          <Link to="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/20 text-cyan-300">
              <Gamepad2 size={18} />
            </div>
            <span>CareBot</span>
          </Link>
        </h1>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link to="/" className="nav-link px-3">
            <Home size={18} /> <span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/dashboard" className="nav-link px-3">
            <LayoutDashboard size={18} /> <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link to="/auth/login" className="nav-link px-3">
            <LogIn size={18} /> <span className="hidden sm:inline">Login</span>
          </Link>
          <a href="/control" className="nav-link px-3 hover:text-cyan-200">
            <Gamepad2 size={18} /> <span className="hidden sm:inline">Control</span>
          </a>
          <a href="/missions" className="nav-link px-3 hover:text-cyan-200">
            <ListTodo size={18} /> <span className="hidden sm:inline">Missions</span>
          </a>
          <a href="/map" className="nav-link px-3 hover:text-cyan-200">
            <Map size={18} /> <span className="hidden sm:inline">Map</span>
          </a>
          <a href="/deliveries" className="nav-link px-3 hover:text-cyan-200">
            <Truck size={18} /> <span className="hidden sm:inline">Deliveries</span>
          </a>
          <a href="/meals" className="nav-link px-3 hover:text-cyan-200">
            <UtensilsCrossed size={18} /> <span className="hidden sm:inline">Meals</span>
          </a>
          <a href="/status" className="nav-link px-3 hover:text-cyan-200">
            <Activity size={18} /> <span className="hidden sm:inline">Status</span>
          </a>
          <a href="/settings" className="nav-link px-3 hover:text-cyan-200">
            <Settings size={18} /> <span className="hidden sm:inline">Settings</span>
          </a>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="btn-secondary h-10 w-10 p-0"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="nav-link"
            activeProps={{
              className: 'nav-link-active',
            }}
          >
            <Home size={18} /> <span>Home</span>
          </Link>
          <Link
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className="nav-link"
            activeProps={{
              className: 'nav-link-active',
            }}
          >
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </Link>
          <Link
            to="/auth/login"
            onClick={() => setIsOpen(false)}
            className="nav-link"
            activeProps={{
              className: 'nav-link-active',
            }}
          >
            <LogIn size={18} /> <span>Login</span>
          </Link>

          <div className="my-2 border-t border-white/10"></div>

          <a href="/control" onClick={() => setIsOpen(false)} className="nav-link">
            <Gamepad2 size={18} /> <span>Robot Control</span>
          </a>
          <a href="/missions" onClick={() => setIsOpen(false)} className="nav-link">
            <ListTodo size={18} /> <span>Missions</span>
          </a>
          <a href="/map" onClick={() => setIsOpen(false)} className="nav-link">
            <Map size={18} /> <span>Live Map</span>
          </a>
          <a href="/deliveries" onClick={() => setIsOpen(false)} className="nav-link">
            <Truck size={18} /> <span>Deliveries</span>
          </a>
          <a href="/meals" onClick={() => setIsOpen(false)} className="nav-link">
            <UtensilsCrossed size={18} /> <span>Meal Distribution</span>
          </a>
          <a href="/status" onClick={() => setIsOpen(false)} className="nav-link">
            <Activity size={18} /> <span>System Status</span>
          </a>
          <a href="/settings" onClick={() => setIsOpen(false)} className="nav-link">
            <Settings size={18} /> <span>Settings</span>
          </a>
        </nav>

        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          <p>CareBot v2.1.0</p>
          <p className="mt-1 text-slate-500">© 2024 EHPAD Control</p>
        </div>
      </aside>
    </>
  )
}

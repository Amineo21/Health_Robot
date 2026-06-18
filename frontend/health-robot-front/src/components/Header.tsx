import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Activity, Gamepad2, Home, LayoutDashboard, LogIn, LogOut, Map, Menu, Settings, Shield, Users, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { canUseAdminControls } from '@/lib/permissions'

const authenticatedLinks = [
  { to: '/dashboard' as const, label: 'Tableau de bord', mobileLabel: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/control' as const, label: 'Contrôle', mobileLabel: 'Contrôle du robot', icon: Gamepad2 },
  { to: '/map' as const, label: 'Carte', mobileLabel: 'Carte en direct', icon: Map },
  { to: '/status' as const, label: 'État', mobileLabel: 'État du système', icon: Activity },
]

const adminLinks = [
  { to: '/admin/users' as const, label: 'Utilisateurs', mobileLabel: 'Utilisateurs', icon: Users },
  { to: '/settings' as const, label: 'Paramètres', mobileLabel: 'Paramètres', icon: Settings },
]

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = canUseAdminControls(user)
  const visibleLinks = isAuthenticated ? [...authenticatedLinks, ...(isAdmin ? adminLinks : [])] : []

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
    navigate({ to: '/auth/login', replace: true })
  }

  return (
    <>
      <header className="flex items-center border-b border-white/10 bg-gradient-to-r from-slate-950/95 to-slate-900/90 p-4 text-white shadow-lg backdrop-blur-lg">
        <button
          onClick={() => setIsOpen(true)}
          className="btn-secondary h-10 w-10 p-0 lg:hidden"
          aria-label="Ouvrir le menu"
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
            <Home size={18} /> <span className="hidden sm:inline">Accueil</span>
          </Link>

          {visibleLinks.map((item) => (
            <Link key={item.to} to={item.to} className="nav-link px-3">
              <item.icon size={18} /> <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}

          {!isAuthenticated && (
            <Link to="/auth/login" className="nav-link px-3">
              <LogIn size={18} /> <span className="hidden sm:inline">Connexion</span>
            </Link>
          )}

          {isAuthenticated && user && (
            <div className="ml-2 flex items-center gap-3 border-l border-white/10 pl-3">
              <div className="hidden text-right text-xs leading-tight xl:block">
                <p className="font-semibold text-white">{user.name}</p>
                <p className="inline-flex items-center justify-end gap-1 text-cyan-200">
                  <Shield className="h-3 w-3" /> {user.role}
                </p>
              </div>
              <button type="button" onClick={() => void handleLogout()} className="nav-link px-3">
                <LogOut size={18} /> <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          )}
        </nav>
      </header>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

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
            aria-label="Fermer le menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="nav-link"
            activeProps={{ className: 'nav-link-active' }}
          >
            <Home size={18} /> <span>Accueil</span>
          </Link>

          {!isAuthenticated && (
            <Link
              to="/auth/login"
              onClick={() => setIsOpen(false)}
              className="nav-link"
              activeProps={{ className: 'nav-link-active' }}
            >
              <LogIn size={18} /> <span>Connexion</span>
            </Link>
          )}

          {isAuthenticated && <div className="my-2 border-t border-white/10"></div>}

          {visibleLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className="nav-link"
              activeProps={{ className: 'nav-link-active' }}
            >
              <item.icon size={18} /> <span>{item.mobileLabel}</span>
            </Link>
          ))}
        </nav>

        {isAuthenticated && user && (
          <div className="border-t border-white/10 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">{user.name}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-cyan-200">{user.role}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        )}

        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          <p>CareBot v2.1.0</p>
          <p className="mt-1 text-slate-500">© 2024 EHPAD Control</p>
        </div>
      </aside>
    </>
  )
}

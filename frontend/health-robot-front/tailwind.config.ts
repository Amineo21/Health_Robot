import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'

const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // CareBot brand colors
        brand: {
          primary: '#06b6d4', // cyan-500
          secondary: '#0f172a', // slate-950
          accent: '#10b981', // emerald-500
          warning: '#f59e0b', // amber-500
          danger: '#ef4444', // red-500
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0) 100%)',
        'gradient-accent': 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0) 100%)',
        'gradient-card': 'radial-gradient(circle at top-right, rgba(6, 182, 212, 0.05), rgba(15, 23, 42, 0))',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-left': 'slideOutLeft 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'rotate-slow': 'rotateSlow 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.7)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 10px rgba(6, 182, 212, 0)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        rotateSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-lg': '0 0 30px rgba(6, 182, 212, 0.4)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      spacing: {
        'safe': 'max(1rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [
    plugin(function ({ addComponents, theme }) {
      addComponents({
        // Card components
        '.card-base': {
          '@apply rounded-3xl border border-white/10 bg-white/5 shadow-lg shadow-black/20 backdrop-blur': {},
        },
        '.card-elevated': {
          '@apply card-base p-5 transition-all hover:shadow-card-hover hover:bg-white/8': {},
        },
        '.card-interactive': {
          '@apply card-base p-5 cursor-pointer transition-all hover:border-white/20 hover:bg-white/10 active:scale-95': {},
        },
        // Button variants
        '.btn-base': {
          '@apply inline-flex items-center justify-center font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-primary': {
          '@apply btn-base rounded-2xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-2 text-cyan-100 hover:bg-cyan-400/25 hover:border-cyan-400/50': {},
        },
        '.btn-secondary': {
          '@apply btn-base rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-white hover:bg-white/10 hover:border-white/30': {},
        },
        '.btn-control': {
          '@apply inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white shadow-lg transition': {},
        },
        '.btn-control-active': {
          '@apply btn-control bg-cyan-400/15 text-cyan-100 border-cyan-400/30': {},
        },
        // Stat card
        '.stat-icon-wrapper': {
          '@apply rounded-2xl p-3': {},
        },
        // Status badges
        '.status-badge': {
          '@apply inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium': {},
        },
        '.status-online': {
          '@apply status-badge bg-emerald-400/10 text-emerald-200': {},
        },
        '.status-warning': {
          '@apply status-badge bg-amber-400/10 text-amber-200': {},
        },
        '.status-error': {
          '@apply status-badge bg-red-400/10 text-red-200': {},
        },
        '.status-idle': {
          '@apply status-badge bg-slate-400/10 text-slate-200': {},
        },
        // Nav links
        '.nav-link': {
          '@apply flex items-center gap-3 rounded-2xl px-3 py-3 text-slate-300 transition-all hover:bg-white/10 hover:text-white active:bg-white/20': {},
        },
        '.nav-link-active': {
          '@apply bg-cyan-400/20 text-cyan-100': {},
        },
        // Forms
        '.form-input': {
          '@apply w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-400 transition-all focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-cyan-400/30': {},
        },
        '.form-label': {
          '@apply block text-sm font-medium text-slate-300': {},
        },
        '.form-group': {
          '@apply mb-4 flex flex-col gap-2': {},
        },
        // Alerts
        '.alert-base': {
          '@apply rounded-2xl border px-4 py-3 flex items-gap gap-3': {},
        },
        '.alert-info': {
          '@apply alert-base border-cyan-400/30 bg-cyan-400/10 text-cyan-100': {},
        },
        '.alert-success': {
          '@apply alert-base border-emerald-400/30 bg-emerald-400/10 text-emerald-100': {},
        },
        '.alert-warning': {
          '@apply alert-base border-amber-400/30 bg-amber-400/10 text-amber-100': {},
        },
        '.alert-error': {
          '@apply alert-base border-red-400/30 bg-red-400/10 text-red-100': {},
        },
        // Badges
        '.badge-base': {
          '@apply inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold': {},
        },
        '.badge-primary': {
          '@apply badge-base bg-cyan-400/20 text-cyan-100': {},
        },
        '.badge-success': {
          '@apply badge-base bg-emerald-400/20 text-emerald-100': {},
        },
        '.badge-warning': {
          '@apply badge-base bg-amber-400/20 text-amber-100': {},
        },
        '.badge-error': {
          '@apply badge-base bg-red-400/20 text-red-100': {},
        },
        // List items
        '.list-item': {
          '@apply flex items-center gap-3 rounded-2xl border border-white/5 bg-white/3 px-4 py-3 transition-all hover:bg-white/8 hover:border-white/10': {},
        },
        // Containers
        '.container-glass': {
          '@apply rounded-3xl border border-white/10 bg-white/5 px-6 py-4 shadow-xl backdrop-blur': {},
        },
        '.container-gradient': {
          '@apply container-glass bg-gradient-to-br from-white/10 via-white/5 to-transparent': {},
        },
        // Utilities
        '.transition-smooth': {
          '@apply transition-all duration-300 ease-in-out': {},
        },
        '.transition-fast': {
          '@apply transition-all duration-150 ease-in-out': {},
        },
        '.transition-slow': {
          '@apply transition-all duration-500 ease-in-out': {},
        },
        '.glass-effect': {
          '@apply backdrop-blur-md bg-white/10 border border-white/20': {},
        },
        '.glass-effect-subtle': {
          '@apply backdrop-blur-sm bg-white/5 border border-white/10': {},
        },
        '.line-clamp-1': {
          '@apply overflow-hidden text-ellipsis whitespace-nowrap': {},
        },
        '.visually-hidden': {
          '@apply absolute -inset-full overflow-hidden': {},
        },
        '.flex-center': {
          '@apply flex items-center justify-center': {},
        },
        '.flex-between': {
          '@apply flex items-center justify-between': {},
        },
        '.flex-start': {
          '@apply flex items-start justify-start': {},
        },
        '.grid-auto-fit': {
          '@apply grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4': {},
        },
        '.gradient-overlay': {
          '@apply before:absolute before:inset-0 before:bg-gradient-to-t before:from-slate-950 before:to-transparent': {},
        },
        '.focus-ring': {
          '@apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950': {},
        },
        '.loading': {
          '@apply animate-pulse': {},
        },
      })
    }),
  ],
} satisfies Config

export default config

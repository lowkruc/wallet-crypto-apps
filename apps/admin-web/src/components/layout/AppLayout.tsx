import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

type AppLayoutProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
}

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Wallets', to: '/dashboard#wallets' },
  { label: 'Activity', to: '/dashboard#activity' },
]

const AppLayout = ({ title, description, actions, children, contentClassName }: AppLayoutProps) => {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const initials = (user?.name ?? user?.email ?? 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background px-4 py-8">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-border/60 bg-background/90 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-base font-semibold text-foreground">WalletCrypto</p>
            <nav className="flex flex-1 justify-center gap-3 text-sm text-muted-foreground">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-3 py-1 transition-colors',
                      isActive ? 'bg-primary/10 text-foreground' : 'hover:text-foreground/80',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              {actions}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Profile menu"
                >
                  {initials}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-44 rounded-2xl border border-border/70 bg-background/95 p-3 text-sm text-muted-foreground">
                    <p className="text-base font-medium text-foreground">{user?.name ?? 'Signed in'}</p>
                    <p className="truncate text-xs">{user?.email}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full justify-center"
                      onClick={() => {
                        setMenuOpen(false)
                        logout()
                      }}
                    >
                      Log out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {(title || description) && (
          <section className="rounded-3xl border border-border/60 bg-background/90 px-6 py-5">
            {title && <h1 className="text-3xl font-semibold text-foreground">{title}</h1>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </section>
        )}

        <main className={cn('space-y-6', contentClassName)}>{children}</main>
      </div>
    </div>
  )
}

export default AppLayout

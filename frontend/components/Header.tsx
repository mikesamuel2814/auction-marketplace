'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-md shadow-gm-soft">
      <div className="container flex h-14 items-center justify-between">
        <Link
          href="/"
          className="font-bold text-xl text-primary tracking-tight hover:opacity-90 transition-opacity"
        >
          BidHub
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/auctions"
            className="text-sm font-medium text-foreground/90 hover:text-primary rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
          >
            Browse
          </Link>
          <Link
            href="/categories"
            className="text-sm font-medium text-foreground/90 hover:text-primary rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
          >
            Categories
          </Link>
          {user ? (
            <>
              {user.role === 'SELLER' && (
                <Link
                  href="/dashboard/seller"
                  className="text-sm font-medium text-foreground/90 hover:text-primary rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors hidden sm:block"
                >
                  Seller
                </Link>
              )}
              {user.role === 'ADMIN' && (
                <Link
                  href="/dashboard/admin"
                  className="text-sm font-medium text-foreground/90 hover:text-primary rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors hidden sm:block"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="text-sm font-medium text-foreground/90 hover:text-primary rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                Dashboard
              </Link>
              <NotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline max-w-[8rem] truncate">
                {user.name}
              </span>
              <ThemeToggle className="shrink-0" />
              <Button variant="outline" size="sm" onClick={logout} className="rounded-xl">
                Logout
              </Button>
            </>
          ) : (
            <>
              <ThemeToggle className="shrink-0" />
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-xl">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-xl">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="font-bold text-xl text-primary">
          BidHub
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/auctions" className="text-sm hover:underline">
            Browse
          </Link>
          <Link href="/categories" className="text-sm hover:underline">
            Categories
          </Link>
          {user ? (
            <>
              {user.role === 'SELLER' && (
                <Link href="/dashboard/seller" className="text-sm hover:underline">
                  Seller
                </Link>
              )}
              {user.role === 'ADMIN' && (
                <Link href="/dashboard/admin" className="text-sm hover:underline">
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className="text-sm hover:underline">
                Dashboard
              </Link>
              <NotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

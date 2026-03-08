import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Header } from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BidHub - Online Auction Marketplace',
  description: 'Trusted third-party online auction marketplace. Bid, sell, and win.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

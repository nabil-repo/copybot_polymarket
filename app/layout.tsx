import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowProvider } from './rainbow-provider';
import Navbar from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Polymarket Copy Trading Bot',
  description: 'Automated copy trading bot for Polymarket',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RainbowProvider>
          <Navbar />
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </RainbowProvider>
      </body>
    </html>
  );
}

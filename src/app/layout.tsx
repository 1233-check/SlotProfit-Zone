import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SlotProfit Zone | 5% Daily ROI Platform',
  description: 'Simple, transparent 5% daily ROI platform. 75 exclusive slots per day, 2x payout cap.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-[#0d0d14] text-[#e8e6e3] antialiased selection:bg-[#53917e]/30 selection:text-white">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a2e',
              color: '#e8e6e3',
              border: '1px solid #33334d',
              borderRadius: '8px',
              fontSize: '14px',
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'ReachInbox - Email Scheduler',
  description: 'Production-grade email job scheduler with BullMQ, Redis, and real-time dashboards.',
  keywords: 'email scheduler, ReachInbox, cold email, outreach automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#111827',
              border: '1px solid #E5E7EB',
              borderRadius: '10px',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#00A859', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' } },
          }}
        />
      </body>
    </html>
  );
}

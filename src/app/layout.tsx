import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AMarsBody Nutrition',
  description: 'AI-powered nutrition coaching platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AMarsBody',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  applicationName: 'AMarsBody Nutrition',
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 3,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-brand-charcoal text-brand-cream antialiased">
        {children}
      </body>
    </html>
  );
}

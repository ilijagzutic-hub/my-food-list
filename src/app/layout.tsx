import type { Metadata, Viewport } from 'next';
import './globals.css';
import RegisterSW from '@/components/RegisterSW';

// Deliberately not using next/font/google: this keeps the app fully
// self-contained (no external font fetch at build or runtime, which also
// means it keeps working offline as an installed PWA). High-quality system
// serif/sans stacks carry the same restrained, editorial feel.

export const metadata: Metadata = {
  title: 'My Food List',
  description: 'Where should I eat? Your personal restaurant list.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Food List',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f2418',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-forest-900 text-cream-50 min-h-screen">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}

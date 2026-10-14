import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Fira_Code } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthSessionProvider } from '@/components/auth/session-provider'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker'

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: 'Liquidity Square',
  description: 'Follow the tape, share a thesis, and talk markets on The Square.',
  applicationName: 'Liquidity Square',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'The Square',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1210' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `try {
  const theme = localStorage.getItem('theme') || 'system';
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch (error) {
  console.error('Unable to initialize the theme.', error);
}`,
          }}
        />
      </head>
      <body suppressHydrationWarning className={firaCode.variable}>
        <ServiceWorkerRegistration />
        <AuthSessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}

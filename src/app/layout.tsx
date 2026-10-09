import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Fira_Code } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: 'Liquidity Square',
  description: 'Your Next.js application',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
  const theme = localStorage.getItem('theme') || 'system';
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch (error) {
  console.error('Unable to initialize the theme.', error);
}`}
        </Script>
      </head>
      <body className={firaCode.variable}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

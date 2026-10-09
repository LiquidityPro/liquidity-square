import './globals.css'
import type { Metadata } from 'next'
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
      <body className={firaCode.variable}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

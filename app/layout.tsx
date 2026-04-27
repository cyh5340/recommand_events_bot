import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EventMatch — AI-Powered Event Discovery',
  description:
    'Get instant, personalized event recommendations across Lu.ma, Eventbrite, Meetup, and more — powered by Gemini AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={geist.className}>{children}</body>
    </html>
  )
}

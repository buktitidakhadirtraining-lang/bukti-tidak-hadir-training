// Sistem Data Ketidakhadiran Peserta Training — dibuat oleh Bang Ajiib (2026)
// app/layout.js
import { Montserrat, Nunito } from 'next/font/google';
import Providers from '../components/Providers.js';
import { LOGO_URL, APP_NAME, APP_DESCRIPTION } from '../lib/config.js';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  authors: [{ name: 'Bang Ajiib' }],
  creator: 'Bang Ajiib',
  publisher: 'Bang Ajiib',
  generator: 'Bang Ajiib - Sistem Ketidakhadiran Training (2026)',
  other: {
    copyright: 'Copyright © 2026 Bang Ajiib. All rights reserved.',
  },
  icons: {
    icon: LOGO_URL,
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${montserrat.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-[#F4F7F6] text-gray-800" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

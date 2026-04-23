import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'מגדל 1 תל אביב — ניהול נכס',
  description: 'מערכת ניהול ועד בית',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Nunito', -apple-system, sans-serif; background: #FBF8F3; color: #2C2118; }
          a { color: inherit; text-decoration: none; }
          button, input, select, textarea { font-family: inherit; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}

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
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #f5f4f0; color: #111; }
          a { color: inherit; text-decoration: none; }
          button { font-family: inherit; }
          input, select, textarea { font-family: inherit; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}

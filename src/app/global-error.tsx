'use client'

// Last-resort boundary for errors thrown by the root layout itself (e.g. the
// session lookup failing because the database is unreachable), which
// error.tsx cannot catch. It replaces the whole document, so it renders its
// own <html>/<body> and relies on no app styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F4F6FB', color: '#172554' }}>
        <div style={{ maxWidth: 480, margin: '96px auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>The application could not load</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>
            This is usually temporary (for example the database being unreachable). Try again in a moment.
          </p>
          {error.digest && <p style={{ color: '#94A3B8', fontSize: 12 }}>Reference: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, border: 0, background: '#4F46E5', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

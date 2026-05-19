'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Root-layout error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc' }}>
        <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '6rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>500</p>
          <h1 style={{ marginTop: '0.5rem', fontSize: '1.875rem', fontWeight: 700, color: '#0f172a' }}>
            Something went very wrong
          </h1>
          <p style={{ marginTop: '1rem', color: '#475569' }}>
            The app failed to load. Please reload the page.
          </p>
          <div style={{ marginTop: '2rem' }}>
            <button onClick={reset} style={{
              backgroundColor: '#0ea5e9', color: 'white', padding: '0.5rem 1rem',
              borderRadius: '0.375rem', border: 0, cursor: 'pointer',
            }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

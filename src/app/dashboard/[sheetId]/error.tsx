'use client';

/**
 * Error boundary for /dashboard/[sheetId].
 *
 * Catches errors thrown by the RSC Page (e.g. invalid sheetId, private sheet,
 * network failure) and shows a human-readable message with a retry button.
 *
 * Must be a Client Component — Next.js requires error boundaries to be client
 * components so they can use the `reset` callback and React hooks.
 */

import { useEffect } from 'react';

interface ErrorProps {
  /** The thrown error, optionally annotated with a `digest` for server logs. */
  error: Error & { digest?: string };
  /** Calling this re-renders the segment from scratch (re-triggers the fetch). */
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to your error-tracking service (e.g. Sentry) here
    console.error('[dashboard/error]', error);
  }, [error]);

  return (
    <main
      style={{
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '4rem auto',
      }}
    >
      <h2 style={{ marginBottom: '0.5rem' }}>
        No se pudo cargar la hoja de cálculo
      </h2>

      <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Verifica que el ID sea correcto y que el documento esté publicado en la
        web como CSV: <em>Archivo → Compartir → Publicar en la web → CSV</em>.
      </p>

      {/* Show the underlying error message for easier debugging */}
      {error.message && (
        <pre
          style={{
            fontSize: '0.75rem',
            color: '#e55',
            background: '#fff0f0',
            border: '1px solid #fcc',
            borderRadius: '6px',
            padding: '0.75rem',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            marginBottom: '1.25rem',
          }}
        >
          {error.message}
        </pre>
      )}

      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.25rem',
          borderRadius: '6px',
          border: '1px solid #ccc',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Reintentar
      </button>
    </main>
  );
}

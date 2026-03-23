import { fetchLogs } from '@/lib/google-sheets';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Actividad' };
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

const ACTION_COLORS: Record<string, string> = {
  'Creó': 'var(--success, #22c55e)',
  'Editó': 'var(--accent)',
  'Eliminó': 'var(--danger, #ef4444)',
};

export default async function LogsPage({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const { sheetId } = await params;
  const logs = await fetchLogs(sheetId);

  return (
    <div style={{ padding: '0 16px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Registro de actividad
        </h1>
        <Link
          href={`/dashboard/${sheetId}`}
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          ← Volver
        </Link>
      </div>

      {logs.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          textAlign: 'center',
          gap: '8px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Sin registros aún
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '320px' }}>
            El registro de actividad aparecerá aquí después de la primera acción en el inventario.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8125rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Fecha y hora', 'Usuario', 'Acción', 'Producto', 'Hoja'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={idx} style={{ borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(log.timestamp)}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {log.userName}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      color: ACTION_COLORS[log.action] ?? 'var(--text-secondary)',
                      fontWeight: 600,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                    {log.itemName}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                    {log.sheetName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

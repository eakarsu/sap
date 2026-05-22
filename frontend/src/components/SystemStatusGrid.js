import React, { useEffect, useState } from 'react';

const BADGE = {
  healthy:  { bg: '#E6F4EA', fg: '#1E8E3E', label: 'HEALTHY'  },
  warning:  { bg: '#FEF7E0', fg: '#B06000', label: 'DEGRADED' },
  critical: { bg: '#FCE8E6', fg: '#C5221F', label: 'DOWN'     },
};

export default function SystemStatusGrid() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/system-status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <div style={{ color: '#C5221F' }}>Error: {err}</div>;
  if (!data) return <div>Loading SAP module health…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#1D2D3E' }}>SAP System Status</h3>
        <span style={{ fontSize: 12, color: '#6A767D' }}>
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {data.modules.map(m => {
          const b = BADGE[m.health] || BADGE.healthy;
          return (
            <div
              key={m.code}
              data-testid={`status-card-${m.code}`}
              style={{
                background: '#fff',
                border: '1px solid #E8EBF0',
                borderLeft: `4px solid ${m.color}`,
                borderRadius: 8,
                padding: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.code}</div>
                <span
                  style={{
                    background: b.bg,
                    color: b.fg,
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                  }}
                >
                  {b.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#354A5F', marginBottom: 8 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#6A767D', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 4 }}>
                <span>Uptime</span>     <span style={{ textAlign: 'right', color: '#1D2D3E', fontWeight: 600 }}>{m.uptime}</span>
                <span>Active users</span><span style={{ textAlign: 'right', color: '#1D2D3E', fontWeight: 600 }}>{m.activeUsers}</span>
                <span>Latency</span>    <span style={{ textAlign: 'right', color: '#1D2D3E', fontWeight: 600 }}>{m.latencyMs} ms</span>
                <span>Status</span>     <span style={{ textAlign: 'right', color: '#1D2D3E', fontWeight: 600 }}>{m.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

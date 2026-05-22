import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function TransactionVolume() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/transaction-volume', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <div style={{ color: '#C5221F' }}>Error: {err}</div>;
  if (!data) return <div>Loading transaction volume…</div>;

  return (
    <div
      data-testid="tx-volume-card"
      style={{
        background: '#fff',
        border: '1px solid #E8EBF0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <h3 style={{ margin: '0 0 4px', color: '#1D2D3E' }}>Transaction Volume — Last 24h</h3>
      <div style={{ fontSize: 12, color: '#6A767D', marginBottom: 12 }}>
        Hourly transaction counts per SAP module
      </div>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={data.series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
            <XAxis dataKey="hour" stroke="#6A767D" fontSize={11} />
            <YAxis stroke="#6A767D" fontSize={11} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.modules.map(m => (
              <Line
                key={m.code}
                type="monotone"
                dataKey={m.code}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

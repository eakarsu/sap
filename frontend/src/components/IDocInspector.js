import React, { useEffect, useState } from 'react';

const ACK_COLOR = (posted) => (posted ? '#1E8E3E' : '#C5221F');

export default function IDocInspector() {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/idoc', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        setList(j.idocs || []);
        if (j.idocs && j.idocs.length) setSelected(j.idocs[0].id);
      })
      .catch(e => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    const token = localStorage.getItem('token');
    fetch(`/api/custom-views/idoc/${selected}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setDetail)
      .catch(e => setErr(String(e)));
  }, [selected]);

  const downloadXml = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/custom-views/idoc/${selected}/xml`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setDownloading(false);
    }
  };

  if (err) return <div style={{ color: '#C5221F' }}>Error: {err}</div>;

  return (
    <div
      data-testid="idoc-inspector"
      style={{
        background: '#fff',
        border: '1px solid #E8EBF0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <h3 style={{ margin: '0 0 12px', color: '#1D2D3E' }}>IDoc Inspector</h3>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#6A767D', fontWeight: 600 }}>IDoc:</label>
        <select
          data-testid="idoc-picker"
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid #CFD7DF',
            borderRadius: 6,
            fontSize: 13,
            minWidth: 260,
          }}
        >
          {list.map(d => (
            <option key={d.id} value={d.id}>
              {d.id} — {d.type} ({d.direction})
            </option>
          ))}
        </select>
        <button
          onClick={downloadXml}
          disabled={!selected || downloading}
          data-testid="idoc-download"
          style={{
            padding: '6px 14px',
            background: '#0070F2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {downloading ? 'Downloading…' : 'Download XML'}
        </button>
      </div>

      {!detail && <div style={{ color: '#6A767D' }}>Select an IDoc…</div>}

      {detail && detail.idoc && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
              padding: 12,
              background: '#FAFBFC',
              borderRadius: 6,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            <div><div style={{ color: '#6A767D' }}>Type</div><div style={{ fontWeight: 600 }}>{detail.idoc.type}</div></div>
            <div><div style={{ color: '#6A767D' }}>Direction</div><div style={{ fontWeight: 600 }}>{detail.idoc.direction}</div></div>
            <div><div style={{ color: '#6A767D' }}>Partner</div><div style={{ fontWeight: 600 }}>{detail.idoc.partner}</div></div>
            <div>
              <div style={{ color: '#6A767D' }}>Acknowledgement</div>
              <div style={{ fontWeight: 600, color: ACK_COLOR(detail.acknowledgement.posted) }}>
                {detail.acknowledgement.code} — {detail.acknowledgement.text}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#6A767D', textTransform: 'uppercase', marginBottom: 8 }}>
            Segments ({detail.idoc.segments.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.idoc.segments.map((s, i) => (
              <div key={i} style={{ border: '1px solid #E8EBF0', borderRadius: 6, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#1D2D3E' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: '#6A767D' }}>{s.desc}</span>
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(s.fields).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#6A767D', padding: '2px 6px', width: 100 }}>{k}</td>
                        <td style={{ color: '#1D2D3E', padding: '2px 6px', fontFamily: 'monospace' }}>{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { fetchBatches, createBatch, deleteBatch, toggleBatchHold } from '../api';

export default function BatchInfo({ config, item, moduleKey }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fifoSuggestion, setFifoSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    batch_number: '', quantity: '', manufacturing_date: '', expiry_date: '', quality_status: 'Released',
  });

  const hasBatches = config?.hasBatches;

  const load = () => {
    if (!hasBatches || !item?.id) return;
    setLoading(true);
    fetchBatches(moduleKey, item.id)
      .then((res) => {
        setBatches(res?.batches || []);
        setFifoSuggestion(res?.fifoSuggestion || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, hasBatches]);

  if (!hasBatches || !item) return null;

  const handleAdd = async () => {
    if (!form.batch_number) return;
    setError('');
    const res = await createBatch(moduleKey, item.id, { ...form, material: item.material || item.name || '' });
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (res?.expiryWarning) {
      setError(res.expiryWarning);
    }
    setForm({ batch_number: '', quantity: '', manufacturing_date: '', expiry_date: '', quality_status: 'Released' });
    setAdding(false);
    load();
  };

  const handleDelete = async (id) => {
    await deleteBatch(id);
    load();
  };

  const handleHold = async (id, action) => {
    await toggleBatchHold(id, action);
    load();
  };

  const urgencyColors = {
    expired: { bg: '#FDEDED', color: '#BB0000' },
    critical: { bg: '#FFF4E5', color: '#E76500' },
    warning: { bg: '#FFFDE5', color: '#998A00' },
    ok: { bg: '#E6F4EA', color: '#1E7E34' },
  };

  const statusColors = {
    'Released': { bg: '#E6F4EA', color: '#1E7E34' },
    'Restricted': { bg: '#FFF4E5', color: '#E76500' },
    'Blocked': { bg: '#FDEDED', color: '#BB0000' },
    'In Quality': { bg: '#E8F4FD', color: '#0070F2' },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Batch / Lot Tracking</h3>
        <button onClick={() => { setAdding(!adding); setError(''); }} style={styles.addBtn}>
          {adding ? 'Cancel' : '+ Add Batch'}
        </button>
      </div>
      {error && <div style={styles.warningBanner}>{error}</div>}
      {adding && (
        <div style={styles.addForm}>
          <input type="text" placeholder="Batch #" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} style={{ ...styles.input, width: 120 }} />
          <input type="number" placeholder="Qty" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={{ ...styles.input, width: 80 }} />
          <input type="date" value={form.manufacturing_date} onChange={e => setForm({ ...form, manufacturing_date: e.target.value })} style={styles.input} />
          <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={styles.input} />
          <select value={form.quality_status} onChange={e => setForm({ ...form, quality_status: e.target.value })} style={styles.input}>
            <option value="Released">Released</option>
            <option value="Restricted">Restricted</option>
            <option value="Blocked">Blocked</option>
            <option value="In Quality">In Quality</option>
          </select>
          <button onClick={handleAdd} style={styles.saveBtn}>Add</button>
        </div>
      )}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading batches...</div>
        ) : batches.length === 0 ? (
          <div style={styles.empty}>No batch records</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Batch #</th>
                <th style={styles.th}>Material</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                <th style={styles.th}>Mfg Date</th>
                <th style={styles.th}>Expiry</th>
                <th style={styles.th}>Days Left</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const sc = statusColors[b.quality_status] || statusColors['Released'];
                const uc = urgencyColors[b.expiry_urgency] || urgencyColors['ok'];
                const isFifo = b.id === fifoSuggestion;
                return (
                  <tr key={b.id} style={{ ...styles.tr, background: isFifo ? '#F0F7FF' : 'transparent' }}>
                    <td style={{ ...styles.td, fontWeight: 600, fontFamily: 'monospace' }}>
                      {b.batch_number}
                      {isFifo && <span style={styles.fifoBadge}>FIFO</span>}
                    </td>
                    <td style={styles.td}>{b.material || '--'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{b.quantity || '--'}</td>
                    <td style={styles.td}>{b.manufacturing_date ? new Date(b.manufacturing_date).toLocaleDateString() : '--'}</td>
                    <td style={styles.td}>{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '--'}</td>
                    <td style={styles.td}>
                      {b.days_remaining !== null ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: uc.bg, color: uc.color,
                        }}>
                          {b.days_remaining <= 0 ? 'EXPIRED' : `${b.days_remaining}d`}
                        </span>
                      ) : '--'}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color }}>{b.quality_status}</span>
                    </td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                      {b.quality_status === 'Released' && (
                        <button onClick={() => handleHold(b.id, 'block')} style={styles.holdBtn} title="Block">Hold</button>
                      )}
                      {b.quality_status === 'Blocked' && b.expiry_urgency !== 'expired' && (
                        <button onClick={() => handleHold(b.id, 'release')} style={styles.releaseBtn} title="Release">Release</button>
                      )}
                      <button onClick={() => handleDelete(b.id)} style={styles.removeBtn}>&times;</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 16, border: '1px solid #E8EBF0', borderRadius: 8, overflow: 'hidden' },
  headingRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: '#FAFBFC', borderBottom: '1px solid #E8EBF0',
  },
  heading: { margin: 0, fontSize: 13, fontWeight: 600, color: '#354A5F', textTransform: 'uppercase', letterSpacing: '0.3px' },
  addBtn: {
    fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  },
  warningBanner: {
    padding: '8px 16px', background: '#FFF4E5', borderBottom: '1px solid #FFE0B2',
    fontSize: 12, color: '#E76500', fontWeight: 500,
  },
  addForm: {
    display: 'flex', gap: 8, padding: '12px 16px', background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0', flexWrap: 'wrap',
  },
  input: {
    padding: '8px 10px', fontSize: 13, border: '1px solid #D1D9E0',
    borderRadius: 6, outline: 'none', boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#0070F2', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  content: { background: '#fff', maxHeight: 320, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600,
    color: '#6A767D', textTransform: 'uppercase', borderBottom: '1px solid #E8EBF0', background: '#FAFBFC',
  },
  tr: { borderBottom: '1px solid #F0F2F5' },
  td: { padding: '9px 12px', fontSize: 13, color: '#354A5F', whiteSpace: 'nowrap' },
  fifoBadge: {
    fontSize: 9, fontWeight: 700, color: '#0070F2', background: '#E8F4FD',
    padding: '1px 6px', borderRadius: 8, marginLeft: 6, verticalAlign: 'middle',
  },
  holdBtn: {
    fontSize: 10, fontWeight: 600, color: '#BB0000', background: '#FDEDED',
    border: '1px solid #F5C6C6', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', marginRight: 4,
  },
  releaseBtn: {
    fontSize: 10, fontWeight: 600, color: '#1E7E34', background: '#E6F4EA',
    border: '1px solid #B7DFC3', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', marginRight: 4,
  },
  removeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#A0AAB4',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
};

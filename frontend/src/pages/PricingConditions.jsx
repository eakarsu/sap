import { useState, useEffect } from 'react';
import { fetchPricingConditions, createPricingCondition, deletePricingCondition, recalculatePricing } from '../api';

export default function PricingConditions({ config, item, moduleKey }) {
  const [conditions, setConditions] = useState([]);
  const [total, setTotal] = useState(0);
  const [parentStatus, setParentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ condition_type: '', description: '', amount: '', percentage: '' });

  const hasPricing = config?.hasPricing;
  const isLocked = parentStatus === 'Approved';

  const load = () => {
    if (!hasPricing || !item?.id) return;
    setLoading(true);
    fetchPricingConditions(moduleKey, item.id)
      .then((res) => {
        setConditions(res?.conditions || []);
        setTotal(res?.total || 0);
        setParentStatus(res?.parentStatus || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, hasPricing]);

  if (!hasPricing || !item) return null;

  const handleAdd = async () => {
    if (!form.condition_type) return;
    setError('');
    const res = await createPricingCondition(moduleKey, item.id, form);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setForm({ condition_type: '', description: '', amount: '', percentage: '' });
    setAdding(false);
    load();
  };

  const handleDelete = async (id) => {
    await deletePricingCondition(id);
    load();
  };

  const handleRecalculate = async () => {
    const res = await recalculatePricing(moduleKey, item.id);
    if (res?.breakdown) {
      setConditions(res.breakdown);
      setTotal(res.total);
    }
  };

  const conditionTypes = [
    { value: 'PR00', label: 'Base Price', color: '#0070F2' },
    { value: 'K004', label: 'Customer Discount', color: '#1E7E34' },
    { value: 'K005', label: 'Material Surcharge', color: '#E76500' },
    { value: 'KF00', label: 'Freight', color: '#8B47D7' },
    { value: 'MWST', label: 'Tax', color: '#BB0000' },
    { value: 'ZN00', label: 'Net Price', color: '#354A5F' },
  ];

  const maxRunning = Math.max(...conditions.map(c => Math.abs(c.running_total || 0)), 1);

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>
          Pricing Conditions
          {isLocked && <span style={styles.lockBadge}>Locked (Approved)</span>}
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleRecalculate} style={styles.recalcBtn}>Recalculate</button>
          {!isLocked && (
            <button onClick={() => { setAdding(!adding); setError(''); }} style={styles.addBtn}>
              {adding ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
      </div>
      {error && <div style={styles.errorBanner}>{error}</div>}
      {adding && !isLocked && (
        <div style={styles.addForm}>
          <select value={form.condition_type} onChange={e => setForm({ ...form, condition_type: e.target.value })} style={styles.input}>
            <option value="">Condition Type...</option>
            {conditionTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.value} - {ct.label}</option>)}
          </select>
          <input type="text" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...styles.input, flex: 1 }} />
          <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...styles.input, width: 100, flex: 'none' }} />
          <input type="number" placeholder="%" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} style={{ ...styles.input, width: 60, flex: 'none' }} />
          <button onClick={handleAdd} style={styles.saveBtn}>Add</button>
        </div>
      )}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading pricing...</div>
        ) : conditions.length === 0 ? (
          <div style={styles.empty}>No pricing conditions defined</div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Step</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>%</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Calc.</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Running Total</th>
                  <th style={styles.th}>Waterfall</th>
                  {!isLocked && <th style={styles.th}></th>}
                </tr>
              </thead>
              <tbody>
                {conditions.map((c, i) => {
                  const ct = conditionTypes.find(t => t.value === c.condition_type);
                  const calcAmt = c.calculated_amount || 0;
                  const runTotal = c.running_total || 0;
                  const barWidth = Math.abs(runTotal) / maxRunning * 100;
                  const isDeduction = calcAmt < 0;
                  return (
                    <tr key={c.id} style={styles.tr}>
                      <td style={styles.td}>{c.step_order || i + 1}</td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 600, color: ct?.color || '#354A5F' }}>{c.condition_type}</span>
                      </td>
                      <td style={styles.td}>{c.description || ct?.label || ''}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(c.amount) ? `$${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '--'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(c.percentage) ? `${c.percentage}%` : '--'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: isDeduction ? '#BB0000' : '#1E7E34' }}>
                        {calcAmt >= 0 ? '+' : ''}{calcAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#1D2D3E' }}>
                        ${runTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...styles.td, width: 80 }}>
                        <div style={styles.barBg}>
                          <div style={{
                            height: 8, borderRadius: 4, width: `${Math.min(barWidth, 100)}%`,
                            background: isDeduction ? '#BB0000' : '#1E7E34',
                          }} />
                        </div>
                      </td>
                      {!isLocked && (
                        <td style={styles.td}>
                          <button onClick={() => handleDelete(c.id)} style={styles.removeBtn}>&times;</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Total:</span>
              <span style={styles.totalValue}>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </>
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
  heading: {
    margin: 0, fontSize: 13, fontWeight: 600, color: '#354A5F', textTransform: 'uppercase',
    letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: 8,
  },
  lockBadge: {
    fontSize: 10, fontWeight: 700, color: '#BB0000', background: '#FDEDED',
    padding: '2px 8px', borderRadius: 8, textTransform: 'none',
  },
  recalcBtn: {
    fontSize: 11, fontWeight: 600, color: '#354A5F', background: '#F0F2F5',
    border: '1px solid #D1D9E0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  },
  addBtn: {
    fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  },
  errorBanner: {
    padding: '8px 16px', background: '#FDEDED', borderBottom: '1px solid #F5C6C6',
    fontSize: 12, color: '#BB0000', fontWeight: 500,
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
  content: { background: '#fff', maxHeight: 360, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600,
    color: '#6A767D', textTransform: 'uppercase', borderBottom: '1px solid #E8EBF0', background: '#FAFBFC',
  },
  tr: { borderBottom: '1px solid #F0F2F5' },
  td: { padding: '9px 12px', fontSize: 13, color: '#354A5F' },
  barBg: { width: '100%', height: 8, background: '#F0F2F5', borderRadius: 4 },
  removeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#A0AAB4',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
    padding: '12px 16px', background: '#F7F8FA', borderTop: '2px solid #E8EBF0',
  },
  totalLabel: { fontSize: 13, fontWeight: 700, color: '#354A5F', textTransform: 'uppercase' },
  totalValue: { fontSize: 16, fontWeight: 700, color: '#1D2D3E', fontFamily: 'monospace' },
};

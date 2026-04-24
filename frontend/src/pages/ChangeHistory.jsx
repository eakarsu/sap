import { useState, useEffect } from 'react';
import { fetchChangeHistory, rollbackChange } from '../api';

export default function ChangeHistory({ item, moduleKey }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', user: '', field: '' });
  const [rollbackConfirm, setRollbackConfirm] = useState(null);

  const load = (f) => {
    if (!item?.id || !moduleKey) return;
    setLoading(true);
    fetchChangeHistory(moduleKey, item.id, f || filters)
      .then((res) => {
        setHistory(res?.history || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!item?.id || !moduleKey) return;
    setHistory([]);
    load({});
  }, [item?.id, moduleKey]);

  if (!item || !moduleKey) return null;
  if (!loading && history.length === 0 && !expanded) return null;

  const handleFilter = () => load();

  const handleRollback = async (auditId) => {
    const res = await rollbackChange(moduleKey, item.id, auditId);
    if (res?.error) {
      alert(res.error);
    } else {
      setRollbackConfirm(null);
      load();
    }
  };

  const allFields = [...new Set(history.flatMap(h => (h.changes || []).map(c => c.field)))];

  return (
    <div style={styles.wrapper}>
      <div style={styles.heading} onClick={() => setExpanded(!expanded)}>
        <span>Change History</span>
        <span style={styles.toggle}>{expanded ? '\u25B2' : '\u25BC'} {history.length} change{history.length !== 1 ? 's' : ''}</span>
      </div>
      {expanded && (
        <div style={styles.content}>
          <div style={styles.filterRow}>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} style={styles.filterInput} placeholder="From" />
            <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} style={styles.filterInput} placeholder="To" />
            <input type="text" value={filters.user} onChange={e => setFilters({ ...filters, user: e.target.value })} style={styles.filterInput} placeholder="User..." />
            <select value={filters.field} onChange={e => setFilters({ ...filters, field: e.target.value })} style={styles.filterInput}>
              <option value="">All fields</option>
              {allFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={handleFilter} style={styles.filterBtn}>Filter</button>
          </div>
          {loading ? (
            <div style={styles.loading}>Loading history...</div>
          ) : history.length === 0 ? (
            <div style={styles.loading}>No history entries found</div>
          ) : (
            <div style={styles.timeline}>
              {history.map((entry, i) => {
                const isRollback = entry.action === 'rollback';
                return (
                  <div key={i} style={styles.entry}>
                    <div style={{ ...styles.dot, background: isRollback ? '#E76500' : '#0070F2' }} />
                    <div style={styles.entryContent}>
                      <div style={styles.entryHeader}>
                        <span style={styles.user}>
                          {entry.changed_by || 'System'}
                          {isRollback && <span style={styles.rollbackTag}>ROLLBACK</span>}
                        </span>
                        <span style={styles.time}>{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      {(entry.changes || []).map((change, ci) => (
                        <div key={ci} style={styles.change}>
                          <span style={styles.fieldName}>{change.field}</span>
                          <span style={styles.oldVal}>{change.old_value || '(empty)'}</span>
                          <span style={styles.arrow}>{'\u2192'}</span>
                          <span style={styles.newVal}>{change.new_value || '(empty)'}</span>
                        </div>
                      ))}
                      {!isRollback && entry.old_values && Object.keys(entry.old_values).length > 0 && (
                        <div style={styles.actionRow}>
                          {rollbackConfirm === entry.id ? (
                            <div style={styles.confirmRow}>
                              <span style={{ fontSize: 12, color: '#E76500' }}>Revert these changes?</span>
                              <button onClick={() => handleRollback(entry.id)} style={styles.confirmBtn}>Yes, Rollback</button>
                              <button onClick={() => setRollbackConfirm(null)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setRollbackConfirm(entry.id)} style={styles.rollbackBtn}>Rollback</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 16, border: '1px solid #E8EBF0', borderRadius: 8, overflow: 'hidden' },
  heading: {
    margin: 0, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#354A5F',
    background: '#FAFBFC', borderBottom: '1px solid #E8EBF0', textTransform: 'uppercase',
    letterSpacing: '0.3px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  toggle: { fontSize: 12, color: '#6A767D', fontWeight: 500, textTransform: 'none' },
  content: { background: '#fff', maxHeight: 420, overflowY: 'auto' },
  filterRow: {
    display: 'flex', gap: 6, padding: '10px 16px', background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0', flexWrap: 'wrap',
  },
  filterInput: {
    padding: '6px 8px', fontSize: 12, border: '1px solid #D1D9E0', borderRadius: 6,
    outline: 'none', boxSizing: 'border-box', minWidth: 80,
  },
  filterBtn: {
    padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, cursor: 'pointer',
  },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  timeline: { padding: '12px 16px' },
  entry: { display: 'flex', gap: 12, marginBottom: 16, position: 'relative' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  entryContent: { flex: 1 },
  entryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  user: { fontSize: 13, fontWeight: 600, color: '#1D2D3E', display: 'flex', alignItems: 'center', gap: 6 },
  rollbackTag: {
    fontSize: 9, fontWeight: 700, color: '#E76500', background: '#FFF4E5',
    padding: '1px 6px', borderRadius: 8, textTransform: 'uppercase',
  },
  time: { fontSize: 11, color: '#A0AAB4' },
  change: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 },
  fieldName: { fontWeight: 600, color: '#354A5F', minWidth: 100 },
  oldVal: {
    color: '#BB0000', background: '#FDEDED', padding: '1px 6px', borderRadius: 4,
    maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  arrow: { color: '#A0AAB4' },
  newVal: {
    color: '#1E7E34', background: '#E6F4EA', padding: '1px 6px', borderRadius: 4,
    maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  actionRow: { marginTop: 6 },
  rollbackBtn: {
    fontSize: 11, fontWeight: 600, color: '#E76500', background: '#FFF4E5',
    border: '1px solid #FFE0B2', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 8 },
  confirmBtn: {
    fontSize: 11, fontWeight: 600, color: '#fff', background: '#E76500',
    border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
  },
  cancelBtn: {
    fontSize: 11, fontWeight: 500, color: '#6A767D', background: '#F0F2F5',
    border: '1px solid #D1D9E0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
  },
};

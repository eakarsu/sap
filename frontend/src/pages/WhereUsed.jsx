import { useState, useEffect } from 'react';
import { fetchWhereUsed } from '../api';

export default function WhereUsed({ config, item, moduleKey }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const whereUsedIn = config?.whereUsedIn;

  useEffect(() => {
    if (!whereUsedIn || whereUsedIn.length === 0 || !item?.id) return;
    setResults([]);
    setLoading(true);
    fetchWhereUsed(moduleKey, item.id)
      .then((res) => {
        setResults(res?.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [item?.id, moduleKey, whereUsedIn]);

  if (!whereUsedIn || whereUsedIn.length === 0 || !item) return null;

  const toggleGroup = (idx) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const totalRefs = results.reduce((sum, g) => sum + (g.totalCount || g.records.length), 0);
  const summaryParts = results.map(g => `${g.totalCount || g.records.length} ${g.module}`);
  const summaryText = summaryParts.length > 0
    ? `Used in ${summaryParts.join(', ')}`
    : '';

  return (
    <div style={styles.wrapper}>
      <h3 style={styles.heading}>Where-Used List</h3>
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Scanning references...</div>
        ) : results.length === 0 ? (
          <div style={styles.empty}>No references found in other modules</div>
        ) : (
          <>
            {summaryText && (
              <div style={styles.summary}>
                <span style={styles.summaryIcon}>{'📊'}</span>
                <span>{summaryText}</span>
                <span style={styles.totalBadge}>{totalRefs} total</span>
              </div>
            )}
            {results.map((group, gi) => {
              const isExpanded = expandedGroups[gi] !== false;
              return (
                <div key={gi} style={styles.group}>
                  <div style={styles.groupHeader} onClick={() => toggleGroup(gi)}>
                    <span style={styles.expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span style={styles.groupModule}>{group.module}</span>
                    <span style={styles.groupCount}>
                      {group.totalCount || group.records.length} record{(group.totalCount || group.records.length) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isExpanded && group.records.map((rec, ri) => (
                    <div key={ri} style={styles.row}>
                      <span style={styles.rowName}>{rec.name || rec.title || rec.number || `#${rec.id}`}</span>
                      <span style={styles.rowField}>via {group.field}</span>
                      {rec.status && <span style={styles.rowStatus}>{rec.status}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 16, border: '1px solid #E8EBF0', borderRadius: 8, overflow: 'hidden' },
  heading: {
    margin: 0, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#354A5F',
    background: '#FAFBFC', borderBottom: '1px solid #E8EBF0', textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  content: { background: '#fff', maxHeight: 360, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  summary: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    background: '#F0F7FF', borderBottom: '1px solid #D6E8FA', fontSize: 13, color: '#0070F2', fontWeight: 500,
  },
  summaryIcon: { fontSize: 14 },
  totalBadge: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#fff', background: '#0070F2',
    padding: '2px 10px', borderRadius: 10,
  },
  group: { borderBottom: '1px solid #F0F2F5' },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    background: '#F7F8FA', cursor: 'pointer',
  },
  expandIcon: { fontSize: 10, color: '#6A767D', width: 14 },
  groupModule: { fontSize: 13, fontWeight: 600, color: '#1D2D3E', textTransform: 'capitalize', flex: 1 },
  groupCount: {
    fontSize: 11, color: '#6A767D', background: '#E8EBF0', padding: '2px 8px', borderRadius: 10,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 38px',
    borderBottom: '1px solid #F5F7FA',
  },
  rowName: { fontSize: 13, color: '#354A5F', flex: 1 },
  rowField: { fontSize: 11, color: '#A0AAB4' },
  rowStatus: {
    fontSize: 11, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    padding: '2px 8px', borderRadius: 10,
  },
};

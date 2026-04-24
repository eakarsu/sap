import { useState, useEffect } from 'react';
import { fetchCrossCompanyLinks, createCrossCompanyLink, deleteCrossCompanyLink, updateCrossCompanyStatus } from '../api';

export default function CrossCompany({ config, item, moduleKey }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    target_company: '', target_module: '', target_id: '', link_type: 'Intercompany',
  });

  const hasCrossCompany = config?.hasCrossCompany;

  const load = () => {
    if (!hasCrossCompany || !item?.id) return;
    setLoading(true);
    fetchCrossCompanyLinks(moduleKey, item.id)
      .then((res) => {
        setLinks(res?.links || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, hasCrossCompany]);

  if (!hasCrossCompany || !item) return null;

  const handleAdd = async () => {
    if (!form.target_company || !form.target_module) return;
    setError('');
    const res = await createCrossCompanyLink(moduleKey, item.id, {
      ...form,
      source_company: item.company_code || item.account_name || 'Default',
    });
    if (res?.error) { setError(res.error); return; }
    setForm({ target_company: '', target_module: '', target_id: '', link_type: 'Intercompany' });
    setAdding(false);
    load();
  };

  const handleDelete = async (id) => {
    await deleteCrossCompanyLink(id);
    load();
  };

  const handleStatusChange = async (id, newStatus) => {
    setError('');
    const res = await updateCrossCompanyStatus(id, newStatus);
    if (res?.error) { setError(res.error); return; }
    load();
  };

  const linkTypeColors = {
    'Intercompany': { bg: '#E8F4FD', color: '#0070F2' },
    'Transfer': { bg: '#F8F5FF', color: '#8B47D7' },
    'Cross-Charge': { bg: '#FFF4E5', color: '#E76500' },
    'Consolidation': { bg: '#E6F4EA', color: '#1E7E34' },
  };

  const statusColors = {
    'Draft': { bg: '#F0F2F5', color: '#6A767D' },
    'Active': { bg: '#E8F4FD', color: '#0070F2' },
    'Reconciled': { bg: '#E6F4EA', color: '#1E7E34' },
    'Closed': { bg: '#F7F8FA', color: '#354A5F' },
  };

  const nextStatusMap = {
    'Draft': 'Active',
    'Active': 'Reconciled',
    'Reconciled': 'Closed',
  };

  const statusActionLabels = {
    'Draft': 'Activate',
    'Active': 'Reconcile',
    'Reconciled': 'Close',
  };

  const moduleOptions = [
    'orders', 'invoices', 'purchase_orders', 'deliveries',
    'stock_transfers', 'general_ledger', 'billing_documents',
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Cross-Company Links</h3>
        <button onClick={() => { setAdding(!adding); setError(''); }} style={styles.addBtn}>
          {adding ? 'Cancel' : '+ Link'}
        </button>
      </div>
      {error && <div style={styles.errorBanner}>{error}</div>}
      {adding && (
        <div style={styles.addForm}>
          <input type="text" placeholder="Target company code" value={form.target_company} onChange={e => setForm({ ...form, target_company: e.target.value })} style={styles.input} />
          <select value={form.target_module} onChange={e => setForm({ ...form, target_module: e.target.value })} style={styles.input}>
            <option value="">Target module...</option>
            {moduleOptions.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
          <input type="text" placeholder="Target record ID" value={form.target_id} onChange={e => setForm({ ...form, target_id: e.target.value })} style={{ ...styles.input, width: 100 }} />
          <select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value })} style={styles.input}>
            <option value="Intercompany">Intercompany</option>
            <option value="Transfer">Transfer</option>
            <option value="Cross-Charge">Cross-Charge</option>
            <option value="Consolidation">Consolidation</option>
          </select>
          <button onClick={handleAdd} style={styles.saveBtn}>Link</button>
        </div>
      )}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading cross-company links...</div>
        ) : links.length === 0 ? (
          <div style={styles.empty}>No cross-company links</div>
        ) : (
          <div style={styles.list}>
            {links.map((link) => {
              const lc = linkTypeColors[link.link_type] || linkTypeColors['Intercompany'];
              const sc = statusColors[link.status] || statusColors['Draft'];
              const nextStatus = nextStatusMap[link.status];
              const actionLabel = statusActionLabels[link.status];
              return (
                <div key={link.id} style={styles.row}>
                  <div style={styles.rowLeft}>
                    <div style={styles.companies}>
                      <div style={styles.companySide}>
                        <span style={styles.sideLabel}>Source</span>
                        <span style={styles.companyBadge}>{link.source_company}</span>
                      </div>
                      <span style={styles.arrow}>{'\u2194'}</span>
                      <div style={styles.companySide}>
                        <span style={styles.sideLabel}>Target</span>
                        <span style={styles.companyBadge}>{link.target_company}</span>
                      </div>
                    </div>
                    <div style={styles.linkDetail}>
                      <span style={{ ...styles.typeBadge, background: lc.bg, color: lc.color }}>{link.link_type}</span>
                      <span style={styles.targetModule}>{(link.target_module || '').replace(/_/g, ' ')}</span>
                      {link.target_id && <span style={styles.targetId}>#{link.target_id}</span>}
                      {link.targetRecord && (
                        <span style={styles.targetName}>{link.targetRecord.name}</span>
                      )}
                      <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color }}>{link.status}</span>
                    </div>
                  </div>
                  <div style={styles.rowActions}>
                    {nextStatus && (
                      <button onClick={() => handleStatusChange(link.id, nextStatus)} style={styles.statusBtn}>
                        {actionLabel}
                      </button>
                    )}
                    <button onClick={() => handleDelete(link.id)} style={styles.removeBtn}>&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
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
  errorBanner: {
    padding: '8px 16px', background: '#FDEDED', borderBottom: '1px solid #F5C6C6',
    fontSize: 12, color: '#BB0000', fontWeight: 500,
  },
  addForm: {
    display: 'flex', gap: 8, padding: '12px 16px', background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0', flexWrap: 'wrap',
  },
  input: {
    flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #D1D9E0',
    borderRadius: 6, outline: 'none', boxSizing: 'border-box', minWidth: 120,
  },
  saveBtn: {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#0070F2', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  content: { background: '#fff', maxHeight: 320, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  list: { padding: 8 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderBottom: '1px solid #F5F7FA',
  },
  rowLeft: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  companies: { display: 'flex', alignItems: 'center', gap: 8 },
  companySide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  sideLabel: { fontSize: 9, color: '#A0AAB4', textTransform: 'uppercase', fontWeight: 600 },
  companyBadge: {
    fontSize: 12, fontWeight: 600, color: '#1D2D3E', background: '#F0F2F5',
    padding: '3px 10px', borderRadius: 6,
  },
  arrow: { fontSize: 14, color: '#A0AAB4' },
  linkDetail: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeBadge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 },
  targetModule: { fontSize: 12, color: '#354A5F', textTransform: 'capitalize' },
  targetId: { fontSize: 11, color: '#A0AAB4', fontFamily: 'monospace' },
  targetName: { fontSize: 12, color: '#0070F2', fontWeight: 500 },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 6 },
  statusBtn: {
    fontSize: 10, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
  },
  removeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#A0AAB4',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
};

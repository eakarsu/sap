import { useState, useEffect } from 'react';
import { fetchOrgTree, orgAssign } from '../api';

export default function OrgAssignment({ config, item, moduleKey }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [reassignForm, setReassignForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const orgFields = config?.orgFields;
  const hasOrgValues = orgFields && orgFields.length > 0 && item && orgFields.some(f => item[f]);

  useEffect(() => {
    if (!orgFields || orgFields.length === 0) return;
    setLoading(true);
    fetchOrgTree()
      .then((res) => {
        setTree(res?.tree || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgFields]);

  if (!orgFields || orgFields.length === 0 || !item) return null;
  if (!hasOrgValues && tree.length === 0) return null;

  const flattenTree = (nodes, result = []) => {
    for (const n of nodes) {
      result.push(n);
      if (n.children) flattenTree(n.children, result);
    }
    return result;
  };

  const allOrgs = flattenTree(tree);

  const orgsByType = {};
  for (const org of allOrgs) {
    if (!orgsByType[org.org_type]) orgsByType[org.org_type] = [];
    orgsByType[org.org_type].push(org);
  }

  const fieldToOrgType = {
    company_code: 'Company Code',
    plant: 'Plant',
    sales_org: 'Sales Org',
    distribution_channel: 'Distribution Channel',
    division: 'Division',
    storage_location: 'Storage Location',
    cost_center: 'Company Code',
  };

  const handleStartReassign = () => {
    const initial = {};
    for (const f of orgFields) {
      if (item[f]) initial[f] = item[f];
    }
    setReassignForm(initial);
    setReassigning(true);
    setError('');
    setSuccess('');
  };

  const handleSaveReassign = async () => {
    setError('');
    setSuccess('');
    const updates = {};
    for (const f of orgFields) {
      if (reassignForm[f] && reassignForm[f] !== item[f]) {
        updates[f] = reassignForm[f];
      }
    }
    if (Object.keys(updates).length === 0) {
      setError('No changes to save');
      return;
    }
    const res = await orgAssign(moduleKey, item.id, updates);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setSuccess('Org assignment updated successfully');
    setReassigning(false);
  };

  const orgTypeColors = {
    'Company Code': { bg: '#E8F4FD', color: '#0070F2', border: '#B8D8F8' },
    'Plant': { bg: '#E6F4EA', color: '#1E7E34', border: '#B7DFC3' },
    'Sales Org': { bg: '#F8F5FF', color: '#8B47D7', border: '#E8DEF8' },
    'Distribution Channel': { bg: '#FFF4E5', color: '#E76500', border: '#FFE0B2' },
    'Division': { bg: '#FFF0F0', color: '#BB0000', border: '#F5C6C6' },
    'Storage Location': { bg: '#F0F2F5', color: '#354A5F', border: '#D1D9E0' },
  };

  const isHighlighted = (node) => {
    return orgFields.some(f => item[f] && (item[f] === node.code || item[f] === node.name));
  };

  const renderNode = (node, depth = 0) => {
    const colors = orgTypeColors[node.org_type] || orgTypeColors['Storage Location'];
    const highlighted = isHighlighted(node);
    return (
      <div key={node.id} style={{ marginLeft: depth * 24, marginBottom: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          background: highlighted ? colors.bg : '#FAFBFC',
          border: highlighted ? `2px solid ${colors.color}` : `1px solid ${colors.border}`,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: colors.color,
            background: '#fff', padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
          }}>{node.org_type}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.color }}>{node.code}</span>
          <span style={{ fontSize: 13, color: '#354A5F' }}>{node.name}</span>
          {highlighted && <span style={styles.highlightBadge}>Current</span>}
          {node.status && <span style={{
            fontSize: 10, marginLeft: 'auto',
            color: node.status === 'Active' ? '#1E7E34' : '#6A767D',
          }}>{node.status}</span>}
        </div>
        {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Organizational Assignment</h3>
        <button onClick={reassigning ? () => setReassigning(false) : handleStartReassign} style={styles.reassignBtn}>
          {reassigning ? 'Cancel' : 'Reassign'}
        </button>
      </div>
      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}
      {reassigning && (
        <div style={styles.reassignForm}>
          {orgFields.map(f => {
            const orgType = fieldToOrgType[f];
            const options = orgType ? (orgsByType[orgType] || []).filter(o => o.status === 'Active') : [];
            return (
              <div key={f} style={styles.reassignField}>
                <label style={styles.reassignLabel}>{f.replace(/_/g, ' ')}</label>
                {options.length > 0 ? (
                  <select
                    value={reassignForm[f] || ''}
                    onChange={e => setReassignForm({ ...reassignForm, [f]: e.target.value })}
                    style={styles.reassignInput}
                  >
                    <option value="">Select...</option>
                    {options.map(o => (
                      <option key={o.id} value={o.code}>{o.code} - {o.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={reassignForm[f] || ''}
                    onChange={e => setReassignForm({ ...reassignForm, [f]: e.target.value })}
                    style={styles.reassignInput}
                  />
                )}
              </div>
            );
          })}
          <button onClick={handleSaveReassign} style={styles.saveBtn}>Save Reassignment</button>
        </div>
      )}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading org structure...</div>
        ) : (
          <div style={styles.treeWrap}>
            <div style={styles.fieldValues}>
              {orgFields.map(f => item[f] && (
                <span key={f} style={styles.fieldBadge}>
                  {f.replace(/_/g, ' ')}: <strong>{item[f]}</strong>
                </span>
              ))}
            </div>
            {tree.length > 0 ? tree.map(node => renderNode(node)) : (
              <div style={styles.empty}>No organizational structure available</div>
            )}
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
  heading: {
    margin: 0, fontSize: 13, fontWeight: 600, color: '#354A5F',
    textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  reassignBtn: {
    fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  },
  errorBanner: {
    padding: '8px 16px', background: '#FDEDED', borderBottom: '1px solid #F5C6C6',
    fontSize: 12, color: '#BB0000', fontWeight: 500,
  },
  successBanner: {
    padding: '8px 16px', background: '#E6F4EA', borderBottom: '1px solid #B7DFC3',
    fontSize: 12, color: '#1E7E34', fontWeight: 500,
  },
  reassignForm: {
    padding: '12px 16px', background: '#F7F8FA', borderBottom: '1px solid #E8EBF0',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  reassignField: { display: 'flex', alignItems: 'center', gap: 10 },
  reassignLabel: {
    fontSize: 12, fontWeight: 600, color: '#354A5F', textTransform: 'capitalize',
    minWidth: 140,
  },
  reassignInput: {
    flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #D1D9E0',
    borderRadius: 6, outline: 'none', boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#0070F2', border: 'none', borderRadius: 6, cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  content: { background: '#fff', maxHeight: 400, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  treeWrap: { padding: 16 },
  fieldValues: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  fieldBadge: {
    fontSize: 12, color: '#354A5F', background: '#F0F2F5',
    padding: '4px 10px', borderRadius: 6, textTransform: 'capitalize',
  },
  highlightBadge: {
    fontSize: 9, fontWeight: 700, color: '#0070F2', background: '#E8F4FD',
    padding: '1px 6px', borderRadius: 8,
  },
};

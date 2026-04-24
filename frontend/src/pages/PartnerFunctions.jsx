import { useState, useEffect, useRef } from 'react';
import { fetchPartnerFunctions, createPartnerFunction, deletePartnerFunction, searchPartners } from '../api';

export default function PartnerFunctions({ config, item, moduleKey }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ role: '', partner_name: '' });
  const [mandatoryRoles, setMandatoryRoles] = useState([]);
  const [missingMandatory, setMissingMandatory] = useState([]);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef(null);

  const roles = config?.partnerRoles;

  const load = () => {
    if (!roles || roles.length === 0 || !item?.id) return;
    setLoading(true);
    fetchPartnerFunctions(moduleKey, item.id)
      .then((res) => {
        setPartners(res?.partners || []);
        setMandatoryRoles(res?.mandatoryRoles || []);
        setMissingMandatory(res?.missingMandatory || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, roles]);

  if (!roles || roles.length === 0 || !item) return null;

  const handleSearch = (value) => {
    setForm({ ...form, partner_name: value });
    setError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimeout.current = setTimeout(async () => {
      const res = await searchPartners(value);
      setSuggestions(res?.results || []);
      setShowSuggestions(true);
    }, 300);
  };

  const selectPartner = (name) => {
    setForm({ ...form, partner_name: name });
    setShowSuggestions(false);
  };

  const handleAdd = async () => {
    if (!form.role || !form.partner_name) return;
    setError('');
    const res = await createPartnerFunction(moduleKey, item.id, form);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setForm({ role: '', partner_name: '' });
    setAdding(false);
    load();
  };

  const handleDelete = async (id) => {
    await deletePartnerFunction(id);
    load();
  };

  const roleColors = {
    'Sold-To': '#0070F2', 'Ship-To': '#498205', 'Bill-To': '#8B47D7',
    'Payer': '#E76500', 'Contact Person': '#354A5F',
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Partner Functions</h3>
        <button onClick={() => { setAdding(!adding); setError(''); }} style={styles.addBtn}>
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>
      {missingMandatory.length > 0 && (
        <div style={styles.warningBanner}>
          Missing mandatory roles: {missingMandatory.map(r => (
            <span key={r} style={styles.missingRole}>{r}</span>
          ))}
        </div>
      )}
      {adding && (
        <div style={styles.addForm}>
          <select value={form.role} onChange={e => { setForm({ ...form, role: e.target.value }); setError(''); }} style={styles.input}>
            <option value="">Select Role...</option>
            {roles.map(r => (
              <option key={r} value={r}>
                {r}{mandatoryRoles.includes(r) ? ' *' : ''}
              </option>
            ))}
          </select>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search partner name..."
              value={form.partner_name}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={styles.input}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={styles.dropdown}>
                {suggestions.map((s, i) => (
                  <div key={i} style={styles.dropdownItem} onMouseDown={() => selectPartner(s.name)}>
                    <span style={styles.dropdownName}>{s.name}</span>
                    <span style={styles.dropdownSource}>{s.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleAdd} style={styles.saveBtn}>Save</button>
        </div>
      )}
      {error && <div style={styles.errorBanner}>{error}</div>}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading partners...</div>
        ) : partners.length === 0 ? (
          <div style={styles.empty}>No partner functions assigned</div>
        ) : (
          <div style={styles.list}>
            {partners.map((p) => (
              <div key={p.id} style={styles.row}>
                <span style={{
                  ...styles.roleBadge,
                  background: (roleColors[p.role] || '#6A767D') + '14',
                  color: roleColors[p.role] || '#6A767D',
                  border: `1px solid ${(roleColors[p.role] || '#6A767D')}30`,
                }}>
                  {p.role}
                  {mandatoryRoles.includes(p.role) && <span style={{ color: '#BB0000', marginLeft: 2 }}>*</span>}
                </span>
                <span style={styles.name}>{p.partner_name}</span>
                <button onClick={() => handleDelete(p.id)} style={styles.removeBtn} title="Remove">&times;</button>
              </div>
            ))}
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
  warningBanner: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    background: '#FFF4E5', borderBottom: '1px solid #FFE0B2', fontSize: 12, color: '#E76500', fontWeight: 500,
    flexWrap: 'wrap',
  },
  missingRole: {
    fontSize: 11, fontWeight: 700, color: '#BB0000', background: '#FDEDED',
    padding: '1px 8px', borderRadius: 8,
  },
  errorBanner: {
    padding: '8px 16px', background: '#FDEDED', borderBottom: '1px solid #F5C6C6',
    fontSize: 12, color: '#BB0000', fontWeight: 500,
  },
  addForm: {
    display: 'flex', gap: 8, padding: '12px 16px', background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0',
  },
  input: {
    flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #D1D9E0',
    borderRadius: 6, outline: 'none', boxSizing: 'border-box', width: '100%',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
    border: '1px solid #D1D9E0', borderRadius: '0 0 6px 6px', maxHeight: 180,
    overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  dropdownItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #F5F7FA',
    fontSize: 13,
  },
  dropdownName: { color: '#1D2D3E', fontWeight: 500 },
  dropdownSource: { fontSize: 10, color: '#A0AAB4', textTransform: 'capitalize' },
  saveBtn: {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#0070F2', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  content: { background: '#fff', maxHeight: 260, overflowY: 'auto' },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  list: { padding: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #F5F7FA' },
  roleBadge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, whiteSpace: 'nowrap' },
  name: { fontSize: 13, color: '#354A5F', flex: 1 },
  removeBtn: { background: 'none', border: 'none', fontSize: 18, color: '#A0AAB4', cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
};

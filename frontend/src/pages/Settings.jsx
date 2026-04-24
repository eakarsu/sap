import { useState, useEffect } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser } from '../api';
import { modules, moduleList } from '../modules';
import { FiSettings, FiUsers, FiServer, FiUser, FiInfo, FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';

const PRIMARY = '#0070F2';
const LIGHT_BG = '#F7F7F7';
const BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const TEXT = '#32363A';
const TEXT_SEC = '#6A6D70';

const styles = {
  page: { padding: '24px 32px', fontFamily: "'72', sans-serif", color: TEXT, minHeight: '100vh', background: LIGHT_BG },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, color: TEXT },
  tabs: { display: 'flex', gap: 0, borderBottom: `2px solid ${BORDER}`, marginBottom: 24 },
  tab: (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', cursor: 'pointer',
    fontWeight: active ? 600 : 400, color: active ? PRIMARY : TEXT_SEC, fontSize: 14,
    borderBottom: active ? `3px solid ${PRIMARY}` : '3px solid transparent',
    background: 'none', border: 'none', transition: 'all 0.2s',
  }),
  card: { background: WHITE, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 24, marginBottom: 16 },
  btn: (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4,
    border: variant === 'outline' ? `1px solid ${PRIMARY}` : 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: variant === 'primary' ? PRIMARY : variant === 'danger' ? '#BB0000' : 'transparent',
    color: variant === 'primary' || variant === 'danger' ? WHITE : PRIMARY,
  }),
  input: { padding: '8px 12px', borderRadius: 4, border: `1px solid ${BORDER}`, fontSize: 13, width: '100%', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${BORDER}`, fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 13 },
  label: { fontSize: 12, fontWeight: 600, color: TEXT_SEC, marginBottom: 4, display: 'block' },
  configRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${BORDER}` },
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'viewer' });
  const [profile, setProfile] = useState({ full_name: '', email: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'profile') {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      setProfile({ full_name: stored.full_name || '', email: stored.email || '' });
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try { const res = await fetchUsers(); setUsers(Array.isArray(res) ? res : res?.data || []); } catch { setUsers([]); }
  };

  const resetForm = () => { setForm({ full_name: '', email: '', password: '', role: 'viewer' }); setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateUser(editingId, { full_name: form.full_name, email: form.email, role: form.role });
      } else {
        await createUser(form);
      }
      resetForm(); loadUsers(); setMsg('User saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('Error saving user'); setTimeout(() => setMsg(''), 3000); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try { await deleteUser(id); loadUsers(); } catch { setMsg('Error deleting user'); }
  };

  const startEdit = (u) => { setForm({ full_name: u.full_name, email: u.email, password: '', role: u.role }); setEditingId(u.id); setShowForm(true); };

  const saveProfile = () => {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...stored, ...profile }));
    setMsg('Profile updated'); setTimeout(() => setMsg(''), 3000);
  };

  const tabs = [
    { key: 'users', label: 'User Management', icon: <FiUsers size={16} /> },
    { key: 'system', label: 'System Config', icon: <FiServer size={16} /> },
    { key: 'profile', label: 'Profile', icon: <FiUser size={16} /> },
    { key: 'about', label: 'About', icon: <FiInfo size={16} /> },
  ];

  const configItems = [
    { label: 'Application Name', value: 'SAP CRM' },
    { label: 'Version', value: '2.0.0' },
    { label: 'Total Modules', value: moduleList?.length || 0 },
    { label: 'Database', value: 'PostgreSQL' },
    { label: 'API Port', value: import.meta.env?.VITE_API_PORT || '4002' },
    { label: 'Environment', value: import.meta.env?.MODE || 'production' },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <FiSettings size={22} color={PRIMARY} />
        <span style={styles.title}>Settings</span>
      </div>

      {msg && (
        <div style={{ ...styles.card, background: msg.includes('Error') ? '#FFF3F3' : '#F0FFF0', border: `1px solid ${msg.includes('Error') ? '#BB0000' : '#00875A'}`, marginBottom: 16, padding: '10px 16px', fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={styles.tabs}>
        {tabs.map((t) => (
          <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Users</h3>
            {!showForm && (
              <button style={styles.btn('primary')} onClick={() => { resetForm(); setShowForm(true); }}>
                <FiPlus size={14} /> Add User
              </button>
            )}
          </div>

          {showForm && (
            <div style={{ ...styles.card, background: LIGHT_BG, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>{editingId ? 'Edit User' : 'New User'}</strong>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={resetForm}><FiX size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={styles.label}>Full Name</label>
                  <input style={styles.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full Name" />
                </div>
                <div>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                </div>
                {!editingId && (
                  <div>
                    <label style={styles.label}>Password</label>
                    <input style={styles.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" />
                  </div>
                )}
                <div>
                  <label style={styles.label}>Role</label>
                  <select style={styles.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={styles.btn('primary')} onClick={handleSave}><FiSave size={14} /> Save</button>
                <button style={styles.btn('outline')} onClick={resetForm}>Cancel</button>
              </div>
            </div>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Created</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: TEXT_SEC }}>No users found</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={styles.td}>{u.full_name}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? '#E8F0FE' : u.role === 'manager' ? '#FFF4E5' : '#F0F0F0', color: u.role === 'admin' ? PRIMARY : u.role === 'manager' ? '#E76500' : TEXT_SEC }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={styles.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button style={{ ...styles.btn('outline'), padding: '4px 8px', marginRight: 4 }} onClick={() => startEdit(u)}><FiEdit2 size={13} /></button>
                    <button style={{ ...styles.btn('danger'), padding: '4px 8px' }} onClick={() => handleDelete(u.id)}><FiTrash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'system' && (
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>System Configuration</h3>
          {configItems.map((item, i) => (
            <div key={i} style={styles.configRow}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</span>
              <span style={{ fontSize: 13, color: TEXT_SEC }}>{String(item.value)}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'profile' && (
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Edit Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 500 }}>
            <div>
              <label style={styles.label}>Full Name</label>
              <input style={styles.input} value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
          </div>
          <button style={{ ...styles.btn('primary'), marginTop: 20 }} onClick={saveProfile}><FiSave size={14} /> Save Profile</button>
        </div>
      )}

      {activeTab === 'about' && (
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: PRIMARY, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FiSettings size={32} color={WHITE} />
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>SAP CRM</h2>
            <p style={{ color: TEXT_SEC, margin: '0 0 24px', fontSize: 13 }}>Version 2.0.0</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 600, margin: '0 auto' }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: PRIMARY }}>Features</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2, color: TEXT_SEC }}>
                <li>Customer Management</li>
                <li>Sales Pipeline</li>
                <li>Contact Tracking</li>
                <li>Reporting & Analytics</li>
                <li>{moduleList?.length || 0} Active Modules</li>
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: PRIMARY }}>Tech Stack</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2, color: TEXT_SEC }}>
                <li>React + Vite</li>
                <li>Node.js / Express</li>
                <li>PostgreSQL</li>
                <li>SAP Fiori Design</li>
                <li>REST API</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

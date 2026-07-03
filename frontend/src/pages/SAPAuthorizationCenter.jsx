import { useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiKey,
  FiLock,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiUserPlus,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import {
  assignSapAuthRole,
  fetchSapAuthOverview,
  saveSapAuthRole,
  simulateSapAccess,
} from '../api';

const tabs = [
  { key: 'roles', label: 'Roles' },
  { key: 'objects', label: 'Auth Objects' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'audit', label: 'Audit' },
];

function Card({ children, style }) {
  return <div style={{ background:'#fff', border:'1px solid #E8EBF0', borderRadius:8, padding:16, ...style }}>{children}</div>;
}

function Badge({ value }) {
  const v = String(value || '').toLowerCase();
  const color = v === 'critical' || v === 'denied' ? ['#FDEDED', '#BB0000'] : v === 'high' ? ['#FFF4E5', '#E76500'] : v === 'allowed' || v === 'business' ? ['#E6F4EA', '#1E7E34'] : ['#E8F4FD', '#0070F2'];
  return <span style={{ padding:'4px 9px', borderRadius:12, background:color[0], color:color[1], fontSize:11, fontWeight:800, textTransform:'capitalize', whiteSpace:'nowrap' }}>{String(value || 'unknown')}</span>;
}

function Metric({ label, value, icon: Icon, tone }) {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:tone === 'red' ? '#FDEDED' : tone === 'orange' ? '#FFF4E5' : '#E8F4FD', color:tone === 'red' ? '#BB0000' : tone === 'orange' ? '#E76500' : '#0070F2' }}>
          <Icon size={20} />
        </div>
        <div>
          <div style={{ fontSize:26, color:'#1D2D3E', fontWeight:800 }}>{value}</div>
          <div style={{ fontSize:12, color:'#6A767D', fontWeight:800, textTransform:'uppercase' }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function AuthPreview({ authorizations }) {
  const auths = Array.isArray(authorizations) ? authorizations : [];
  if (!auths.length) return <span style={{ color:'#A0AAB4', fontSize:12 }}>No authorizations</span>;
  return (
    <div style={{ display:'grid', gap:6, marginTop:8 }}>
      {auths.slice(0, 3).map((authz, idx) => (
        <div key={idx} style={{ padding:'7px 9px', border:'1px solid #E8EBF0', borderRadius:6, background:'#FAFBFC', fontSize:12, color:'#354A5F' }}>
          <strong>{authz.object}</strong> · {Object.entries(authz.values || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : v}`).join(', ')}
        </div>
      ))}
    </div>
  );
}

export default function SAPAuthorizationCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roles');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [roleForm, setRoleForm] = useState({
    role_key: 'Z_CUSTOM_DISPLAY_ROLE',
    role_name: 'Custom Display Role',
    role_type: 'business',
    description: 'Display access for company code 1000',
    authorizationsText: '[{"object":"F_BKPF_BUK","values":{"BUKRS":["1000"],"ACTVT":["03"]}}]',
    active: true,
  });
  const [assignmentForm, setAssignmentForm] = useState({
    user_email: 'analyst@sapcrm.com',
    role_key: 'Z_CUSTOM_DISPLAY_ROLE',
  });
  const [simulateForm, setSimulateForm] = useState({
    user_email: 'admin@sapcrm.com',
    object_key: 'F_BKPF_BUK',
    requiredValuesText: '{"BUKRS":"1000","ACTVT":"03"}',
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchSapAuthOverview());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const riskLabel = useMemo(() => {
    const score = Number(data?.riskScore || 0);
    if (score >= 70) return 'High';
    if (score >= 45) return 'Medium';
    return 'Controlled';
  }, [data]);

  const handleSaveRole = async () => {
    setBusy('role');
    setMessage('');
    const authorizations = parseJson(roleForm.authorizationsText, []);
    try {
      await saveSapAuthRole({ ...roleForm, authorizations });
      setMessage('Authorization role saved.');
      await load();
    } catch {
      setMessage('Unable to save authorization role.');
    }
    setBusy('');
  };

  const handleAssignRole = async () => {
    setBusy('assignment');
    setMessage('');
    try {
      await assignSapAuthRole(assignmentForm);
      setMessage('Role assignment created.');
      await load();
    } catch {
      setMessage('Unable to create role assignment.');
    }
    setBusy('');
  };

  const handleSimulate = async () => {
    setBusy('simulate');
    setMessage('');
    setSimulation(null);
    try {
      const required_values = parseJson(simulateForm.requiredValuesText, {});
      const result = await simulateSapAccess({ ...simulateForm, required_values });
      setSimulation(result);
      setMessage(result.allowed ? 'Access simulation allowed.' : 'Access simulation denied.');
      await load();
    } catch {
      setMessage('Unable to simulate access.');
    }
    setBusy('');
  };

  if (loading) {
    return <div style={styles.page}><div style={styles.empty}>Loading SAP authorization center...</div></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Authorization Center</h1>
          <p style={styles.subtitle}>Authorization objects, business roles, assignments, access simulation, and audit.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}><FiRefreshCw size={15} /> Refresh</button>
      </div>

      <div style={styles.metrics}>
        <Metric label="Risk Score" value={data?.riskScore ?? '--'} icon={FiShield} tone={data?.riskScore >= 70 ? 'red' : data?.riskScore >= 45 ? 'orange' : 'blue'} />
        <Metric label="Objects" value={data?.summary?.authObjects ?? 0} icon={FiKey} />
        <Metric label="Roles" value={data?.summary?.roles ?? 0} icon={FiUsers} />
        <Metric label="Assignments" value={data?.summary?.assignments ?? 0} icon={FiUserPlus} />
        <Metric label="Privileged" value={data?.summary?.privilegedAssignments ?? 0} icon={FiLock} tone="orange" />
      </div>

      {message && (
        <div style={styles.message}>
          {simulation?.allowed ? <FiCheckCircle size={14} /> : message.includes('denied') ? <FiXCircle size={14} /> : <FiCheckCircle size={14} />}
          {message}
        </div>
      )}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <div style={styles.tabs}>
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ ...styles.tab, ...(activeTab === tab.key ? styles.tabActive : {}) }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          {activeTab === 'roles' && (
            <Card>
              <h2 style={styles.panelTitle}>Business and Technical Roles</h2>
              <div style={styles.list}>
                {(data?.roles || []).map((role) => (
                  <div key={role.id} style={styles.row}>
                    <div style={{ flex:1 }}>
                      <div style={styles.rowTitle}>{role.role_name}</div>
                      <div style={styles.rowSub}>{role.role_key} · {role.description}</div>
                      <AuthPreview authorizations={role.authorizations} />
                    </div>
                    <div style={{ display:'grid', justifyItems:'end', gap:6 }}>
                      <Badge value={role.role_type} />
                      <Badge value={role.active ? 'active' : 'inactive'} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'objects' && (
            <Card>
              <h2 style={styles.panelTitle}>Authorization Object Catalog</h2>
              <div style={styles.table}>
                <div style={styles.th}>Object</div>
                <div style={styles.th}>Module</div>
                <div style={styles.th}>Fields</div>
                <div style={styles.th}>Risk</div>
                {(data?.objects || []).map((object) => (
                  <div key={object.id} style={styles.tr}>
                    <div style={styles.td}><strong>{object.object_key}</strong><br /><span>{object.object_name}</span></div>
                    <div style={styles.td}>{object.module_area}</div>
                    <div style={styles.td}>{(object.fields || []).join(', ')}</div>
                    <div style={styles.td}><Badge value={object.risk_level} /></div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'assignments' && (
            <Card>
              <h2 style={styles.panelTitle}>User Role Assignments</h2>
              <div style={styles.list}>
                {(data?.assignments || []).map((assignment) => (
                  <div key={assignment.id} style={styles.row}>
                    <div>
                      <div style={styles.rowTitle}>{assignment.user_email}</div>
                      <div style={styles.rowSub}>{assignment.role_key} · Valid {new Date(assignment.valid_from).toLocaleDateString()} to {new Date(assignment.valid_to).toLocaleDateString()}</div>
                    </div>
                    <Badge value={assignment.active ? 'active' : 'inactive'} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'audit' && (
            <Card>
              <h2 style={styles.panelTitle}>Authorization Audit</h2>
              <div style={styles.list}>
                {(data?.audit || []).map((event) => (
                  <div key={event.id} style={styles.row}>
                    <div style={{ flex:1 }}>
                      <div style={styles.rowTitle}>{event.action} · {event.object_key || 'N/A'}</div>
                      <div style={styles.rowSub}>{event.user_email || 'system'} · {new Date(event.created_at).toLocaleString()}</div>
                      <div style={{ fontSize:12, color:'#354A5F' }}>{event.reason}</div>
                    </div>
                    <Badge value={event.decision || 'logged'} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Access Simulation</h2>
            <div style={styles.form}>
              <input style={styles.input} value={simulateForm.user_email} onChange={(e) => setSimulateForm({ ...simulateForm, user_email: e.target.value })} placeholder="User email" />
              <input style={styles.input} value={simulateForm.object_key} onChange={(e) => setSimulateForm({ ...simulateForm, object_key: e.target.value })} placeholder="Authorization object" />
              <textarea style={{ ...styles.input, minHeight:84 }} value={simulateForm.requiredValuesText} onChange={(e) => setSimulateForm({ ...simulateForm, requiredValuesText: e.target.value })} />
              <button onClick={handleSimulate} disabled={busy === 'simulate'} style={styles.primaryBtn}>
                <FiShield size={14} />
                {busy === 'simulate' ? 'Checking...' : 'Simulate Access'}
              </button>
              {simulation && (
                <div style={{ padding:12, borderRadius:8, background:simulation.allowed ? '#E6F4EA' : '#FDEDED', border:`1px solid ${simulation.allowed ? '#CDECCB' : '#F5C6C6'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <strong style={{ color:simulation.allowed ? '#1E7E34' : '#BB0000' }}>{simulation.allowed ? 'Allowed' : 'Denied'}</strong>
                    <Badge value={simulation.allowed ? 'allowed' : 'denied'} />
                  </div>
                  <div style={{ fontSize:12, color:'#354A5F', marginTop:6 }}>{simulation.reason}</div>
                  <div style={{ fontSize:12, color:'#6A767D', marginTop:6 }}>Checked roles: {simulation.checkedRoles}</div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Create / Update Role</h2>
            <div style={styles.form}>
              <input style={styles.input} value={roleForm.role_key} onChange={(e) => setRoleForm({ ...roleForm, role_key: e.target.value })} placeholder="Role key" />
              <input style={styles.input} value={roleForm.role_name} onChange={(e) => setRoleForm({ ...roleForm, role_name: e.target.value })} placeholder="Role name" />
              <select style={styles.input} value={roleForm.role_type} onChange={(e) => setRoleForm({ ...roleForm, role_type: e.target.value })}>
                <option value="business">Business</option>
                <option value="technical">Technical</option>
                <option value="composite">Composite</option>
              </select>
              <textarea style={{ ...styles.input, minHeight:62 }} value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
              <textarea style={{ ...styles.input, minHeight:110, fontFamily:'monospace' }} value={roleForm.authorizationsText} onChange={(e) => setRoleForm({ ...roleForm, authorizationsText: e.target.value })} />
              <label style={styles.checkbox}><input type="checkbox" checked={roleForm.active} onChange={(e) => setRoleForm({ ...roleForm, active: e.target.checked })} /> Active role</label>
              <button onClick={handleSaveRole} disabled={busy === 'role'} style={styles.primaryBtn}>
                <FiSave size={14} />
                {busy === 'role' ? 'Saving...' : 'Save Role'}
              </button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Assign Role</h2>
            <div style={styles.form}>
              <input style={styles.input} value={assignmentForm.user_email} onChange={(e) => setAssignmentForm({ ...assignmentForm, user_email: e.target.value })} placeholder="User email" />
              <input style={styles.input} value={assignmentForm.role_key} onChange={(e) => setAssignmentForm({ ...assignmentForm, role_key: e.target.value })} placeholder="Role key" />
              <button onClick={handleAssignRole} disabled={busy === 'assignment'} style={styles.primaryBtn}>
                <FiUserPlus size={14} />
                {busy === 'assignment' ? 'Assigning...' : 'Assign Role'}
              </button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Coverage</h2>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {(data?.capabilities || []).map((item) => (
                <span key={item} style={styles.capability}>{item}</span>
              ))}
            </div>
            <div style={{ marginTop:12, fontSize:12, color:'#6A767D' }}>Current risk posture: <strong>{riskLabel}</strong></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding:'24px 32px', maxWidth:1500, margin:'0 auto' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:18 },
  title: { margin:0, fontSize:24, fontWeight:800, color:'#1D2D3E' },
  subtitle: { margin:'4px 0 0', color:'#6A767D', fontSize:13 },
  metrics: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:16 },
  layout: { display:'grid', gridTemplateColumns:'minmax(0, 1fr) 380px', gap:16, alignItems:'start' },
  refreshBtn: { display:'flex', alignItems:'center', gap:7, padding:'9px 13px', border:'1px solid #D1D9E0', background:'#fff', color:'#354A5F', borderRadius:8, fontWeight:800, cursor:'pointer' },
  message: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', marginBottom:14, background:'#E8F4FD', border:'1px solid #B8D8F8', color:'#0070F2', borderRadius:8, fontSize:13, fontWeight:800 },
  tabs: { display:'flex', gap:8, flexWrap:'wrap' },
  tab: { padding:'8px 12px', border:'1px solid #D1D9E0', borderRadius:8, background:'#fff', color:'#354A5F', fontWeight:800, cursor:'pointer' },
  tabActive: { background:'#E8F4FD', borderColor:'#B8D8F8', color:'#0070F2' },
  panelTitle: { margin:'0 0 12px', fontSize:16, color:'#1D2D3E' },
  list: { display:'grid', gap:10 },
  row: { display:'flex', justifyContent:'space-between', gap:12, padding:12, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  rowTitle: { fontSize:14, color:'#1D2D3E', fontWeight:800 },
  rowSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  form: { display:'grid', gap:9 },
  input: { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', fontFamily:'inherit' },
  checkbox: { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#354A5F', fontWeight:700 },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer' },
  empty: { padding:40, textAlign:'center', color:'#6A767D' },
  table: { display:'grid', gridTemplateColumns:'1.3fr 0.5fr 1.1fr 0.4fr', border:'1px solid #E8EBF0', borderRadius:8, overflow:'hidden' },
  th: { padding:'10px 12px', background:'#FAFBFC', color:'#6A767D', fontSize:11, fontWeight:800, textTransform:'uppercase', borderBottom:'1px solid #E8EBF0' },
  tr: { display:'contents' },
  td: { padding:'12px', borderBottom:'1px solid #F0F2F5', fontSize:13, color:'#354A5F' },
  capability: { padding:'7px 10px', borderRadius:6, background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', fontSize:12, fontWeight:800 },
};

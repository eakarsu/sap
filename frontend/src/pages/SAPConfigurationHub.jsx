import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiCheckCircle,
  FiCpu,
  FiGlobe,
  FiGitBranch,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiShield,
  FiZap,
} from 'react-icons/fi';
import {
  fetchSapConfigOverview,
  reprocessSapIntegration,
  saveSapConfigProfile,
  saveSapLocalizationPack,
  saveSapWorkflowRule,
} from '../api';

const tabs = [
  { key: 'config', label: 'Configuration', icon: FiSettings },
  { key: 'integrations', label: 'Integrations', icon: FiActivity },
  { key: 'workflow', label: 'Workflow Rules', icon: FiGitBranch },
  { key: 'localization', label: 'Localization', icon: FiGlobe },
];

const statusColors = {
  active: ['#E6F4EA', '#1E7E34'],
  healthy: ['#E6F4EA', '#1E7E34'],
  configured: ['#E6F4EA', '#1E7E34'],
  warning: ['#FFF4E5', '#E76500'],
  critical: ['#FDEDED', '#BB0000'],
  error: ['#FDEDED', '#BB0000'],
  inactive: ['#F0F2F5', '#6A767D'],
};

function Badge({ value }) {
  const [bg, color] = statusColors[String(value || '').toLowerCase()] || ['#E8F4FD', '#0070F2'];
  return (
    <span style={{ padding:'4px 9px', borderRadius:12, background:bg, color, fontSize:11, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap' }}>
      {String(value || 'unknown')}
    </span>
  );
}

function Card({ children, style }) {
  return <div style={{ background:'#fff', border:'1px solid #E8EBF0', borderRadius:8, padding:16, ...style }}>{children}</div>;
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      <div style={{ width:34, height:34, borderRadius:8, background:'#E8F4FD', color:'#0070F2', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={17} />
      </div>
      <div>
        <h2 style={{ margin:0, fontSize:17, color:'#1D2D3E' }}>{title}</h2>
        <p style={{ margin:'2px 0 0', fontSize:12, color:'#6A767D' }}>{subtitle}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, detail }) {
  return (
    <Card>
      <div style={{ fontSize:12, color:'#6A767D', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.3px' }}>{label}</div>
      <div style={{ fontSize:28, color:'#1D2D3E', fontWeight:800, marginTop:6 }}>{value}</div>
      <div style={{ fontSize:12, color:'#6A767D', marginTop:4 }}>{detail}</div>
    </Card>
  );
}

function JsonPreview({ value }) {
  const entries = value && typeof value === 'object' ? Object.entries(value) : [];
  if (!entries.length) return <span style={{ color:'#A0AAB4' }}>No settings</span>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {entries.slice(0, 5).map(([key, val]) => (
        <span key={key} style={{ padding:'4px 8px', background:'#F7F8FA', border:'1px solid #E8EBF0', borderRadius:6, fontSize:11, color:'#354A5F' }}>
          <strong>{key}:</strong> {Array.isArray(val) ? val.join(', ') : String(val)}
        </span>
      ))}
    </div>
  );
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SAPConfigurationHub() {
  const [activeTab, setActiveTab] = useState('config');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [profileForm, setProfileForm] = useState({
    area: 'Finance',
    profile_key: 'custom-finance-control',
    profile_name: 'Custom Finance Control Profile',
    owner: 'SAP CoE',
    risk_level: 'medium',
    status: 'active',
    settingsText: '{ "companyCode": "1000", "approvalRequired": true }',
  });
  const [ruleForm, setRuleForm] = useState({
    rule_key: 'custom-release-rule',
    process_area: 'Procure to Pay',
    rule_name: 'Custom Release Rule',
    trigger_condition: 'amount >= 100000',
    approver_roles: 'Manager, Finance Controller',
    sla_hours: 24,
    active: true,
  });
  const [localizationForm, setLocalizationForm] = useState({
    country_code: 'CA',
    country_name: 'Canada',
    tax_model: 'GST/HST/PST',
    e_document_required: false,
    statutory_reporting: 'CRA reporting',
    controls: 'Tax registration validation, Province tax review',
    status: 'configured',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchSapConfigOverview();
      setData(res);
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

  const handleSaveProfile = async () => {
    setSaving('profile');
    setMessage('');
    try {
      let settings = {};
      try { settings = JSON.parse(profileForm.settingsText || '{}'); } catch { settings = { note: profileForm.settingsText }; }
      await saveSapConfigProfile({ ...profileForm, settings });
      setMessage('Configuration profile saved.');
      await load();
    } catch {
      setMessage('Unable to save configuration profile.');
    }
    setSaving('');
  };

  const handleSaveRule = async () => {
    setSaving('rule');
    setMessage('');
    try {
      await saveSapWorkflowRule({ ...ruleForm, approver_roles: parseList(ruleForm.approver_roles) });
      setMessage('Workflow rule saved.');
      await load();
    } catch {
      setMessage('Unable to save workflow rule.');
    }
    setSaving('');
  };

  const handleSaveLocalization = async () => {
    setSaving('localization');
    setMessage('');
    try {
      await saveSapLocalizationPack({ ...localizationForm, controls: parseList(localizationForm.controls) });
      setMessage('Localization pack saved.');
      await load();
    } catch {
      setMessage('Unable to save localization pack.');
    }
    setSaving('');
  };

  const handleReprocess = async (id) => {
    setSaving(`channel-${id}`);
    setMessage('');
    try {
      await reprocessSapIntegration(id);
      setMessage('Integration reprocess queued.');
      await load();
    } catch {
      setMessage('Unable to queue integration reprocess.');
    }
    setSaving('');
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading SAP configuration hub...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Configuration Hub</h1>
          <p style={styles.subtitle}>IMG-style configuration, workflow variants, integration health, and localization readiness.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}>
          <FiRefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div style={styles.metrics}>
        <MiniMetric label="Risk Score" value={data?.riskScore ?? '--'} detail={`${riskLabel} configuration exposure`} />
        <MiniMetric label="Profiles" value={data?.summary?.configurationProfiles ?? 0} detail="Configuration objects" />
        <MiniMetric label="Channels" value={data?.summary?.integrationChannels ?? 0} detail={`${data?.summary?.criticalIntegrations ?? 0} critical`} />
        <MiniMetric label="Workflow Rules" value={data?.summary?.workflowRules ?? 0} detail="Release and approval variants" />
        <MiniMetric label="Countries" value={data?.summary?.localizationPacks ?? 0} detail="Localization packs" />
      </div>

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : {}) }}>
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {message && (
        <div style={styles.message}>
          <FiCheckCircle size={14} />
          {message}
        </div>
      )}

      {activeTab === 'config' && (
        <div style={styles.twoCol}>
          <Card>
            <SectionTitle icon={FiSettings} title="Configuration Profiles" subtitle="Maintain cross-module settings and risk ownership." />
            <div style={styles.list}>
              {(data?.profiles || []).map((profile) => (
                <div key={profile.id} style={styles.row}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={styles.rowTitle}>{profile.profile_name}</div>
                    <div style={styles.rowSub}>{profile.area} · {profile.owner} · {profile.profile_key}</div>
                    <JsonPreview value={profile.settings} />
                  </div>
                  <div style={{ display:'grid', justifyItems:'end', gap:6 }}>
                    <Badge value={profile.status} />
                    <Badge value={profile.risk_level} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={FiSave} title="Add or Update Profile" subtitle="Create IMG-style controls without changing code." />
            <div style={styles.formGrid}>
              <input style={styles.input} value={profileForm.area} onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })} placeholder="Area" />
              <input style={styles.input} value={profileForm.profile_key} onChange={(e) => setProfileForm({ ...profileForm, profile_key: e.target.value })} placeholder="Profile key" />
              <input style={{ ...styles.input, gridColumn:'1 / -1' }} value={profileForm.profile_name} onChange={(e) => setProfileForm({ ...profileForm, profile_name: e.target.value })} placeholder="Profile name" />
              <input style={styles.input} value={profileForm.owner} onChange={(e) => setProfileForm({ ...profileForm, owner: e.target.value })} placeholder="Owner" />
              <select style={styles.input} value={profileForm.risk_level} onChange={(e) => setProfileForm({ ...profileForm, risk_level: e.target.value })}>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="critical">Critical Risk</option>
              </select>
              <textarea style={{ ...styles.input, minHeight:120, gridColumn:'1 / -1' }} value={profileForm.settingsText} onChange={(e) => setProfileForm({ ...profileForm, settingsText: e.target.value })} />
              <button onClick={handleSaveProfile} disabled={saving === 'profile'} style={styles.primaryBtn}>
                <FiSave size={14} />
                {saving === 'profile' ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <Card>
          <SectionTitle icon={FiActivity} title="Integration Channels" subtitle="Monitor connected systems, protocols, message errors, and reprocessing." />
          <div style={styles.table}>
            <div style={styles.tableHead}>Channel</div>
            <div style={styles.tableHead}>Route</div>
            <div style={styles.tableHead}>Protocol</div>
            <div style={styles.tableHead}>Messages</div>
            <div style={styles.tableHead}>Status</div>
            <div style={styles.tableHead}>Action</div>
            {(data?.channels || []).map((channel) => (
              <div key={channel.id} style={styles.tableRow}>
                <div style={styles.cell}>
                  <div style={styles.rowTitle}>{channel.channel_name}</div>
                  <div style={styles.rowSub}>{channel.owner}</div>
                </div>
                <div style={styles.cell}>{channel.source_system} → {channel.target_system}</div>
                <div style={styles.cell}>{channel.protocol}</div>
                <div style={styles.cell}>{channel.throughput_per_hour}/hr · {channel.error_count} errors</div>
                <div style={styles.cell}><Badge value={channel.status} /></div>
                <div style={styles.cell}>
                  <button onClick={() => handleReprocess(channel.id)} disabled={saving === `channel-${channel.id}`} style={styles.smallBtn}>
                    <FiZap size={13} />
                    {saving === `channel-${channel.id}` ? 'Queued...' : 'Reprocess'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'workflow' && (
        <div style={styles.twoCol}>
          <Card>
            <SectionTitle icon={FiGitBranch} title="Workflow Rules" subtitle="Approval, release strategy, and escalation variants." />
            <div style={styles.list}>
              {(data?.rules || []).map((rule) => (
                <div key={rule.id} style={styles.row}>
                  <div style={{ flex:1 }}>
                    <div style={styles.rowTitle}>{rule.rule_name}</div>
                    <div style={styles.rowSub}>{rule.process_area} · SLA {rule.sla_hours}h · {rule.rule_key}</div>
                    <div style={styles.condition}>{rule.trigger_condition}</div>
                    <JsonPreview value={{ approvers: rule.approver_roles }} />
                  </div>
                  <Badge value={rule.active ? 'active' : 'inactive'} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={FiSave} title="Add or Update Rule" subtitle="Make approval rules configurable from the app." />
            <div style={styles.formGrid}>
              <input style={styles.input} value={ruleForm.rule_key} onChange={(e) => setRuleForm({ ...ruleForm, rule_key: e.target.value })} placeholder="Rule key" />
              <input style={styles.input} value={ruleForm.process_area} onChange={(e) => setRuleForm({ ...ruleForm, process_area: e.target.value })} placeholder="Process area" />
              <input style={{ ...styles.input, gridColumn:'1 / -1' }} value={ruleForm.rule_name} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} placeholder="Rule name" />
              <textarea style={{ ...styles.input, minHeight:80, gridColumn:'1 / -1' }} value={ruleForm.trigger_condition} onChange={(e) => setRuleForm({ ...ruleForm, trigger_condition: e.target.value })} />
              <input style={styles.input} value={ruleForm.approver_roles} onChange={(e) => setRuleForm({ ...ruleForm, approver_roles: e.target.value })} placeholder="Approver roles" />
              <input style={styles.input} type="number" value={ruleForm.sla_hours} onChange={(e) => setRuleForm({ ...ruleForm, sla_hours: e.target.value })} placeholder="SLA hours" />
              <label style={styles.checkbox}><input type="checkbox" checked={ruleForm.active} onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })} /> Active rule</label>
              <button onClick={handleSaveRule} disabled={saving === 'rule'} style={styles.primaryBtn}>
                <FiSave size={14} />
                {saving === 'rule' ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'localization' && (
        <div style={styles.twoCol}>
          <Card>
            <SectionTitle icon={FiGlobe} title="Localization Packs" subtitle="Country tax, e-document, and statutory control readiness." />
            <div style={styles.list}>
              {(data?.localization || []).map((pack) => (
                <div key={pack.id} style={styles.row}>
                  <div style={{ flex:1 }}>
                    <div style={styles.rowTitle}>{pack.country_name} ({pack.country_code})</div>
                    <div style={styles.rowSub}>{pack.tax_model} · {pack.statutory_reporting}</div>
                    <JsonPreview value={{ controls: pack.controls }} />
                  </div>
                  <div style={{ display:'grid', justifyItems:'end', gap:6 }}>
                    <Badge value={pack.status} />
                    {pack.e_document_required && <Badge value="e-document" />}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={FiShield} title="Add Localization" subtitle="Add country packs with tax and statutory controls." />
            <div style={styles.formGrid}>
              <input style={styles.input} value={localizationForm.country_code} onChange={(e) => setLocalizationForm({ ...localizationForm, country_code: e.target.value })} placeholder="Country code" />
              <input style={styles.input} value={localizationForm.country_name} onChange={(e) => setLocalizationForm({ ...localizationForm, country_name: e.target.value })} placeholder="Country name" />
              <input style={{ ...styles.input, gridColumn:'1 / -1' }} value={localizationForm.tax_model} onChange={(e) => setLocalizationForm({ ...localizationForm, tax_model: e.target.value })} placeholder="Tax model" />
              <input style={{ ...styles.input, gridColumn:'1 / -1' }} value={localizationForm.statutory_reporting} onChange={(e) => setLocalizationForm({ ...localizationForm, statutory_reporting: e.target.value })} placeholder="Statutory reporting" />
              <textarea style={{ ...styles.input, minHeight:80, gridColumn:'1 / -1' }} value={localizationForm.controls} onChange={(e) => setLocalizationForm({ ...localizationForm, controls: e.target.value })} />
              <label style={styles.checkbox}><input type="checkbox" checked={localizationForm.e_document_required} onChange={(e) => setLocalizationForm({ ...localizationForm, e_document_required: e.target.checked })} /> E-document required</label>
              <button onClick={handleSaveLocalization} disabled={saving === 'localization'} style={styles.primaryBtn}>
                <FiSave size={14} />
                {saving === 'localization' ? 'Saving...' : 'Save Localization'}
              </button>
            </div>
          </Card>
        </div>
      )}

      <Card style={{ marginTop:16 }}>
        <SectionTitle icon={FiCpu} title="Feature Coverage Added" subtitle="Backend and frontend capabilities now available from this cockpit." />
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {(data?.gapsClosed || []).map((gap) => (
            <span key={gap} style={{ padding:'7px 10px', background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', borderRadius:6, fontSize:12, fontWeight:600 }}>
              {gap}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

const styles = {
  page: {
    padding: '24px 32px',
    maxWidth: 1500,
    margin: '0 auto',
  },
  header: {
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    gap:16,
    marginBottom:18,
  },
  title: {
    margin:0,
    fontSize:24,
    color:'#1D2D3E',
    fontWeight:800,
  },
  subtitle: {
    margin:'4px 0 0',
    color:'#6A767D',
    fontSize:13,
  },
  loading: {
    padding:40,
    textAlign:'center',
    color:'#6A767D',
  },
  refreshBtn: {
    display:'flex',
    alignItems:'center',
    gap:7,
    padding:'9px 13px',
    border:'1px solid #D1D9E0',
    background:'#fff',
    color:'#354A5F',
    borderRadius:8,
    fontWeight:700,
    cursor:'pointer',
  },
  metrics: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
    gap:12,
    marginBottom:16,
  },
  tabBtn: {
    display:'flex',
    alignItems:'center',
    gap:7,
    padding:'8px 12px',
    border:'1px solid #D1D9E0',
    borderRadius:8,
    background:'#fff',
    color:'#354A5F',
    fontWeight:700,
    cursor:'pointer',
  },
  tabBtnActive: {
    background:'#E8F4FD',
    color:'#0070F2',
    borderColor:'#B8D8F8',
  },
  message: {
    display:'flex',
    alignItems:'center',
    gap:8,
    padding:'10px 12px',
    marginBottom:14,
    background:'#E6F4EA',
    border:'1px solid #CDECCB',
    color:'#1E7E34',
    borderRadius:8,
    fontSize:13,
    fontWeight:700,
  },
  twoCol: {
    display:'grid',
    gridTemplateColumns:'minmax(0, 1.3fr) minmax(360px, 0.7fr)',
    gap:16,
    alignItems:'start',
  },
  list: {
    display:'grid',
    gap:10,
  },
  row: {
    display:'flex',
    gap:12,
    alignItems:'flex-start',
    padding:'12px',
    border:'1px solid #E8EBF0',
    borderRadius:8,
    background:'#FAFBFC',
  },
  rowTitle: {
    fontSize:14,
    color:'#1D2D3E',
    fontWeight:800,
  },
  rowSub: {
    fontSize:12,
    color:'#6A767D',
    margin:'3px 0 8px',
  },
  condition: {
    padding:'7px 9px',
    background:'#fff',
    border:'1px solid #E8EBF0',
    borderRadius:6,
    color:'#354A5F',
    fontSize:12,
    fontFamily:'monospace',
    marginBottom:8,
  },
  formGrid: {
    display:'grid',
    gridTemplateColumns:'1fr 1fr',
    gap:10,
  },
  input: {
    width:'100%',
    padding:'10px 11px',
    border:'1px solid #D1D9E0',
    borderRadius:7,
    fontSize:13,
    color:'#1D2D3E',
    background:'#fff',
    boxSizing:'border-box',
    fontFamily:'inherit',
  },
  checkbox: {
    display:'flex',
    alignItems:'center',
    gap:8,
    fontSize:13,
    color:'#354A5F',
    fontWeight:700,
  },
  primaryBtn: {
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    gap:7,
    padding:'10px 14px',
    border:'none',
    borderRadius:8,
    background:'#0070F2',
    color:'#fff',
    fontWeight:800,
    cursor:'pointer',
  },
  smallBtn: {
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    gap:6,
    padding:'7px 10px',
    border:'1px solid #B8D8F8',
    borderRadius:7,
    background:'#EFF6FF',
    color:'#0070F2',
    fontWeight:800,
    cursor:'pointer',
    whiteSpace:'nowrap',
  },
  table: {
    display:'grid',
    gridTemplateColumns:'1.4fr 1.2fr 0.7fr 0.8fr 0.6fr 0.7fr',
    border:'1px solid #E8EBF0',
    borderRadius:8,
    overflow:'auto',
  },
  tableHead: {
    padding:'10px 12px',
    background:'#FAFBFC',
    color:'#6A767D',
    fontSize:11,
    fontWeight:800,
    textTransform:'uppercase',
    borderBottom:'1px solid #E8EBF0',
  },
  tableRow: {
    display:'contents',
  },
  cell: {
    padding:'12px',
    borderBottom:'1px solid #F0F2F5',
    fontSize:13,
    color:'#354A5F',
  },
};

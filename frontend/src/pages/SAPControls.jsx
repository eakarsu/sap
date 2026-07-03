import React, { useEffect, useMemo, useState } from 'react';
import {
  evaluateReleaseStrategy,
  createMdgRequest,
  fetchMdgRequests,
  fetchReleaseStrategyEvents,
  fetchSapControlsOverview,
  fetchSapDocumentChain,
  fetchSapIntegrationMonitor,
  fetchSapPeriodClose,
  fetchSapPostings,
  fetchSapSecurity,
  simulateSapPosting,
} from '../api';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiGitBranch,
  FiLayers,
  FiLock,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';

const BLUE = '#0070F2';
const TEXT = '#1D2D3E';
const MUTED = '#6A767D';
const BORDER = '#E8EBF0';
const BG = '#F5F7FA';

const tabs = [
  { key: 'overview', label: 'Control Tower', icon: FiActivity },
  { key: 'security', label: 'Security & SoD', icon: FiShield },
  { key: 'release', label: 'Release Strategy', icon: FiCheckCircle },
  { key: 'mdg', label: 'Master Data Governance', icon: FiLock },
  { key: 'flow', label: 'Document Flow & Posting', icon: FiGitBranch },
  { key: 'integration', label: 'Integration & Close', icon: FiLayers },
];

const statusColor = {
  healthy: '#188918',
  active: BLUE,
  warning: '#E76500',
  critical: '#B00020',
  Ready: '#188918',
  Warning: '#E76500',
};

function money(value, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function ShellCard({ title, subtitle, action, children }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h2 style={styles.cardTitle}>{title}</h2>
          {subtitle && <p style={styles.cardSubtitle}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pill({ children, tone = 'active' }) {
  return (
    <span style={{ ...styles.pill, color: statusColor[tone] || BLUE, background: `${statusColor[tone] || BLUE}14` }}>
      {children}
    </span>
  );
}

export default function SAPControls() {
  const [tab, setTab] = useState('overview');

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <h1 style={styles.title}>SAP Enterprise Controls</h1>
          <p style={styles.subtitle}>
            Authorization review, release strategies, master-data governance, document chain posting, integration monitoring, and period-close readiness.
          </p>
        </div>
        <Pill tone="active">S/4HANA control layer</Pill>
      </div>

      <div style={styles.tabs}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}>
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewPanel />}
      {tab === 'security' && <SecurityPanel />}
      {tab === 'release' && <ReleasePanel />}
      {tab === 'mdg' && <MdgPanel />}
      {tab === 'flow' && <FlowPanel />}
      {tab === 'integration' && <IntegrationPanel />}
    </div>
  );
}

function OverviewPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setData(await fetchSapControlsOverview());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={styles.loading}>Loading controls...</div>;

  return (
    <>
      <div style={styles.scoreBand}>
        <div>
          <div style={styles.score}>{data?.healthScore || 0}</div>
          <div style={styles.scoreLabel}>Enterprise readiness score</div>
        </div>
        <div style={styles.scoreCopy}>
          The app now has a control layer on top of the SAP-style CRUD modules: governance queues, release evaluation,
          simulated posting documents, authorization review, document chain visibility, and period-close blockers.
        </div>
      </div>

      <div style={styles.metricsGrid}>
        {(data?.cards || []).map((card) => (
          <div key={card.label} style={styles.metric}>
            <div style={styles.metricLabel}>{card.label}</div>
            <div style={styles.metricValue}>{card.value}</div>
            <div style={styles.metricFoot}>
              <Pill tone={card.status}>{card.status}</Pill>
              <span>{card.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <ShellCard title="Gaps Closed" subtitle="Features added beyond table-level CRUD.">
        <div style={styles.checkList}>
          {(data?.gapsClosed || []).map((item) => (
            <div key={item} style={styles.checkItem}><FiCheckCircle size={16} /> {item}</div>
          ))}
        </div>
      </ShellCard>
    </>
  );
}

function SecurityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSapSecurity().then((r) => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <div style={styles.loading}>Loading security review...</div>;

  return (
    <div style={styles.twoCol}>
      <ShellCard title="Authorization Coverage" subtitle={`Risk score ${data?.riskScore || 0} based on privileged roles and conflicts.`}>
        <div style={styles.authList}>
          {(data?.authorizationObjects || []).map((obj) => (
            <div key={obj.object} style={styles.authRow}>
              <div>
                <strong>{obj.object}</strong>
                <div style={styles.small}>{obj.name}</div>
              </div>
              <div style={styles.coverageTrack}>
                <div style={{ ...styles.coverageBar, width: `${obj.coverage}%` }} />
              </div>
              <span style={styles.coverageValue}>{obj.coverage}%</span>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard title="Segregation of Duties" subtitle="Conflicts that need mitigation before production hardening.">
        {(data?.conflicts || []).map((c) => (
          <div key={c.id} style={styles.issue}>
            <div style={styles.issueTop}>
              <strong>{c.id} · {c.area}</strong>
              <Pill tone={c.severity === 'High' ? 'critical' : 'warning'}>{c.severity}</Pill>
            </div>
            <div style={styles.issueText}>{c.conflict}</div>
            <div style={styles.small}>{c.mitigation}</div>
          </div>
        ))}
      </ShellCard>
    </div>
  );
}

function ReleasePanel() {
  const [form, setForm] = useState({ module: 'purchase_orders', record_id: '1', amount: '250000' });
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadEvents = async () => {
    const r = await fetchReleaseStrategyEvents();
    setEvents(r?.events || []);
  };

  useEffect(() => { loadEvents(); }, []);

  const run = async () => {
    setLoading(true);
    const r = await evaluateReleaseStrategy({ ...form, amount: Number(form.amount || 0) });
    setResult(r);
    await loadEvents();
    setLoading(false);
  };

  return (
    <div style={styles.twoCol}>
      <ShellCard title="Evaluate Release Strategy" subtitle="SAP-style threshold routing for purchasing, billing, expenses, and high-value transactions.">
        <div style={styles.formGrid}>
          <label style={styles.label}>Module<select style={styles.input} value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
            <option value="purchase_orders">Purchase Orders</option>
            <option value="billing_documents">Billing Documents</option>
            <option value="expense_reports">Expense Reports</option>
            <option value="orders">Sales Orders</option>
          </select></label>
          <label style={styles.label}>Record ID<input style={styles.input} value={form.record_id} onChange={(e) => setForm({ ...form, record_id: e.target.value })} /></label>
          <label style={styles.label}>Amount<input style={styles.input} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        </div>
        <button style={styles.primaryBtn} onClick={run} disabled={loading}>{loading ? 'Evaluating...' : 'Evaluate Strategy'}</button>
        {result?.evaluation && (
          <div style={styles.resultBox}>
            <div style={styles.resultTitle}>{result.evaluation.strategy}</div>
            <div style={styles.small}>Threshold {result.evaluation.threshold} · SLA {result.evaluation.slaHours} hours</div>
            <div style={styles.approvers}>
              {result.evaluation.requiredApprovers.length
                ? result.evaluation.requiredApprovers.map((a) => <Pill key={a}>{a}</Pill>)
                : <Pill tone="healthy">No manual approver required</Pill>}
            </div>
          </div>
        )}
      </ShellCard>

      <ShellCard title="Recent Release Events" subtitle="Persisted evaluations for audit and testing.">
        <DataTable
          columns={['module', 'amount', 'strategy', 'status']}
          rows={events.map((e) => ({ ...e, amount: money(e.amount) }))}
        />
      </ShellCard>
    </div>
  );
}

function MdgPanel() {
  const [form, setForm] = useState({
    object_type: 'Business Partner',
    object_key: 'BP-100045',
    request_type: 'Change',
    steward: 'Master Data Steward',
    field: 'paymentTerms',
    value: 'Net 45',
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r = await fetchMdgRequests();
    setRequests(r?.requests || []);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setLoading(true);
    await createMdgRequest({
      object_type: form.object_type,
      object_key: form.object_key,
      request_type: form.request_type,
      steward: form.steward,
      changes: { [form.field]: form.value },
    });
    await load();
    setLoading(false);
  };

  return (
    <div style={styles.twoCol}>
      <ShellCard title="Create MDG Request" subtitle="Govern master-data create/change requests before they affect downstream transactions.">
        <div style={styles.formGrid}>
          <label style={styles.label}>Object Type<select style={styles.input} value={form.object_type} onChange={(e) => setForm({ ...form, object_type: e.target.value })}>
            <option>Business Partner</option>
            <option>Material</option>
            <option>Vendor</option>
            <option>Cost Center</option>
          </select></label>
          <label style={styles.label}>Object Key<input style={styles.input} value={form.object_key} onChange={(e) => setForm({ ...form, object_key: e.target.value })} /></label>
          <label style={styles.label}>Request Type<select style={styles.input} value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })}>
            <option>Change</option>
            <option>Create</option>
            <option>Block</option>
            <option>Merge</option>
          </select></label>
          <label style={styles.label}>Steward<input style={styles.input} value={form.steward} onChange={(e) => setForm({ ...form, steward: e.target.value })} /></label>
          <label style={styles.label}>Field<input style={styles.input} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} /></label>
          <label style={styles.label}>New Value<input style={styles.input} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
        </div>
        <button style={styles.primaryBtn} onClick={submit} disabled={loading}>{loading ? 'Submitting...' : 'Submit Governance Request'}</button>
      </ShellCard>

      <ShellCard title="MDG Queue" subtitle="Open master-data requests with risk scoring.">
        <DataTable
          columns={['object_type', 'object_key', 'request_type', 'status', 'risk_score']}
          rows={requests}
        />
      </ShellCard>
    </div>
  );
}

function FlowPanel() {
  const [orderNumber, setOrderNumber] = useState('ORD-2026-001');
  const [chain, setChain] = useState(null);
  const [postings, setPostings] = useState([]);
  const [postingForm, setPostingForm] = useState({ source_module: 'orders', source_id: '1', amount: '5087250', currency: 'EUR' });
  const [message, setMessage] = useState('');

  const loadPostings = async () => {
    const r = await fetchSapPostings();
    setPostings(r?.postings || []);
  };

  const loadChain = async () => {
    const r = await fetchSapDocumentChain(orderNumber);
    setChain(r);
  };

  useEffect(() => { loadChain(); loadPostings(); }, []);

  const post = async () => {
    setMessage('');
    const r = await simulateSapPosting({ ...postingForm, amount: Number(postingForm.amount || 0) });
    setMessage(r?.posting ? `Posted ${r.posting.document_number}` : r?.error || 'Posting failed');
    await loadPostings();
  };

  return (
    <div style={styles.twoCol}>
      <ShellCard
        title="Sales Document Chain"
        subtitle="Follow a sales order into delivery, billing, and accounting posting documents."
        action={<button style={styles.secondaryBtn} onClick={loadChain}><FiRefreshCw size={14} /> Refresh</button>}
      >
        <div style={styles.inlineForm}>
          <input style={styles.input} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          <button style={styles.primaryBtn} onClick={loadChain}>Trace</button>
        </div>
        {chain?.error && <div style={styles.error}>{chain.error}</div>}
        <div style={styles.timeline}>
          {(chain?.chain || []).map((step, index) => (
            <div key={`${step.step}-${step.id}-${index}`} style={styles.timelineItem}>
              <div style={styles.timelineDot}>{index + 1}</div>
              <div>
                <div style={styles.timelineTitle}>{step.step} · {step.key}</div>
                <div style={styles.small}>{step.module} #{step.id} · {step.status || 'Open'} {step.amount ? `· ${money(step.amount)}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard title="Simulate FI/MM Posting" subtitle="Create a balanced accounting document from an app transaction.">
        <div style={styles.formGrid}>
          <label style={styles.label}>Source Module<select style={styles.input} value={postingForm.source_module} onChange={(e) => setPostingForm({ ...postingForm, source_module: e.target.value })}>
            <option value="orders">Sales Order</option>
            <option value="purchase_orders">Purchase Order</option>
            <option value="billing_documents">Billing Document</option>
            <option value="invoices">Invoice</option>
          </select></label>
          <label style={styles.label}>Source ID<input style={styles.input} value={postingForm.source_id} onChange={(e) => setPostingForm({ ...postingForm, source_id: e.target.value })} /></label>
          <label style={styles.label}>Amount<input style={styles.input} type="number" value={postingForm.amount} onChange={(e) => setPostingForm({ ...postingForm, amount: e.target.value })} /></label>
          <label style={styles.label}>Currency<select style={styles.input} value={postingForm.currency} onChange={(e) => setPostingForm({ ...postingForm, currency: e.target.value })}>
            <option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option>
          </select></label>
        </div>
        <button style={styles.primaryBtn} onClick={post}>Post Accounting Document</button>
        {message && <div style={styles.success}>{message}</div>}
        <DataTable
          columns={['document_number', 'source_module', 'amount', 'currency', 'status']}
          rows={postings.map((p) => ({ ...p, amount: money(p.amount, p.currency || 'EUR') }))}
        />
      </ShellCard>
    </div>
  );
}

function IntegrationPanel() {
  const [monitor, setMonitor] = useState(null);
  const [close, setClose] = useState(null);

  const load = async () => {
    const [m, c] = await Promise.all([fetchSapIntegrationMonitor(), fetchSapPeriodClose()]);
    setMonitor(m);
    setClose(c);
  };

  useEffect(() => { load(); }, []);

  const blockers = useMemo(() => (close?.blockers || []).filter((b) => b.count > 0), [close]);

  return (
    <div style={styles.twoCol}>
      <ShellCard title="Integration Monitor" subtitle={`${monitor?.openQueues || 0} queued messages · ${monitor?.warnings || 0} warnings`}>
        {(monitor?.systems || []).map((s) => (
          <div key={s.system} style={styles.integrationRow}>
            <div>
              <strong>{s.system}</strong>
              <div style={styles.small}>{s.interface} · {s.lastMessage}</div>
            </div>
            <div style={styles.integrationMeta}>
              <Pill tone={s.status}>{s.status}</Pill>
              <span>{s.latencyMs} ms</span>
              <span>Queue {s.queueDepth}</span>
            </div>
          </div>
        ))}
      </ShellCard>

      <ShellCard title="Period Close Readiness" subtitle={`${close?.period || ''} close controls`}>
        <div style={styles.readiness}>{close?.readiness ?? 0}%</div>
        <div style={styles.small}>Readiness decreases when AP, AR, billing, invoice, or GR/IR blockers remain open.</div>
        <div style={{ marginTop: 14 }}>
          {(blockers.length ? blockers : close?.blockers || []).map((b) => (
            <div key={b.area} style={styles.issue}>
              <div style={styles.issueTop}>
                <strong>{b.area}</strong>
                <Pill tone={b.count > 0 ? 'warning' : 'healthy'}>{b.count} open</Pill>
              </div>
              <div style={styles.small}>{b.action}</div>
            </div>
          ))}
        </div>
      </ShellCard>
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows?.length) return <div style={styles.empty}>No records yet.</div>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>{columns.map((c) => <th key={c} style={styles.th}>{c.replaceAll('_', ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((c) => <td key={c} style={styles.td}>{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  page: { padding: 20, maxWidth: 1440, margin: '0 auto', color: TEXT },
  hero: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: TEXT },
  subtitle: { margin: '6px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.5, maxWidth: 900 },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${BORDER}`, marginBottom: 16 },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', border: 'none', borderBottom: '2px solid transparent', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  tabActive: { color: BLUE, borderBottomColor: BLUE },
  loading: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, color: MUTED },
  scoreBand: { display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, marginBottom: 16 },
  score: { fontSize: 48, fontWeight: 800, color: BLUE, lineHeight: 1 },
  scoreLabel: { color: MUTED, fontSize: 12, marginTop: 6 },
  scoreCopy: { color: TEXT, fontSize: 14, lineHeight: 1.6, alignSelf: 'center' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 },
  metric: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16 },
  metricLabel: { color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' },
  metricValue: { fontSize: 28, fontWeight: 800, marginTop: 8 },
  metricFoot: { display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 12, marginTop: 10 },
  card: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, minWidth: 0 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  cardTitle: { margin: 0, color: TEXT, fontSize: 17, fontWeight: 700 },
  cardSubtitle: { margin: '4px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.45 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 },
  pill: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
  checkList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, color: TEXT, fontSize: 13, background: BG, borderRadius: 6, padding: 10 },
  authList: { display: 'grid', gap: 12 },
  authRow: { display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 160px 44px', alignItems: 'center', gap: 12 },
  small: { color: MUTED, fontSize: 12, lineHeight: 1.45 },
  coverageTrack: { height: 8, background: BG, borderRadius: 99, overflow: 'hidden' },
  coverageBar: { height: '100%', background: BLUE },
  coverageValue: { fontSize: 12, fontWeight: 700, color: TEXT },
  issue: { border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, marginBottom: 10 },
  issueTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  issueText: { color: TEXT, fontSize: 13, marginBottom: 6 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 },
  label: { display: 'grid', gap: 5, color: MUTED, fontSize: 12, fontWeight: 700 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #D5DADF', borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 13, background: '#fff' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 6, padding: '9px 14px', background: BLUE, color: '#fff', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 12px', background: '#fff', color: TEXT, fontWeight: 700, cursor: 'pointer' },
  resultBox: { border: `1px solid ${BORDER}`, background: BG, borderRadius: 8, padding: 12, marginTop: 12 },
  resultTitle: { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  approvers: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  tableWrap: { overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: 10, background: BG, color: MUTED, textTransform: 'capitalize', borderBottom: `1px solid ${BORDER}` },
  td: { padding: 10, borderBottom: `1px solid ${BORDER}`, color: TEXT, whiteSpace: 'nowrap' },
  empty: { color: MUTED, background: BG, borderRadius: 8, padding: 14, fontSize: 13 },
  inlineForm: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 14 },
  timeline: { display: 'grid', gap: 10 },
  timelineItem: { display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, alignItems: 'start' },
  timelineDot: { width: 26, height: 26, borderRadius: 999, background: `${BLUE}14`, color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 },
  timelineTitle: { fontWeight: 800, fontSize: 13, color: TEXT },
  error: { color: '#B00020', background: '#FFF1F1', border: '1px solid #FFD6D6', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 },
  success: { color: '#188918', background: '#F0FFF4', border: '1px solid #CDEFD8', borderRadius: 8, padding: 10, margin: '10px 0', fontSize: 13 },
  integrationRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` },
  integrationMeta: { display: 'flex', alignItems: 'center', gap: 10, color: MUTED, fontSize: 12 },
  readiness: { fontSize: 42, fontWeight: 800, color: BLUE, lineHeight: 1, marginBottom: 6 },
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboard, fetchAnomalies, explainAnomalies, fetchEnhancedDashboard } from '../api';
import { modules, moduleList } from '../modules';
import {
  FiDollarSign, FiTrendingUp, FiUsers, FiAlertCircle,
  FiBriefcase, FiUserCheck, FiActivity, FiArrowRight, FiX, FiCpu
} from 'react-icons/fi';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0070F2', '#E76500', '#498205', '#BB0000', '#8B47D7', '#00B7C3', '#D14900', '#1B6AC9', '#E3008C', '#354A5F'];

const kpiIcons = {
  pipeline: FiTrendingUp,
  revenue: FiDollarSign,
  leads: FiUsers,
  tickets: FiAlertCircle,
  projects: FiBriefcase,
  employees: FiUserCheck,
};

function formatCurrency(val) {
  if (val == null) return '$0';
  const num = Number(val);
  if (num >= 1_000_000) return '$' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '$' + (num / 1_000).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
}

function formatNumber(val) {
  if (val == null) return '0';
  return Number(val).toLocaleString();
}

function MiniPie({ data, title }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
            label={({ name, value }) => `${name}: ${value}`} labelLine={true}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniBar({ data, title, isCurrency }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6A767D' }} interval={0}
            angle={data.length > 5 ? -25 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'}
            height={data.length > 5 ? 50 : 30} />
          <YAxis tick={{ fontSize: 11, fill: '#6A767D' }} tickFormatter={v => isCurrency ? formatCurrency(v) : v} />
          <Tooltip formatter={v => isCurrency ? formatCurrency(v) : v} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [enhanced, setEnhanced] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const [anomalyExplanation, setAnomalyExplanation] = useState(null);
  const [anomalyExplaining, setAnomalyExplaining] = useState(false);

  const handleExplainAnomalies = async () => {
    setAnomalyExplaining(true);
    setAnomalyExplanation(null);
    try {
      const res = await explainAnomalies(anomalies);
      setAnomalyExplanation(res?.result || 'Unable to explain anomalies.');
    } catch (e) {
      setAnomalyExplanation('Failed to get AI explanation.');
    }
    setAnomalyExplaining(false);
  };

  useEffect(() => {
    fetchDashboard().then((res) => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
    fetchAnomalies().then((res) => {
      setAnomalies(res?.anomalies || []);
    }).catch(() => {});
    fetchEnhancedDashboard().then((res) => {
      setEnhanced(res);
    }).catch(() => {});
  }, []);

  const dismissAlert = (type) => setDismissedAlerts(prev => ({ ...prev, [type]: true }));
  const visibleAnomalies = anomalies.filter(a => !dismissedAlerts[a.type]);

  if (loading) {
    return (
      <div style={styles.loaderWrap}>
        <div style={styles.spinner} />
        <p style={{ color: '#6A767D', marginTop: 16 }}>Loading dashboard...</p>
      </div>
    );
  }

  const kpis = [
    { key: 'pipeline', label: 'Pipeline Value', value: formatCurrency(data?.pipeline_value), color: '#0070F2' },
    { key: 'revenue', label: 'Revenue', value: formatCurrency(data?.total_revenue), color: '#498205' },
    { key: 'leads', label: 'Active Leads', value: formatNumber(data?.active_leads), color: '#E76500' },
    { key: 'tickets', label: 'Open Tickets', value: formatNumber(data?.open_tickets), color: '#D83B01' },
    { key: 'projects', label: 'Active Projects', value: formatNumber(data?.active_projects), color: '#004E8C' },
    { key: 'employees', label: 'Employees', value: formatNumber(data?.total_employees), color: '#E3008C' },
  ];

  const pipelineData = (data?.pipeline_by_phase || []).map(p => ({
    name: p.phase || p.name || 'Unknown',
    value: parseFloat(p.amount) || 0,
  }));

  const topDeals = data?.top_deals || [];
  const recentActivities = data?.recent_activities || [];
  const moduleCounts = data?.module_counts || {};

  // Enhanced chart data
  const invoicesByStatus = (enhanced?.invoices_by_status || []).map(r => ({ name: r.status, value: parseInt(r.count) }));
  const ticketsByPriority = (enhanced?.tickets_by_priority || []).map(r => ({ name: r.priority, value: parseInt(r.count) }));
  const employeesByDept = (enhanced?.employees_by_dept || []).map(r => ({ name: r.department, value: parseInt(r.count) }));
  const expensesByCategory = (enhanced?.expenses_by_category || []).map(r => ({ name: r.category, value: parseFloat(r.total) || 0 }));
  const poByStatus = (enhanced?.po_by_status || []).map(r => ({ name: r.status, value: parseInt(r.count) }));
  const productionByStatus = (enhanced?.production_by_status || []).map(r => ({ name: r.status, value: parseInt(r.count) }));

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>SAP CRM Dashboard</h1>
        <p style={styles.headerSub}>Business overview and key performance indicators</p>
      </div>

      {/* Anomaly Alerts */}
      {visibleAnomalies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {visibleAnomalies.map((a) => (
            <div key={a.type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 10, background: a.severity === 'high' ? '#FFF0F0' : '#FFF8F0', border: `1px solid ${a.severity === 'high' ? '#F5C6C6' : '#FFE0B2'}`, }}>
              <FiAlertCircle size={20} style={{ color: a.severity === 'high' ? '#BB0000' : '#E76500', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: a.severity === 'high' ? '#BB0000' : '#D14900' }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#6A767D', marginTop: 2 }}>{a.description}</div>
              </div>
              {a.module && (
                <button onClick={() => navigate(`/${a.module}`)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD', border: '1px solid #B8D8F8', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>View</button>
              )}
              <button onClick={() => dismissAlert(a.type)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0AAB4', padding: 4, display: 'flex' }}><FiX size={16} /></button>
            </div>
          ))}
          <button onClick={handleExplainAnomalies} disabled={anomalyExplaining}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#8B47D7', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            {anomalyExplaining ? (
              <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Explaining...</>
            ) : (
              <><FiCpu size={14} /> Explain with AI</>
            )}
          </button>
          {anomalyExplanation && (
            <div style={{ padding: '16px 20px', background: '#F8F5FF', border: '1px solid #E8DEF8', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#8B47D7', textTransform: 'uppercase' }}>AI Root Cause Analysis</span>
                <button onClick={() => setAnomalyExplanation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0AAB4', padding: 4, display: 'flex' }}><FiX size={14} /></button>
              </div>
              <div style={{ fontSize: 13, color: '#354A5F', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{anomalyExplanation}</div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const Icon = kpiIcons[kpi.key];
          return (
            <div key={kpi.key} style={styles.kpiCard}>
              <div style={{ ...styles.kpiIcon, background: kpi.color + '14', color: kpi.color }}>
                <Icon size={22} />
              </div>
              <div>
                <p style={styles.kpiLabel}>{kpi.label}</p>
                <p style={{ ...styles.kpiValue, color: kpi.color }}>{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Chart (recharts) + Top Deals Row */}
      <div style={styles.twoCol}>
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Sales Pipeline by Phase</h2>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6A767D' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6A767D' }} tickFormatter={v => formatCurrency(v)} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((_, i) => <Cell key={i} fill={`hsl(${210 + i * 25}, 70%, ${45 + i * 5}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={styles.emptyText}>No pipeline data available</p>
          )}
        </div>

        {/* Top Deals */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Top Deals</h2>
          <div style={styles.dealList}>
            {topDeals.slice(0, 5).map((deal, i) => (
              <div key={i} style={styles.dealRow}>
                <div style={styles.dealRank}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <p style={styles.dealName}>{deal.name}</p>
                  <p style={styles.dealAccount}>{deal.account_name || 'No account'}</p>
                </div>
                <div style={styles.dealAmount}>{formatCurrency(deal.amount)}</div>
              </div>
            ))}
            {topDeals.length === 0 && (
              <p style={styles.emptyText}>No deals available</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial & Service Charts Row */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Financial & Service Overview</h2>
        <div style={styles.chartsGrid}>
          <MiniPie data={invoicesByStatus} title="Invoices by Status" />
          <MiniPie data={ticketsByPriority} title="Open Tickets by Priority" />
          <MiniBar data={expensesByCategory} title="Expenses by Category" isCurrency />
        </div>
      </div>

      {/* HR & Supply Chain Charts Row */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>HR & Supply Chain</h2>
        <div style={styles.chartsGrid}>
          <MiniBar data={employeesByDept} title="Employees by Department" />
          <MiniPie data={poByStatus} title="Purchase Orders by Status" />
          <MiniPie data={productionByStatus} title="Production Orders by Status" />
        </div>
      </div>

      {/* Module Cards Grid */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Modules</h2>
        <div style={styles.moduleGrid}>
          {moduleList.map((mod) => {
            const Icon = mod.icon;
            const count = moduleCounts[mod.key] ?? 0;
            return (
              <div
                key={mod.key}
                style={{ ...styles.moduleCard, borderTop: `3px solid ${mod.color}` }}
                onClick={() => navigate(`/${mod.key}`)}
              >
                <div style={styles.moduleHeader}>
                  <div style={{ ...styles.moduleIcon, background: mod.color + '14', color: mod.color }}>
                    <Icon size={20} />
                  </div>
                  <span style={styles.moduleCount}>{count}</span>
                </div>
                <h3 style={styles.moduleName}>{mod.name}</h3>
                <p style={styles.moduleDesc}>{mod.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activities */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Recent Activities</h2>
        <div style={styles.activityList}>
          {recentActivities.slice(0, 10).map((act, i) => (
            <div key={i} style={styles.activityRow}>
              <div style={styles.activityDot} />
              <div style={{ flex: 1 }}>
                <p style={styles.activityText}>
                  <strong>{act.user_name || 'System'}</strong> {act.action || 'performed an action'}{' '}
                  {act.entity_type && <span style={styles.activityEntity}>{act.entity_type}</span>}
                </p>
                <p style={styles.activityTime}>{act.timestamp ? new Date(act.timestamp).toLocaleString() : ''}</p>
              </div>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <p style={styles.emptyText}>No recent activities</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '24px 32px',
    maxWidth: 1400,
    margin: '0 auto',
  },
  loaderWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #E8EBF0',
    borderTopColor: '#0070F2',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    marginBottom: 28,
  },
  headerTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: '#1D2D3E',
  },
  headerSub: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#6A767D',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    background: '#fff',
    borderRadius: 10,
    padding: '20px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #E8EBF0',
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 500,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  kpiValue: {
    margin: '4px 0 0',
    fontSize: 22,
    fontWeight: 700,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
    marginBottom: 24,
  },
  sectionCard: {
    background: '#fff',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #E8EBF0',
    marginBottom: 24,
  },
  sectionTitle: {
    margin: '0 0 18px',
    fontSize: 17,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16,
  },
  chartCard: {
    background: '#FAFBFC',
    borderRadius: 8,
    border: '1px solid #E8EBF0',
    padding: '14px 14px 6px',
  },
  chartTitle: {
    margin: '0 0 10px',
    fontSize: 13,
    fontWeight: 600,
    color: '#354A5F',
  },
  dealList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  dealRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #F0F2F5',
  },
  dealRank: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#0070F2',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  dealName: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  dealAccount: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#6A767D',
  },
  dealAmount: {
    fontSize: 15,
    fontWeight: 700,
    color: '#498205',
    whiteSpace: 'nowrap',
  },
  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  moduleCard: {
    background: '#FAFBFC',
    borderRadius: 8,
    padding: '18px 16px',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.15s',
    border: '1px solid #E8EBF0',
  },
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleCount: {
    fontSize: 18,
    fontWeight: 700,
    color: '#354A5F',
  },
  moduleName: {
    margin: '0 0 4px',
    fontSize: 14,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  moduleDesc: {
    margin: 0,
    fontSize: 12,
    color: '#6A767D',
    lineHeight: 1.4,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  activityRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #F0F2F5',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#0070F2',
    marginTop: 6,
    flexShrink: 0,
  },
  activityText: {
    margin: 0,
    fontSize: 13,
    color: '#354A5F',
    lineHeight: 1.4,
  },
  activityEntity: {
    background: '#E8F4FD',
    color: '#0070F2',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  },
  activityTime: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#A0AAB4',
  },
  emptyText: {
    color: '#A0AAB4',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
};

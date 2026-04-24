import { useState, useEffect } from 'react';
import { fetchAll } from '../api';
import { modules, moduleList } from '../modules';
import { FiBarChart2, FiDownload, FiFilter, FiFileText, FiPieChart, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';

const PRIMARY = '#0070F2';
const BG = '#F5F6FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E0E0E0';
const TEXT = '#333333';
const TEXT_LIGHT = '#666666';

const quickReports = [
  { title: 'Sales Pipeline Report', icon: FiTrendingUp, module: 'opportunities', color: '#0070F2', label: 'Open Opportunities' },
  { title: 'Revenue by Account', icon: FiBarChart2, module: 'invoices', color: '#2ECC71', label: 'Total Invoices' },
  { title: 'Open Tickets Summary', icon: FiFileText, module: 'tickets', color: '#E74C3C', label: 'Active Tickets' },
  { title: 'Employee Directory', icon: FiPieChart, module: 'employees', color: '#9B59B6', label: 'Employees' },
  { title: 'Campaign Performance', icon: FiFilter, module: 'campaigns', color: '#F39C12', label: 'Campaigns' },
  { title: 'Project Status Overview', icon: FiBarChart2, module: 'projects', color: '#1ABC9C', label: 'Projects' },
];

export default function Reports() {
  const [selectedModule, setSelectedModule] = useState(moduleList[0]?.key || '');
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportCounts, setReportCounts] = useState({});
  const [moduleCounts, setModuleCounts] = useState({});

  useEffect(() => {
    if (selectedModule) loadPreview(selectedModule);
  }, [selectedModule]);

  useEffect(() => {
    loadQuickReports();
    loadModuleCounts();
  }, []);

  const loadPreview = async (key) => {
    setLoading(true);
    try {
      const res = await fetchAll(key);
      setPreviewData((res.data || []).slice(0, 15));
    } catch { setPreviewData([]); }
    setLoading(false);
  };

  const loadQuickReports = async () => {
    const counts = {};
    await Promise.all(quickReports.map(async (r) => {
      try {
        const res = await fetchAll(r.module);
        counts[r.module] = res.total || (res.data || []).length;
      } catch { counts[r.module] = 0; }
    }));
    setReportCounts(counts);
  };

  const loadModuleCounts = async () => {
    const counts = {};
    await Promise.all(moduleList.map(async (m) => {
      try {
        const res = await fetchAll(m.key);
        counts[m.key] = res.total || (res.data || []).length;
      } catch { counts[m.key] = 0; }
    }));
    setModuleCounts(counts);
  };

  const exportCSV = async (moduleKey) => {
    const mod = modules[moduleKey];
    if (!mod) return;
    try {
      const res = await fetchAll(moduleKey);
      const rows = res.data || [];
      if (!rows.length) return alert('No data to export.');
      const cols = mod.columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
      const escape = (v) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = cols.map(c => escape(c.label)).join(',');
      const body = rows.map(r => cols.map(c => escape(r[c.key])).join(',')).join('\n');
      const csv = header + '\n' + body;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moduleKey}_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('Export failed.'); }
  };

  const mod = modules[selectedModule];
  const columns = mod?.columns || (previewData.length ? Object.keys(previewData[0]).map(k => ({ key: k, label: k })) : []);

  return (
    <div style={{ padding: 24, background: BG, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FiBarChart2 size={28} color={PRIMARY} />
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Reports & Analytics</h1>
      </div>

      {/* Quick Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {quickReports.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.module} style={{ background: CARD_BG, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: r.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={r.color} />
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{r.title}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: r.color, marginBottom: 4 }}>
                {reportCounts[r.module] != null ? reportCounts[r.module] : '...'}
              </div>
              <div style={{ fontSize: 12, color: TEXT_LIGHT, marginBottom: 14 }}>{r.label}</div>
              <button onClick={() => exportCSV(r.module)} style={{ width: '100%', padding: '8px 0', background: r.color, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FiDownload size={14} /> Generate & Download CSV
              </button>
            </div>
          );
        })}
      </div>

      {/* Module Data Export */}
      <div style={{ background: CARD_BG, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, marginBottom: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: TEXT }}>Data Export & Preview</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 14, color: TEXT, minWidth: 180 }}>
              {moduleList.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <button onClick={() => loadPreview(selectedModule)} style={{ padding: '8px 12px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: TEXT }}>
              <FiRefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => exportCSV(selectedModule)} style={{ padding: '8px 14px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiDownload size={14} /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: TEXT_LIGHT }}>Loading preview...</div>
        ) : previewData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: TEXT_LIGHT }}>No records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {columns.slice(0, 8).map((c) => (
                    <th key={c.key} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${PRIMARY}`, color: PRIMARY, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#FAFBFC' : '#fff' }}>
                    {columns.slice(0, 8).map((c) => (
                      <td key={c.key} style={{ padding: '9px 12px', borderBottom: `1px solid ${BORDER}`, color: TEXT, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[c.key] != null ? String(row[c.key]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: TEXT_LIGHT, marginTop: 8 }}>Showing first {previewData.length} records (max 15). Export CSV for full dataset.</div>
          </div>
        )}
      </div>

      {/* Record Count Summary */}
      <div style={{ background: CARD_BG, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: TEXT }}>Record Count Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {moduleList.map((m) => (
            <div key={m.key} style={{ padding: '14px 16px', background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 12, color: TEXT_LIGHT, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: PRIMARY }}>
                {moduleCounts[m.key] != null ? moduleCounts[m.key] : '...'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

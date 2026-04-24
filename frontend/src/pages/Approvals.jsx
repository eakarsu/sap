import { useState, useEffect } from 'react';
import { fetchAll, updateItem } from '../api';
import { FiCheckCircle, FiXCircle, FiClock, FiFilter, FiRefreshCw, FiAlertCircle, FiDollarSign, FiCalendar as FiCal, FiFileText } from 'react-icons/fi';

const MODULE_CONFIG = {
  expense_reports: {
    label: 'Expense Report', color: '#E16032', pendingStatus: 'Submitted', approveStatus: 'Approved', rejectStatus: 'Rejected',
    getName: (i) => i.report_number || `ER-${i.id}`, getRequester: (i) => i.employee_name, getAmount: (i) => i.total_amount, getDate: (i) => i.submitted_date,
  },
  leave_requests: {
    label: 'Leave Request', color: '#0070F2', pendingStatus: 'Pending', approveStatus: 'Approved', rejectStatus: 'Rejected',
    getName: (i) => `${i.leave_type || 'Leave'} (${i.days_requested || 0}d)`, getRequester: (i) => i.employee_name, getAmount: () => null, getDate: (i) => i.start_date,
  },
  quotes: {
    label: 'Quote', color: '#945ECF', pendingStatus: 'Sent', approveStatus: 'Approved', rejectStatus: 'Rejected',
    getName: (i) => i.quote_number || i.name || `Q-${i.id}`, getRequester: (i) => i.account_name, getAmount: (i) => i.total, getDate: (i) => i.created_at,
  },
  invoices: {
    label: 'Invoice', color: '#D4A017', pendingStatus: 'Pending', approveStatus: 'Paid', rejectStatus: 'Overdue',
    getName: (i) => i.invoice_number || `INV-${i.id}`, getRequester: (i) => i.account_name, getAmount: (i) => i.total, getDate: (i) => i.due_date,
  },
};

const TABS = ['Pending', 'Approved', 'Rejected'];

export default function Approvals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [actionLoading, setActionLoading] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        Object.keys(MODULE_CONFIG).map(async (mod) => {
          const res = await fetchAll(mod);
          const rows = res?.data || [];
          return rows.map((r) => ({ ...r, _module: mod }));
        })
      );
      setItems(results.flat());
    } catch (e) {
      console.error('Failed to load approval data', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const categorize = (item) => {
    const cfg = MODULE_CONFIG[item._module];
    if (item.status === cfg.pendingStatus) return 'Pending';
    if (item.status === cfg.approveStatus) return 'Approved';
    if (item.status === cfg.rejectStatus) return 'Rejected';
    return null;
  };

  const filtered = items.filter((i) => categorize(i) === activeTab);
  const pendingCount = items.filter((i) => categorize(i) === 'Pending').length;
  const approvedCount = items.filter((i) => categorize(i) === 'Approved').length;
  const rejectedCount = items.filter((i) => categorize(i) === 'Rejected').length;

  const handleAction = async (item, action) => {
    const cfg = MODULE_CONFIG[item._module];
    const newStatus = action === 'approve' ? cfg.approveStatus : cfg.rejectStatus;
    setActionLoading(item.id + item._module);
    try {
      await updateItem(item._module, item.id, { status: newStatus });
      setItems((prev) => prev.map((i) => (i.id === item.id && i._module === item._module ? { ...i, status: newStatus } : i)));
    } catch (e) {
      console.error('Action failed', e);
    }
    setActionLoading(null);
  };

  const fmt = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'72', Arial, sans-serif", background: '#F5F6F7', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#1A1A1A', fontWeight: 600 }}>Approvals Workflow</h1>
          <p style={{ margin: '4px 0 0', color: '#6A6D70', fontSize: 14 }}>Review and manage pending approvals across modules</p>
        </div>
        <button onClick={loadData} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#0070F2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          <FiRefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Pending', count: pendingCount, icon: <FiClock size={20} />, color: '#E9730C' },
          { label: 'Approved', count: approvedCount, icon: <FiCheckCircle size={20} />, color: '#498205' },
          { label: 'Rejected', count: rejectedCount, icon: <FiXCircle size={20} />, color: '#D83B01' },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '16px 20px', border: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>{s.count}</div>
              <div style={{ fontSize: 13, color: '#6A6D70' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E5E5', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '10px 24px', border: 'none', background: 'none', fontSize: 14, fontWeight: activeTab === t ? 600 : 400,
              color: activeTab === t ? '#0070F2' : '#6A6D70', borderBottom: activeTab === t ? '2px solid #0070F2' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer' }}>
            {t} ({t === 'Pending' ? pendingCount : t === 'Approved' ? approvedCount : rejectedCount})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6A6D70' }}>
          <FiRefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} /><br />Loading approvals...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6A6D70' }}>
          <FiFileText size={32} style={{ marginBottom: 8 }} /><br />No {activeTab.toLowerCase()} items found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((item) => {
            const cfg = MODULE_CONFIG[item._module];
            const amount = cfg.getAmount(item);
            const isPending = activeTab === 'Pending';
            const busy = actionLoading === item.id + item._module;
            return (
              <div key={item.id + item._module}
                style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E5E5', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow .15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                {/* Module badge */}
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: cfg.color, borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {cfg.label}
                </span>
                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.getName(item)}</div>
                  <div style={{ fontSize: 13, color: '#6A6D70', marginTop: 2 }}>{cfg.getRequester(item) || 'N/A'}</div>
                </div>
                {/* Amount */}
                {amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                    <FiDollarSign size={14} color="#6A6D70" />{fmt(amount)}
                  </div>
                )}
                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6A6D70', whiteSpace: 'nowrap' }}>
                  <FiCal size={13} />{fmtDate(cfg.getDate(item))}
                </div>
                {/* Status or Actions */}
                {isPending ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={busy} onClick={() => handleAction(item, 'approve')}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: '#498205', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500, opacity: busy ? 0.6 : 1 }}>
                      <FiCheckCircle size={14} /> Approve
                    </button>
                    <button disabled={busy} onClick={() => handleAction(item, 'reject')}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: '#D83B01', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500, opacity: busy ? 0.6 : 1 }}>
                      <FiXCircle size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
                    background: activeTab === 'Approved' ? '#E6F4EA' : '#FDEDED',
                    color: activeTab === 'Approved' ? '#498205' : '#D83B01' }}>
                    {item.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Keyframes for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modules } from '../modules';
import { fetchOne, updateItem, deleteItem } from '../api';
import {
  FiArrowLeft, FiEdit2, FiTrash2, FiSave, FiX,
  FiCalendar, FiClock
} from 'react-icons/fi';

const currencyFields = ['amount', 'revenue', 'salary', 'price', 'cost', 'budget', 'total', 'value',
  'annual_revenue', 'estimated_value', 'actual_cost', 'expected_revenue', 'target_revenue',
  'actual_revenue', 'target_amount', 'best_case', 'committed', 'pipeline', 'closed',
  'total_amount', 'net_amount', 'gross_amount', 'discount', 'tax'];

function getFieldFormat(key) {
  if (currencyFields.some((f) => key.includes(f))) return 'currency';
  return null;
}

function formatDisplayValue(val, format) {
  if (val == null || val === '') return '--';
  if (format === 'currency') {
    return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  if (format === 'percent') {
    return Number(val).toFixed(0) + '%';
  }
  if (format === 'date') {
    return new Date(val).toLocaleDateString();
  }
  if (format === 'datetime') {
    return new Date(val).toLocaleString();
  }
  if (format === 'number') {
    return Number(val).toLocaleString();
  }
  return String(val);
}

function getBadgeClass(val) {
  if (!val) return 'badge-default';
  const v = String(val).toLowerCase();
  if (['active', 'paid', 'won', 'completed', 'hot', 'approved', 'published', 'achieved', 'delivered'].includes(v))
    return 'badge-success';
  if (['in progress', 'warm', 'pending', 'open', 'in process', 'scheduled', 'contacted', 'submitted', 'planning', 'qualified'].includes(v))
    return 'badge-info';
  if (['new', 'draft', 'medium', 'normal', 'not started', 'unread'].includes(v))
    return 'badge-default';
  if (['high', 'overdue', 'critical', 'very high', 'escalated', 'at risk', 'urgent', 'warning'].includes(v))
    return 'badge-warning';
  if (['inactive', 'lost', 'cancelled', 'cold', 'rejected', 'failed', 'terminated', 'missed', 'discontinued', 'disqualified', 'expired', 'error'].includes(v))
    return 'badge-danger';
  return 'badge-default';
}

const badgeColors = {
  'badge-success': { background: '#E6F4EA', color: '#1E7E34' },
  'badge-info': { background: '#E8F4FD', color: '#0070F2' },
  'badge-default': { background: '#F0F2F5', color: '#6A767D' },
  'badge-warning': { background: '#FFF4E5', color: '#E76500' },
  'badge-danger': { background: '#FDEDED', color: '#BB0000' },
};

function getRecordTitle(item, config) {
  if (item.name) return item.name;
  if (item.title) return item.title;
  if (item.subject) return item.subject;
  if (item.first_name || item.last_name) return `${item.first_name || ''} ${item.last_name || ''}`.trim();
  if (item.invoice_number) return item.invoice_number;
  if (item.order_number) return item.order_number;
  if (item.ticket_number) return item.ticket_number;
  if (item.contract_number) return item.contract_number;
  if (item.quote_number) return item.quote_number;
  if (item.work_order_number) return item.work_order_number;
  if (item.payment_number) return item.payment_number;
  if (item.report_number) return item.report_number;
  return config.name + ' Record';
}

export default function DetailPage() {
  const { moduleKey, id } = useParams();
  const navigate = useNavigate();
  const config = modules[moduleKey];
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setEditing(false);
    fetchOne(moduleKey, id).then((res) => {
      const record = res?.data || res;
      setItem(record);
      setEditData(record || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [moduleKey, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateItem(moduleKey, id, editData);
      const updated = res?.data || res;
      setItem(updated);
      setEditData(updated);
      setEditing(false);
    } catch (err) {
      // handle silently
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    await deleteItem(moduleKey, id);
    navigate(`/${moduleKey}`);
  };

  if (!config) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#354A5F' }}>Module not found</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loaderWrap}>
        <div style={styles.spinner} />
        <p style={{ color: '#6A767D', marginTop: 16 }}>Loading record...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#354A5F' }}>Record not found</h2>
        <button onClick={() => navigate(`/${moduleKey}`)} style={styles.backLink}>
          Back to {config.name}
        </button>
      </div>
    );
  }

  const Icon = config.icon;
  const title = getRecordTitle(item, config);
  const status = item.status;
  const statusCls = getBadgeClass(status);

  return (
    <div style={styles.page}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <button onClick={() => navigate(`/${moduleKey}`)} style={styles.backBtn}>
          <FiArrowLeft size={18} />
          <span>Back to {config.name}</span>
        </button>
        <div style={styles.topActions}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setEditData(item); }} style={styles.cancelBtn}>
                <FiX size={16} style={{ marginRight: 6 }} />
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                <FiSave size={16} style={{ marginRight: 6 }} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={styles.editBtn}>
                <FiEdit2 size={16} style={{ marginRight: 6 }} />
                Edit
              </button>
              <button onClick={handleDelete} style={styles.deleteBtn}>
                <FiTrash2 size={16} style={{ marginRight: 6 }} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Record Header */}
      <div style={styles.recordHeader}>
        <div style={{ ...styles.recordIcon, background: config.color + '14', color: config.color }}>
          <Icon size={32} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={styles.recordTitle}>{title}</h1>
          <div style={styles.recordMeta}>
            {status && (
              <span style={{ ...styles.badge, ...badgeColors[statusCls] }}>{status}</span>
            )}
            <span style={styles.metaLabel}>{config.name}</span>
            <span style={styles.metaId}>ID: {item.id}</span>
          </div>
        </div>
      </div>

      {/* Details Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Details</h2>
        <div style={styles.detailGrid}>
          {config.fields.map((field) => {
            const colFormat = config.columns?.find((c) => c.key === field.key);
            const isBadgeField = field.key === 'status' || field.key === 'priority' || field.key === 'qualification' || field.key === 'threat_level' || field.key === 'phase';
            const format = colFormat?.format || getFieldFormat(field.key) || (field.type === 'date' ? 'date' : null) || (field.type === 'datetime-local' ? 'datetime' : null);

            return (
              <div key={field.key} style={field.type === 'textarea' ? styles.detailItemFull : styles.detailItem}>
                <p style={styles.detailLabel}>{field.label}</p>
                {editing ? (
                  field.type === 'select' ? (
                    <select
                      value={editData[field.key] || ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      style={styles.editInput}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={editData[field.key] || ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      style={{ ...styles.editInput, minHeight: 80, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime-local' ? 'datetime-local' : field.type === 'email' ? 'email' : 'text'}
                      value={editData[field.key] || ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      style={styles.editInput}
                    />
                  )
                ) : isBadgeField && item[field.key] ? (
                  <span style={{ ...styles.badge, ...badgeColors[getBadgeClass(item[field.key])] }}>
                    {item[field.key]}
                  </span>
                ) : (
                  <p style={styles.detailValue}>
                    {format === 'currency'
                      ? formatDisplayValue(item[field.key], 'currency')
                      : formatDisplayValue(item[field.key], format)
                    }
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timestamps Card */}
      {(item.created_at || item.updated_at) && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Timestamps</h2>
          <div style={styles.timestampRow}>
            {item.created_at && (
              <div style={styles.timestampItem}>
                <FiCalendar size={16} style={{ color: '#6A767D', marginRight: 8 }} />
                <div>
                  <p style={styles.timestampLabel}>Created</p>
                  <p style={styles.timestampValue}>{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            {item.updated_at && (
              <div style={styles.timestampItem}>
                <FiClock size={16} style={{ color: '#6A767D', marginRight: 8 }} />
                <div>
                  <p style={styles.timestampLabel}>Last Updated</p>
                  <p style={styles.timestampValue}>{new Date(item.updated_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '24px 32px',
    maxWidth: 1100,
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
    width: 36,
    height: 36,
    border: '4px solid #E8EBF0',
    borderTopColor: '#0070F2',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    color: '#0070F2',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '6px 0',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#0070F2',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 12,
  },
  topActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#0070F2',
    background: '#E8F4FD',
    border: '1px solid #B8D8F8',
    borderRadius: 8,
    cursor: 'pointer',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#BB0000',
    background: '#FDEDED',
    border: '1px solid #F5C6C6',
    borderRadius: 8,
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: '#0070F2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6A767D',
    background: '#F0F2F5',
    border: '1px solid #D1D9E0',
    borderRadius: 8,
    cursor: 'pointer',
  },
  recordHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 28,
  },
  recordIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#1D2D3E',
  },
  recordMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  metaLabel: {
    fontSize: 13,
    color: '#6A767D',
    fontWeight: 500,
  },
  metaId: {
    fontSize: 12,
    color: '#A0AAB4',
    fontFamily: 'monospace',
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #E8EBF0',
    marginBottom: 20,
  },
  cardTitle: {
    margin: '0 0 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px 32px',
  },
  detailItem: {},
  detailItemFull: {
    gridColumn: '1 / -1',
  },
  detailLabel: {
    margin: '0 0 4px',
    fontSize: 12,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  detailValue: {
    margin: 0,
    fontSize: 14,
    color: '#1D2D3E',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  editInput: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#F7F8FA',
  },
  timestampRow: {
    display: 'flex',
    gap: 40,
    flexWrap: 'wrap',
  },
  timestampItem: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  timestampLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
  },
  timestampValue: {
    margin: '2px 0 0',
    fontSize: 14,
    color: '#1D2D3E',
  },
};

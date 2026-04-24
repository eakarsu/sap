import { useState, useEffect } from 'react';
import { fetchAll, fetchOne } from '../api';
import { modules } from '../modules';

const currencyFields = ['amount', 'revenue', 'salary', 'price', 'cost', 'budget', 'total', 'value',
  'annual_revenue', 'estimated_value', 'actual_cost', 'expected_revenue', 'target_revenue',
  'actual_revenue', 'target_amount', 'total_amount', 'net_amount', 'gross_amount', 'discount', 'tax'];

function formatVal(val, key) {
  if (val == null || val === '') return '--';
  if (currencyFields.some(f => key.includes(f))) return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(val);
}

function getBadgeStyle(val) {
  if (!val) return null;
  const v = String(val).toLowerCase();
  if (['active', 'paid', 'won', 'completed', 'approved', 'delivered'].includes(v))
    return { background: '#E6F4EA', color: '#1E7E34' };
  if (['in progress', 'pending', 'open', 'scheduled', 'submitted'].includes(v))
    return { background: '#E8F4FD', color: '#0070F2' };
  if (['high', 'overdue', 'critical', 'escalated', 'urgent'].includes(v))
    return { background: '#FFF4E5', color: '#E76500' };
  if (['inactive', 'lost', 'cancelled', 'rejected', 'failed'].includes(v))
    return { background: '#FDEDED', color: '#BB0000' };
  return { background: '#F0F2F5', color: '#6A767D' };
}

function getTitle(rec, modConfig) {
  const modName = modConfig?.name || 'Record';
  // Transactional documents - show document type + number
  if (rec.order_number) return `Sales Order ${rec.order_number}`;
  if (rec.invoice_number) return `Invoice ${rec.invoice_number}`;
  if (rec.quote_number) return `Quote ${rec.quote_number}`;
  if (rec.po_number) return `Purchase Order ${rec.po_number}`;
  if (rec.delivery_number) return `Delivery ${rec.delivery_number}`;
  if (rec.ticket_number) return `Ticket ${rec.ticket_number}`;
  if (rec.contract_number) return `Contract ${rec.contract_number}`;
  if (rec.work_order_number) return `Work Order ${rec.work_order_number}`;
  if (rec.payment_number) return `Payment ${rec.payment_number}`;
  if (rec.report_number) return `Report ${rec.report_number}`;
  if (rec.bom_number) return `BOM ${rec.bom_number}`;
  if (rec.batch_number) return `Batch ${rec.batch_number}`;
  if (rec.routing_number) return `Routing ${rec.routing_number}`;
  if (rec.material_number) return `Material ${rec.material_number}`;
  if (rec.document_number) return `Document ${rec.document_number}`;
  if (rec.requisition_number) return `Requisition ${rec.requisition_number}`;
  if (rec.transfer_number) return `Transfer ${rec.transfer_number}`;
  if (rec.receipt_number) return `Receipt ${rec.receipt_number}`;
  if (rec.shipment_number) return `Shipment ${rec.shipment_number}`;
  if (rec.return_number) return `Return ${rec.return_number}`;
  if (rec.credit_memo_number) return `Credit Memo ${rec.credit_memo_number}`;
  if (rec.debit_memo_number) return `Debit Memo ${rec.debit_memo_number}`;
  // People - show full name
  if (rec.first_name || rec.last_name) return `${rec.first_name || ''} ${rec.last_name || ''}`.trim();
  // Master data / named records
  if (rec.name) return rec.name;
  if (rec.title) return rec.title;
  if (rec.subject) return rec.subject;
  if (rec.material) return `Material: ${rec.material}`;
  if (rec.description) return rec.description.length > 60 ? rec.description.slice(0, 57) + '...' : rec.description;
  return `${modName} #${rec.id}`;
}

export default function RelatedRecords({ config, item }) {
  const [activeTab, setActiveTab] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [popupItem, setPopupItem] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);

  const related = config?.relatedModules;
  const currentRel = related && related.length > 0 ? related[activeTab] : null;
  const relModule = currentRel ? modules[currentRel.module] : null;

  useEffect(() => {
    setRecords([]);
    if (!currentRel || !item) return;
    const searchVal = item[currentRel.localKey || 'name'] || item.name || '';
    if (!searchVal) return;
    setLoading(true);
    fetchAll(currentRel.module, searchVal)
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.data || [];
        setRecords(rows.slice(0, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab, item?.id]);

  if (!related || related.length === 0 || !item) return null;

  const displayCols = relModule?.columns?.slice(0, 4) || [];

  const handleRowClick = (rec) => {
    if (!currentRel) return;
    setPopupLoading(true);
    setPopupItem(rec);
    fetchOne(currentRel.module, rec.id)
      .then((res) => {
        const full = res?.data || res;
        setPopupItem(full);
        setPopupLoading(false);
      })
      .catch(() => setPopupLoading(false));
  };

  const popupModule = popupItem && currentRel ? modules[currentRel.module] : null;
  const popupFields = popupModule?.fields || [];
  const PopupIcon = popupModule?.icon;

  return (
    <div style={styles.wrapper}>
      <h3 style={styles.heading}>Related Records</h3>
      <div style={styles.tabs}>
        {related.map((rel, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              ...styles.tab,
              ...(i === activeTab ? styles.tabActive : {}),
            }}
          >
            {rel.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={styles.empty}>No related {currentRel.label?.toLowerCase() || 'records'} found</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {displayCols.map((col) => (
                  <th key={col.key} style={styles.th}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr
                  key={rec.id}
                  style={styles.tr}
                  onClick={() => handleRowClick(rec)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F7FA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  {displayCols.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {rec[col.key] ?? '--'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Detail Popup */}
      {popupItem && (
        <div style={styles.popupOverlay} onClick={() => setPopupItem(null)}>
          <div style={styles.popupModal} onClick={(e) => e.stopPropagation()}>
            {/* Popup Header */}
            <div style={styles.popupHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                {PopupIcon && (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: (popupModule?.color || '#0070F2') + '14', color: popupModule?.color || '#0070F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PopupIcon size={20} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <h3 style={styles.popupTitle}>{getTitle(popupItem, popupModule)}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    {popupItem.status && (() => {
                      const bs = getBadgeStyle(popupItem.status);
                      return <span style={{ ...styles.badge, ...bs }}>{popupItem.status}</span>;
                    })()}
                    <span style={{ fontSize: 11, color: '#A0AAB4', fontFamily: 'monospace' }}>
                      {popupModule?.name} &middot; ID: {popupItem.id}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setPopupItem(null)} style={styles.popupClose}>&times;</button>
            </div>

            {/* Popup Body */}
            <div style={styles.popupBody}>
              {popupLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6A767D', fontSize: 13 }}>Loading record...</div>
              ) : (
                <div style={styles.popupGrid}>
                  {popupFields.map((field) => {
                    const val = popupItem[field.key];
                    const isBadge = field.key === 'status' || field.key === 'priority';
                    return (
                      <div key={field.key} style={field.type === 'textarea' ? styles.popupFieldFull : styles.popupFieldHalf}>
                        <p style={styles.popupLabel}>{field.label}</p>
                        {isBadge && val ? (
                          <span style={{ ...styles.badge, ...getBadgeStyle(val) }}>{val}</span>
                        ) : (
                          <p style={styles.popupValue}>{formatVal(val, field.key)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div style={styles.popupFooter}>
              <button onClick={() => setPopupItem(null)} style={styles.popupCloseBtn}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    marginTop: 16,
    border: '1px solid #E8EBF0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  heading: {
    margin: 0,
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#354A5F',
    background: '#FAFBFC',
    borderBottom: '1px solid #E8EBF0',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #E8EBF0',
    background: '#fff',
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: '#6A767D',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: '#0070F2',
    borderBottom: '2px solid #0070F2',
    fontWeight: 600,
  },
  content: {
    background: '#fff',
    maxHeight: 280,
    overflowY: 'auto',
  },
  loading: {
    padding: 20,
    textAlign: 'center',
    fontSize: 13,
    color: '#6A767D',
  },
  empty: {
    padding: 20,
    textAlign: 'center',
    fontSize: 13,
    color: '#A0AAB4',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    borderBottom: '1px solid #E8EBF0',
    background: '#FAFBFC',
  },
  tr: {
    borderBottom: '1px solid #F0F2F5',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  td: {
    padding: '9px 14px',
    fontSize: 13,
    color: '#354A5F',
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Popup styles
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 20,
  },
  popupModal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 700,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  popupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #E8EBF0',
  },
  popupTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#1D2D3E',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  popupClose: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    color: '#6A767D',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0,
  },
  popupBody: {
    padding: 24,
    overflowY: 'auto',
    flex: 1,
  },
  popupGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 28px',
  },
  popupFieldHalf: {},
  popupFieldFull: {
    gridColumn: '1 / -1',
  },
  popupLabel: {
    margin: '0 0 4px',
    fontSize: 11,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  popupValue: {
    margin: 0,
    fontSize: 14,
    color: '#1D2D3E',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  popupFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '14px 24px',
    borderTop: '1px solid #E8EBF0',
  },
  popupCloseBtn: {
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6A767D',
    background: '#F0F2F5',
    border: '1px solid #D1D9E0',
    borderRadius: 8,
    cursor: 'pointer',
  },
};

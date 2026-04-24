import { useState, useEffect } from 'react';
import { fetchDocumentFlow } from '../api';

const FLOW_DEFS = {
  sales: {
    label: 'Sales Document Flow',
    steps: ['Quote', 'Sales Order', 'Delivery', 'Billing', 'Payment'],
    tables: ['quotes', 'orders', 'deliveries', 'billing_documents', 'payments'],
  },
  procurement: {
    label: 'Procurement Flow',
    steps: ['Purchase Req.', 'Purchase Order', 'Goods Receipt', 'AP Invoice'],
    tables: ['purchase_requisitions', 'purchase_orders', 'goods_receipts', 'accounts_payable'],
  },
  production: {
    label: 'Production Flow',
    steps: ['Bill of Materials', 'Production Order', 'Goods Receipt'],
    tables: ['bill_of_materials', 'production_orders', 'goods_receipts'],
  },
};

const STEP_COLORS = {
  completed: { bg: '#E6F4EA', border: '#1E7E34', text: '#1E7E34' },
  current: { bg: '#E8F4FD', border: '#0070F2', text: '#0070F2' },
  pending: { bg: '#F0F2F5', border: '#D1D9E0', text: '#A0AAB4' },
};

export default function DocumentFlow({ config, item, moduleKey }) {
  const [flowData, setFlowData] = useState(null);
  const [loading, setLoading] = useState(false);

  const flowType = config?.documentFlow;
  const flowDef = flowType ? FLOW_DEFS[flowType] : null;

  useEffect(() => {
    if (!flowType || !flowDef || !item?.id) return;
    setLoading(true);
    fetchDocumentFlow(moduleKey, item.id)
      .then((res) => {
        setFlowData(res);
        setLoading(false);
      })
      .catch(() => {
        setFlowData(null);
        setLoading(false);
      });
  }, [item?.id, moduleKey, flowType]);

  if (!flowType || !item || !flowDef) return null;

  // Determine current step index from the module key
  const currentIdx = flowDef.tables.indexOf(moduleKey);

  const getStepState = (idx) => {
    if (flowData?.steps) {
      const step = flowData.steps[idx];
      if (step?.found) return idx <= currentIdx ? 'completed' : 'current';
    }
    if (idx < currentIdx) return 'completed';
    if (idx === currentIdx) return 'current';
    return 'pending';
  };

  return (
    <div style={styles.wrapper}>
      <h3 style={styles.heading}>{flowDef.label}</h3>
      {loading ? (
        <div style={styles.loading}>Loading flow...</div>
      ) : (
        <div style={styles.flow}>
          {flowDef.steps.map((step, idx) => {
            const state = getStepState(idx);
            const colors = STEP_COLORS[state];
            const docInfo = flowData?.steps?.[idx];
            return (
              <div key={idx} style={styles.stepGroup}>
                {idx > 0 && (
                  <div style={{
                    ...styles.connector,
                    background: state === 'pending' ? '#D1D9E0' : '#0070F2',
                  }} />
                )}
                <div style={{
                  ...styles.step,
                  background: colors.bg,
                  borderColor: colors.border,
                }}>
                  <div style={{ ...styles.stepNum, background: colors.border, color: '#fff' }}>
                    {state === 'completed' ? '\u2713' : idx + 1}
                  </div>
                  <div style={{ ...styles.stepLabel, color: colors.text }}>{step}</div>
                  {docInfo?.found && docInfo.number && (
                    <div style={styles.stepDoc}>{docInfo.number}</div>
                  )}
                  {docInfo?.found && docInfo.status && (
                    <div style={styles.stepStatus}>{docInfo.status}</div>
                  )}
                </div>
              </div>
            );
          })}
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
  loading: {
    padding: 20,
    textAlign: 'center',
    fontSize: 13,
    color: '#6A767D',
  },
  flow: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px 16px',
    overflowX: 'auto',
    background: '#fff',
  },
  stepGroup: {
    display: 'flex',
    alignItems: 'center',
    flex: '1 1 0',
    minWidth: 0,
  },
  connector: {
    width: 32,
    height: 3,
    borderRadius: 2,
    flexShrink: 0,
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 10px',
    borderRadius: 8,
    border: '2px solid',
    minWidth: 100,
    flex: 1,
    textAlign: 'center',
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  stepDoc: {
    fontSize: 10,
    color: '#6A767D',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  stepStatus: {
    fontSize: 10,
    color: '#498205',
    marginTop: 2,
    fontWeight: 500,
  },
};

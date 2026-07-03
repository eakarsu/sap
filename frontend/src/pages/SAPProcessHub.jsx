import React, { useEffect, useState } from 'react';
import {
  fetchSapProcessOverview,
  runAtpCheck,
  runAssetDepreciation,
  runBankReconciliation,
  runDunning,
  runEwmWavePlan,
  runIntercompanyElimination,
  runMdgDuplicateCheck,
  runMrp,
  runOrderToCash,
  runPayrollCalculate,
  runProcureToPay,
  runProductionConfirmation,
  runRoleAccessCheck,
  runRevenueRecognition,
  runTaxValidate,
  runTmRoutePlan,
} from '../api';
import {
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiGitBranch,
  FiPackage,
  FiRefreshCw,
  FiShield,
  FiShoppingCart,
  FiTool,
  FiTruck,
} from 'react-icons/fi';

const TEXT = '#1D2D3E';
const MUTED = '#6A767D';
const BLUE = '#0070F2';
const BORDER = '#E8EBF0';
const BG = '#F5F7FA';

const processDefs = [
  {
    key: 'order-to-cash',
    title: 'Order to Cash',
    icon: FiShoppingCart,
    description: 'Create delivery, billing, and FI posting from a sales order.',
    defaults: { orderId: '1' },
    fields: [{ key: 'orderId', label: 'Sales Order ID', type: 'number' }],
    run: runOrderToCash,
  },
  {
    key: 'procure-to-pay',
    title: 'Procure to Pay',
    icon: FiPackage,
    description: 'Create goods receipt, AP invoice, and posting from a purchase order.',
    defaults: { purchaseOrderId: '1' },
    fields: [{ key: 'purchaseOrderId', label: 'Purchase Order ID', type: 'number' }],
    run: runProcureToPay,
  },
  {
    key: 'atp-check',
    title: 'Advanced ATP',
    icon: FiCheckCircle,
    description: 'Check inventory availability and confirmation quantity.',
    defaults: { materialNumber: '', requestedQuantity: '100', plant: '' },
    fields: [
      { key: 'materialNumber', label: 'Material Search' },
      { key: 'requestedQuantity', label: 'Requested Quantity', type: 'number' },
      { key: 'plant', label: 'Plant' },
    ],
    run: runAtpCheck,
  },
  {
    key: 'payroll-calc',
    title: 'Payroll Calculation',
    icon: FiCreditCard,
    description: 'Calculate gross-to-net payroll and deductions.',
    defaults: { employeeId: '1', bonus: '0' },
    fields: [
      { key: 'employeeId', label: 'Employee ID', type: 'number' },
      { key: 'bonus', label: 'Bonus', type: 'number' },
    ],
    run: runPayrollCalculate,
  },
  {
    key: 'tax-validate',
    title: 'Tax Compliance',
    icon: FiDollarSign,
    description: 'Validate VAT/tax treatment and required compliance artifacts.',
    defaults: { country: 'DE', documentType: 'Invoice', amount: '10000', currency: 'EUR' },
    fields: [
      { key: 'country', label: 'Country', type: 'select', options: ['DE', 'FR', 'GB', 'US', 'CH', 'IN'] },
      { key: 'documentType', label: 'Document Type' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF', 'INR'] },
    ],
    run: runTaxValidate,
  },
  {
    key: 'ewm-wave-plan',
    title: 'EWM Wave Planning',
    icon: FiGitBranch,
    description: 'Build a warehouse pick wave from available bin demand.',
    defaults: { warehouse: 'WH01', maxTasks: '10' },
    fields: [
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'maxTasks', label: 'Max Tasks', type: 'number' },
    ],
    run: runEwmWavePlan,
  },
  {
    key: 'tm-route-plan',
    title: 'TM Route Planning',
    icon: FiTruck,
    description: 'Estimate route, carrier, cost, transit days, and route risk.',
    defaults: { origin: 'Walldorf, DE', destination: 'Munich, DE', weightKg: '1000', mode: 'Road' },
    fields: [
      { key: 'origin', label: 'Origin' },
      { key: 'destination', label: 'Destination' },
      { key: 'weightKg', label: 'Weight KG', type: 'number' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Road', 'Air', 'Ocean', 'Rail'] },
    ],
    run: runTmRoutePlan,
  },
  {
    key: 'role-access-check',
    title: 'Role Access Check',
    icon: FiShield,
    description: 'Simulate SAP authorization and SoD checks for a role/process.',
    defaults: { role: 'manager', process: 'Procure to Pay', amount: '100000' },
    fields: [
      { key: 'role', label: 'Role', type: 'select', options: ['admin', 'manager', 'controller', 'user'] },
      { key: 'process', label: 'Process', type: 'select', options: ['Procure to Pay', 'Order to Cash', 'Record to Report', 'Hire to Retire'] },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
    run: runRoleAccessCheck,
  },
  {
    key: 'mrp-run',
    title: 'MRP Run',
    icon: FiRefreshCw,
    description: 'Create procurement proposals for materials below reorder point.',
    defaults: { plant: '1000', planningScope: 'Net Change', maxProposals: '10' },
    fields: [
      { key: 'plant', label: 'Plant' },
      { key: 'planningScope', label: 'Planning Scope', type: 'select', options: ['Net Change', 'Regenerative', 'Single Item'] },
      { key: 'maxProposals', label: 'Max Proposals', type: 'number' },
    ],
    run: runMrp,
  },
  {
    key: 'production-confirmation',
    title: 'Production Confirmation',
    icon: FiTool,
    description: 'Confirm a production order and post finished-goods receipt.',
    defaults: { productionOrderId: '1', yieldQuantity: '', scrapQuantity: '0' },
    fields: [
      { key: 'productionOrderId', label: 'Production Order ID', type: 'number' },
      { key: 'yieldQuantity', label: 'Yield Quantity', type: 'number' },
      { key: 'scrapQuantity', label: 'Scrap Quantity', type: 'number' },
    ],
    run: runProductionConfirmation,
  },
  {
    key: 'bank-reconciliation',
    title: 'Bank Reconciliation',
    icon: FiDollarSign,
    description: 'Match payments against bank balances and open items.',
    defaults: { bankName: '' },
    fields: [{ key: 'bankName', label: 'Bank Name Search' }],
    run: runBankReconciliation,
  },
  {
    key: 'dunning-run',
    title: 'Dunning Run',
    icon: FiCreditCard,
    description: 'Identify overdue AR and generate collection actions.',
    defaults: { minimumDays: '30' },
    fields: [{ key: 'minimumDays', label: 'Minimum Days Outstanding', type: 'number' }],
    run: runDunning,
  },
  {
    key: 'asset-depreciation',
    title: 'Asset Depreciation',
    icon: FiPackage,
    description: 'Calculate depreciation and create FI posting evidence.',
    defaults: { assetId: '1', months: '1' },
    fields: [
      { key: 'assetId', label: 'Asset ID', type: 'number' },
      { key: 'months', label: 'Months', type: 'number' },
    ],
    run: runAssetDepreciation,
  },
  {
    key: 'revenue-recognition',
    title: 'Revenue Recognition',
    icon: FiDollarSign,
    description: 'Calculate recognizable revenue and performance obligations.',
    defaults: { contractId: '1', recognitionPercent: '25' },
    fields: [
      { key: 'contractId', label: 'Contract ID', type: 'number' },
      { key: 'recognitionPercent', label: 'Recognition Percent', type: 'number' },
    ],
    run: runRevenueRecognition,
  },
  {
    key: 'intercompany-elimination',
    title: 'Intercompany Elimination',
    icon: FiGitBranch,
    description: 'Analyze group reporting eliminations and consolidation exposure.',
    defaults: {},
    fields: [],
    run: runIntercompanyElimination,
  },
  {
    key: 'mdg-duplicate-check',
    title: 'MDG Duplicate Check',
    icon: FiShield,
    description: 'Detect likely duplicate business partners and master-data candidates.',
    defaults: { search: '' },
    fields: [{ key: 'search', label: 'Search Term' }],
    run: runMdgDuplicateCheck,
  },
];

function toPayload(form, fields) {
  const payload = {};
  fields.forEach((field) => {
    const value = form[field.key];
    payload[field.key] = field.type === 'number' ? Number(value || 0) : value;
  });
  return payload;
}

function Money({ value, currency = 'EUR' }) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function SAPProcessHub() {
  const [active, setActive] = useState(processDefs[0].key);
  const [forms, setForms] = useState(() => Object.fromEntries(processDefs.map((p) => [p.key, p.defaults])));
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState('');
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    fetchSapProcessOverview().then(setOverview);
  }, []);

  const def = processDefs.find((p) => p.key === active);
  const form = forms[active] || def.defaults;
  const result = results[active];

  const updateField = (key, value) => {
    setForms((prev) => ({ ...prev, [active]: { ...(prev[active] || def.defaults), [key]: value } }));
  };

  const run = async () => {
    setLoading(active);
    const output = await def.run(toPayload(form, def.fields));
    setResults((prev) => ({ ...prev, [active]: output }));
    setLoading('');
    fetchSapProcessOverview().then(setOverview);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Process Hub</h1>
          <p style={styles.subtitle}>
            Cross-module SAP process execution: O2C, P2P, ATP, payroll, tax, EWM, TM, and authorization checks.
          </p>
        </div>
        <div style={styles.badge}>Functional simulation layer</div>
      </div>

      <div style={styles.layout}>
        <aside style={styles.rail}>
          {processDefs.map((p) => {
            const Icon = p.icon;
            const selected = p.key === active;
            const runInfo = overview?.runs?.find((r) => r.process_key === p.key);
            return (
              <button key={p.key} onClick={() => setActive(p.key)} style={{ ...styles.railItem, ...(selected ? styles.railItemActive : {}) }}>
                <Icon size={17} />
                <span style={styles.railText}>{p.title}</span>
                {runInfo?.count ? <span style={styles.count}>{runInfo.count}</span> : null}
              </button>
            );
          })}
        </aside>

        <main style={styles.main}>
          <section style={styles.card}>
            <div style={styles.cardHead}>
              <div>
                <h2 style={styles.cardTitle}>{def.title}</h2>
                <p style={styles.cardSub}>{def.description}</p>
              </div>
              <button onClick={run} disabled={loading === active} style={styles.primary}>
                {loading === active ? 'Running...' : 'Run Process'}
              </button>
            </div>
            <div style={styles.formGrid}>
              {def.fields.map((field) => (
                <label key={field.key} style={styles.label}>
                  {field.label}
                  {field.type === 'select' ? (
                    <select value={form[field.key] ?? ''} onChange={(e) => updateField(field.key, e.target.value)} style={styles.input}>
                      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type || 'text'} value={form[field.key] ?? ''} onChange={(e) => updateField(field.key, e.target.value)} style={styles.input} />
                  )}
                </label>
              ))}
            </div>
          </section>

          {result && <ProfessionalResult type={active} result={result} />}
        </main>
      </div>
    </div>
  );
}

function ProfessionalResult({ type, result }) {
  if (result.error) return <section style={styles.error}>{result.error}</section>;

  return (
    <section style={styles.card}>
      <div style={styles.resultHeader}>
        <h2 style={styles.cardTitle}>Process Result</h2>
        <span style={styles.success}>Completed</span>
      </div>

      {result.chain && (
        <div style={styles.timeline}>
          {result.chain.map((step, index) => (
            <div key={`${step.step}-${index}`} style={styles.timelineRow}>
              <div style={styles.dot}>{index + 1}</div>
              <div>
                <div style={styles.itemTitle}>{step.step}</div>
                <div style={styles.itemSub}>{step.document} · {step.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.summary && <div style={styles.summary}>{result.summary}</div>}

      {result.metrics && (
        <MetricStrip items={result.metrics.map((m) => [m.label, m.value])} />
      )}

      {result.rows && <SimpleTable rows={result.rows} />}

      {result.warnings && <BulletList title="Warnings" items={result.warnings || []} warning />}

      {type === 'atp-check' && (
        <>
          <MetricStrip items={[
            ['Decision', result.decision],
            ['Confirmed', result.confirmedQuantity],
            ['Shortage', result.shortage],
            ['Available', result.totalAvailable],
          ]} />
          <SimpleTable rows={result.confirmations || []} />
        </>
      )}

      {type === 'payroll-calc' && (
        <>
          <MetricStrip items={[
            ['Employee', result.employee],
            ['Gross Pay', <Money value={result.grossPay} />],
            ['Net Pay', <Money value={result.netPay} />],
            ['Period', result.period],
          ]} />
          <SimpleTable rows={result.deductions || []} />
        </>
      )}

      {type === 'tax-validate' && (
        <>
          <MetricStrip items={[
            ['Decision', result.decision],
            ['Tax Rate', `${Math.round((result.taxRate || 0) * 10000) / 100}%`],
            ['Tax Amount', <Money value={result.taxAmount} currency={result.currency} />],
            ['Country', result.country],
          ]} />
          <BulletList title="Required Artifacts" items={result.requiredArtifacts || []} />
          <BulletList title="Warnings" items={result.warnings || []} warning />
        </>
      )}

      {type === 'ewm-wave-plan' && (
        <>
          <MetricStrip items={[
            ['Wave', result.waveNumber],
            ['Warehouse', result.warehouse],
            ['Tasks', result.taskCount],
            ['Minutes', result.estimatedMinutes],
          ]} />
          <SimpleTable rows={result.tasks || []} />
        </>
      )}

      {type === 'tm-route-plan' && (
        <MetricStrip items={[
          ['Freight Order', result.freightOrder],
          ['Carrier', result.carrierRecommendation],
          ['Distance', `${result.distanceKm} km`],
          ['Cost', <Money value={result.estimatedCost} currency={result.currency} />],
          ['Transit', `${result.transitDays} days`],
          ['Risk', result.risk],
        ]} />
      )}

      {type === 'role-access-check' && (
        <>
          <MetricStrip items={[
            ['Decision', result.decision],
            ['Role', result.role],
            ['Process', result.process],
            ['Amount', <Money value={result.amount} />],
          ]} />
          <SimpleTable rows={Object.entries(result.permissions || {}).map(([permission, allowed]) => ({ permission, allowed: allowed ? 'Yes' : 'No' }))} />
          <BulletList title="Warnings" items={result.warnings || []} warning />
        </>
      )}

      {(type === 'order-to-cash' || type === 'procure-to-pay') && (
        <MetricStrip items={[
          ['Reference', result.order?.order_number || result.purchaseOrder?.po_number],
          ['Posting', result.posting?.document_number],
          ['Amount', <Money value={result.posting?.amount} currency={result.posting?.currency || 'EUR'} />],
          ['Status', result.posting?.status],
        ]} />
      )}
    </section>
  );
}

function MetricStrip({ items }) {
  return (
    <div style={styles.metrics}>
      {items.map(([label, value]) => (
        <div key={label} style={styles.metric}>
          <div style={styles.metricLabel}>{label}</div>
          <div style={styles.metricValue}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ rows }) {
  if (!rows?.length) return null;
  const columns = Object.keys(rows[0]);
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>{columns.map((c) => <th key={c} style={styles.th}>{c.replaceAll('_', ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((c) => <td key={c} style={styles.td}>{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletList({ title, items, warning }) {
  if (!items?.length) return null;
  return (
    <div style={styles.bullets}>
      <div style={styles.itemTitle}>{title}</div>
      {items.map((item) => <div key={item} style={{ ...styles.bullet, ...(warning ? styles.warnBullet : {}) }}>{item}</div>)}
    </div>
  );
}

const styles = {
  page: { padding: 20, maxWidth: 1440, margin: '0 auto', color: TEXT },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 },
  title: { margin: 0, fontSize: 24, fontWeight: 800 },
  subtitle: { margin: '6px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.5 },
  badge: { padding: '6px 10px', borderRadius: 999, background: `${BLUE}14`, color: BLUE, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' },
  layout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 },
  rail: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, height: 'fit-content' },
  railItem: { width: '100%', display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', color: TEXT, padding: '10px 9px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' },
  railItemActive: { background: `${BLUE}12`, color: BLUE, fontWeight: 800 },
  railText: { fontSize: 13, minWidth: 0 },
  count: { background: BG, color: MUTED, borderRadius: 999, padding: '2px 6px', fontSize: 11, fontWeight: 800 },
  main: { display: 'grid', gap: 16, minWidth: 0 },
  card: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16 },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 800 },
  cardSub: { margin: '4px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.45 },
  primary: { border: 'none', borderRadius: 6, background: BLUE, color: '#fff', fontWeight: 800, padding: '9px 14px', cursor: 'pointer' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  label: { display: 'grid', gap: 5, color: MUTED, fontSize: 12, fontWeight: 800 },
  input: { border: '1px solid #D5DADF', borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 13, background: '#fff' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 },
  success: { borderRadius: 999, background: '#E8F5E9', color: '#188918', padding: '5px 9px', fontSize: 12, fontWeight: 800 },
  error: { background: '#FFF1F1', border: '1px solid #FFD6D6', borderRadius: 8, color: '#B00020', padding: 14 },
  summary: { background: BG, borderRadius: 8, padding: 12, color: TEXT, fontSize: 13, lineHeight: 1.45, marginBottom: 14 },
  timeline: { display: 'grid', gap: 10, marginBottom: 14 },
  timelineRow: { display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, alignItems: 'start' },
  dot: { width: 26, height: 26, borderRadius: 999, background: `${BLUE}14`, color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 },
  itemTitle: { fontSize: 13, fontWeight: 800, color: TEXT },
  itemSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 },
  metric: { background: BG, borderRadius: 8, padding: 12 },
  metricLabel: { color: MUTED, fontSize: 11, textTransform: 'uppercase', fontWeight: 800, marginBottom: 4 },
  metricValue: { color: TEXT, fontSize: 15, fontWeight: 800 },
  tableWrap: { overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8, marginTop: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', background: BG, color: MUTED, padding: 10, textTransform: 'capitalize', borderBottom: `1px solid ${BORDER}` },
  td: { padding: 10, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' },
  bullets: { display: 'grid', gap: 7, marginTop: 12 },
  bullet: { background: BG, borderRadius: 6, padding: 9, fontSize: 13, color: TEXT },
  warnBullet: { background: '#FFF7E6', color: '#8A4B00' },
};

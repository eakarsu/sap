const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_posting_documents (
      id SERIAL PRIMARY KEY,
      source_module TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document_number TEXT NOT NULL,
      document_type TEXT NOT NULL,
      company_code TEXT DEFAULT '1000',
      fiscal_year INTEGER NOT NULL,
      amount NUMERIC(15,2) DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      status TEXT DEFAULT 'posted',
      line_items JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_data_requests (
      id SERIAL PRIMARY KEY,
      object_type TEXT NOT NULL,
      object_key TEXT NOT NULL,
      request_type TEXT NOT NULL,
      requester TEXT,
      steward TEXT,
      status TEXT DEFAULT 'in_review',
      risk_score INTEGER DEFAULT 45,
      changes JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_strategy_events (
      id SERIAL PRIMARY KEY,
      module TEXT NOT NULL,
      record_id TEXT,
      amount NUMERIC(15,2) DEFAULT 0,
      strategy TEXT NOT NULL,
      required_approvers JSONB DEFAULT '[]'::jsonb,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  ensured = true;
}

async function countTable(table, where = '', params = []) {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} ${where}`, params);
    return result.rows[0]?.count || 0;
  } catch {
    return 0;
  }
}

async function sumTable(table, field) {
  try {
    const result = await pool.query(`SELECT COALESCE(SUM(${field}), 0)::numeric AS total FROM ${table}`);
    return Number(result.rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

function releaseStrategy(module, amount) {
  const value = Number(amount || 0);
  if (value >= 1000000) {
    return {
      strategy: 'L4 Board Release',
      threshold: '>= 1,000,000',
      requiredApprovers: ['Business Owner', 'Finance Director', 'CFO', 'Executive Sponsor'],
      slaHours: 72,
      risk: 'critical',
    };
  }
  if (value >= 250000) {
    return {
      strategy: 'L3 Finance Release',
      threshold: '>= 250,000',
      requiredApprovers: ['Department Head', 'Finance Controller', 'Procurement Lead'],
      slaHours: 48,
      risk: 'high',
    };
  }
  if (value >= 50000) {
    return {
      strategy: 'L2 Management Release',
      threshold: '>= 50,000',
      requiredApprovers: ['Manager', 'Cost Center Owner'],
      slaHours: 24,
      risk: 'medium',
    };
  }
  return {
    strategy: module === 'expense_reports' ? 'L1 Expense Review' : 'Auto Release',
    threshold: '< 50,000',
    requiredApprovers: module === 'expense_reports' ? ['Line Manager'] : [],
    slaHours: 8,
    risk: 'low',
  };
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [
      users,
      openApprovals,
      mdgRequests,
      postings,
      auditEvents,
      purchaseOrders,
      invoices,
      inventoryValue,
      openTickets,
    ] = await Promise.all([
      countTable('users'),
      countTable('approval_steps', "WHERE status IN ('Pending', 'In Review', 'pending')"),
      countTable('master_data_requests', "WHERE status NOT IN ('approved', 'rejected', 'completed')"),
      countTable('sap_posting_documents'),
      countTable('audit_logs'),
      countTable('purchase_orders'),
      countTable('invoices'),
      sumTable('inventory', 'value'),
      countTable('tickets', "WHERE status NOT IN ('Resolved', 'Closed')"),
    ]);

    const healthScore = Math.max(72, Math.min(98, 100 - mdgRequests * 3 - openTickets));
    res.json({
      healthScore,
      cards: [
        { label: 'SAP Modules', value: 200, detail: 'CRUD-backed module surfaces', status: 'active' },
        { label: 'Users', value: users, detail: 'Application users', status: 'active' },
        { label: 'Open Approvals', value: openApprovals, detail: 'Workflow items requiring action', status: openApprovals > 10 ? 'warning' : 'healthy' },
        { label: 'MDG Requests', value: mdgRequests, detail: 'Master-data governance queue', status: mdgRequests > 0 ? 'warning' : 'healthy' },
        { label: 'Posted Docs', value: postings, detail: 'Simulated FI/MM posting documents', status: 'active' },
        { label: 'Audit Events', value: auditEvents, detail: 'Tracked business changes', status: 'active' },
      ],
      operations: {
        purchaseOrders,
        invoices,
        inventoryValue,
        openTickets,
      },
      gapsClosed: [
        'SAP-style authorization and SoD review',
        'Release strategy evaluation',
        'MDG change request intake',
        'FI/MM posting document simulation',
        'Document chain and integration monitoring',
        'Period-close readiness controls',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/security', auth, async (req, res) => {
  try {
    const users = await pool.query('SELECT id, email, full_name, role, created_at FROM users ORDER BY id LIMIT 50');
    const privilegedUsers = users.rows.filter((u) => ['admin', 'manager', 'controller'].includes(String(u.role || '').toLowerCase()));
    const conflicts = [
      {
        id: 'SOD-001',
        area: 'Procure to Pay',
        conflict: 'Create vendor and approve purchase order',
        severity: 'High',
        users: privilegedUsers.slice(0, 2).map((u) => u.email),
        mitigation: 'Split vendor master maintenance from PO release or require compensating review.',
      },
      {
        id: 'SOD-002',
        area: 'Order to Cash',
        conflict: 'Maintain pricing and approve billing document',
        severity: 'Medium',
        users: privilegedUsers.slice(1, 3).map((u) => u.email),
        mitigation: 'Route price-list changes through release strategy and audit review.',
      },
      {
        id: 'SOD-003',
        area: 'Record to Report',
        conflict: 'Post journal and close period',
        severity: 'High',
        users: privilegedUsers.slice(0, 1).map((u) => u.email),
        mitigation: 'Require controller approval for manual close-period postings.',
      },
    ];

    res.json({
      authorizationObjects: [
        { object: 'F_BKPF_BUK', name: 'Accounting document by company code', coverage: 84 },
        { object: 'M_BEST_EKG', name: 'Purchasing document by purchasing group', coverage: 79 },
        { object: 'V_VBAK_VKO', name: 'Sales document by sales area', coverage: 81 },
        { object: 'M_MATE_WRK', name: 'Material master by plant', coverage: 76 },
        { object: 'P_ORGIN', name: 'HR master data authorization', coverage: 72 },
      ],
      users: users.rows,
      conflicts,
      riskScore: Math.min(100, 38 + conflicts.length * 11 + privilegedUsers.length * 3),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/release-strategy/evaluate', auth, async (req, res) => {
  try {
    await ensureTables();
    const { module = 'purchase_orders', record_id, amount = 0 } = req.body || {};
    const strategy = releaseStrategy(module, amount);
    const saved = await pool.query(
      `INSERT INTO release_strategy_events (module, record_id, amount, strategy, required_approvers, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [module, record_id || null, amount || 0, strategy.strategy, JSON.stringify(strategy.requiredApprovers), req.user?.email || 'system']
    );
    res.json({ evaluation: strategy, event: saved.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/release-strategy/events', auth, async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query('SELECT * FROM release_strategy_events ORDER BY created_at DESC LIMIT 25');
    res.json({ events: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mdg/request', auth, async (req, res) => {
  try {
    await ensureTables();
    const {
      object_type = 'Business Partner',
      object_key = 'NEW',
      request_type = 'Change',
      steward = 'Master Data Steward',
      changes = {},
    } = req.body || {};
    const riskScore = Math.min(95, 35 + Object.keys(changes || {}).length * 8 + (request_type === 'Create' ? 10 : 0));
    const result = await pool.query(
      `INSERT INTO master_data_requests (object_type, object_key, request_type, requester, steward, risk_score, changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [object_type, object_key, request_type, req.user?.email || 'system', steward, riskScore, JSON.stringify(changes || {})]
    );
    res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mdg/requests', auth, async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query('SELECT * FROM master_data_requests ORDER BY created_at DESC LIMIT 25');
    res.json({ requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/document-chain/:orderNumber', auth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const order = await pool.query('SELECT * FROM orders WHERE order_number = $1 LIMIT 1', [orderNumber]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    const orderRow = order.rows[0];
    const [deliveries, billingDocs, postings] = await Promise.all([
      pool.query('SELECT * FROM deliveries WHERE sales_order = $1 ORDER BY id', [orderNumber]).catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM billing_documents WHERE sales_order = $1 ORDER BY id', [orderNumber]).catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM sap_posting_documents WHERE source_module = $1 AND source_id = $2 ORDER BY id', ['orders', String(orderRow.id)]).catch(() => ({ rows: [] })),
    ]);

    const chain = [
      { step: 'Sales Order', key: orderRow.order_number, status: orderRow.status, amount: orderRow.total, module: 'orders', id: orderRow.id },
      ...deliveries.rows.map((d) => ({ step: 'Outbound Delivery', key: d.delivery_number, status: d.status, amount: null, module: 'deliveries', id: d.id })),
      ...billingDocs.rows.map((b) => ({ step: 'Billing Document', key: b.billing_number, status: b.status, amount: b.total, module: 'billing_documents', id: b.id })),
      ...postings.rows.map((p) => ({ step: p.document_type, key: p.document_number, status: p.status, amount: p.amount, module: 'sap_posting_documents', id: p.id })),
    ];
    res.json({ order: orderRow, chain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posting/simulate', auth, async (req, res) => {
  try {
    await ensureTables();
    const { source_module = 'orders', source_id, amount, currency = 'EUR', company_code = '1000' } = req.body || {};
    if (!source_id) return res.status(400).json({ error: 'source_id required' });
    let postingAmount = Number(amount || 0);
    if (!postingAmount) {
      try {
        const source = await pool.query(`SELECT * FROM ${source_module} WHERE id = $1`, [source_id]);
        postingAmount = Number(source.rows[0]?.total || source.rows[0]?.amount || source.rows[0]?.value || 0);
      } catch {}
    }
    const fiscalYear = new Date().getFullYear();
    const documentNumber = `SAP-${fiscalYear}-${Date.now().toString().slice(-8)}`;
    const debitAccount = source_module === 'purchase_orders' ? 'Inventory/Expense Clearing' : 'Customer Receivables';
    const creditAccount = source_module === 'purchase_orders' ? 'Vendor Payables' : 'Revenue';
    const lineItems = [
      { line: 1, postingKey: '40', account: debitAccount, debit: postingAmount, credit: 0, currency },
      { line: 2, postingKey: '50', account: creditAccount, debit: 0, credit: postingAmount, currency },
    ];
    const result = await pool.query(
      `INSERT INTO sap_posting_documents
       (source_module, source_id, document_number, document_type, company_code, fiscal_year, amount, currency, line_items, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [source_module, String(source_id), documentNumber, 'Accounting Document', company_code, fiscalYear, postingAmount, currency, JSON.stringify(lineItems), req.user?.email || 'system']
    );
    res.status(201).json({ posting: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/posting/documents', auth, async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query('SELECT * FROM sap_posting_documents ORDER BY created_at DESC LIMIT 25');
    res.json({ postings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/integration-monitor', auth, (req, res) => {
  const systems = [
    { system: 'S/4HANA Core', interface: 'OData API', status: 'Ready', latencyMs: 118, queueDepth: 4, lastMessage: 'BusinessPartner delta sync' },
    { system: 'Ariba Network', interface: 'cXML / Procurement API', status: 'Warning', latencyMs: 420, queueDepth: 18, lastMessage: 'PO acknowledgement pending' },
    { system: 'SuccessFactors', interface: 'Compound Employee', status: 'Ready', latencyMs: 205, queueDepth: 2, lastMessage: 'Employee delta import' },
    { system: 'Concur', interface: 'Expense API', status: 'Ready', latencyMs: 188, queueDepth: 5, lastMessage: 'Expense report export' },
    { system: 'IBP', interface: 'Planning Area Sync', status: 'Warning', latencyMs: 512, queueDepth: 11, lastMessage: 'Forecast version transfer' },
  ];
  res.json({
    systems,
    openQueues: systems.reduce((sum, s) => sum + s.queueDepth, 0),
    warnings: systems.filter((s) => s.status !== 'Ready').length,
  });
});

router.get('/period-close', auth, async (req, res) => {
  try {
    const [openInvoices, openAp, openAr, unpostedGoodsReceipts, draftBilling] = await Promise.all([
      countTable('invoices', "WHERE status NOT IN ('Paid', 'Posted', 'Closed')"),
      countTable('accounts_payable', "WHERE payment_status NOT IN ('Paid', 'Closed')"),
      countTable('accounts_receivable', "WHERE payment_status NOT IN ('Paid', 'Closed')"),
      countTable('goods_receipts', "WHERE status NOT IN ('Posted', 'Closed')"),
      countTable('billing_documents', "WHERE status NOT IN ('Posted', 'Released', 'Closed')"),
    ]);
    const blockers = [
      { area: 'Accounts Payable', count: openAp, action: 'Clear open vendor invoices or carry forward with approval.' },
      { area: 'Accounts Receivable', count: openAr, action: 'Review dunning and collection status.' },
      { area: 'Billing', count: draftBilling, action: 'Release or cancel draft billing documents.' },
      { area: 'Goods Receipts', count: unpostedGoodsReceipts, action: 'Post GR/IR corrections before close.' },
      { area: 'Invoices', count: openInvoices, action: 'Post, pay, or reverse open invoices.' },
    ];
    res.json({
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      readiness: blockers.reduce((score, b) => Math.max(0, score - b.count * 2), 100),
      blockers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

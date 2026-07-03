const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_process_runs (
      id SERIAL PRIMARY KEY,
      process_key TEXT NOT NULL,
      reference TEXT,
      status TEXT DEFAULT 'completed',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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
  ensured = true;
}

async function logRun(req, processKey, reference, input, output, status = 'completed') {
  await ensureTables();
  await pool.query(
    `INSERT INTO sap_process_runs (process_key, reference, status, input, output, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [processKey, reference || null, status, JSON.stringify(input || {}), JSON.stringify(output || {}), req.user?.email || 'system']
  );
}

async function getRecord(table, id) {
  const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

function moneyNum(value) {
  return Number(value || 0);
}

async function createPosting({ sourceModule, sourceId, amount, currency = 'EUR', createdBy = 'system', documentType = 'Accounting Document' }) {
  await ensureTables();
  const fiscalYear = new Date().getFullYear();
  const documentNumber = `SAP-${fiscalYear}-${Date.now().toString().slice(-8)}`;
  const value = moneyNum(amount);
  const lineItems = [
    { line: 1, postingKey: '40', account: sourceModule === 'purchase_orders' ? 'GR/IR Clearing' : 'Customer Receivables', debit: value, credit: 0, currency },
    { line: 2, postingKey: '50', account: sourceModule === 'purchase_orders' ? 'Vendor Payables' : 'Revenue', debit: 0, credit: value, currency },
  ];
  const result = await pool.query(
    `INSERT INTO sap_posting_documents
     (source_module, source_id, document_number, document_type, fiscal_year, amount, currency, line_items, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [sourceModule, String(sourceId), documentNumber, documentType, fiscalYear, value, currency, JSON.stringify(lineItems), createdBy]
  );
  return result.rows[0];
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const runs = await pool.query(`
      SELECT process_key, COUNT(*)::int AS count, MAX(created_at) AS last_run
      FROM sap_process_runs
      GROUP BY process_key
      ORDER BY last_run DESC
    `);
    res.json({
      processes: [
        { key: 'order-to-cash', title: 'Order to Cash', detail: 'Create delivery, billing, and accounting posting from a sales order.' },
        { key: 'procure-to-pay', title: 'Procure to Pay', detail: 'Create goods receipt, AP invoice, and FI posting from a purchase order.' },
        { key: 'atp-check', title: 'Advanced ATP', detail: 'Check available stock, confirmations, and shortage handling.' },
        { key: 'payroll-calc', title: 'Payroll Calculation', detail: 'Calculate gross-to-net payroll with taxes and deductions.' },
        { key: 'tax-validate', title: 'Tax Compliance', detail: 'Validate VAT/withholding/e-document treatment.' },
        { key: 'ewm-wave-plan', title: 'EWM Wave Planning', detail: 'Build pick waves from open warehouse demand.' },
        { key: 'tm-route-plan', title: 'TM Route Planning', detail: 'Estimate route, carrier, cost, and transit risk.' },
        { key: 'role-access-check', title: 'Role Access Check', detail: 'Evaluate SAP-style authorization coverage and SoD warnings.' },
        { key: 'mrp-run', title: 'MRP Run', detail: 'Create procurement proposals for materials below reorder point.' },
        { key: 'production-confirmation', title: 'Production Confirmation', detail: 'Confirm a production order and post finished-goods receipt.' },
        { key: 'bank-reconciliation', title: 'Bank Reconciliation', detail: 'Match payments against bank balances and open items.' },
        { key: 'dunning-run', title: 'Dunning Run', detail: 'Identify overdue AR and generate collection actions.' },
        { key: 'asset-depreciation', title: 'Asset Depreciation', detail: 'Calculate depreciation and create FI posting evidence.' },
        { key: 'revenue-recognition', title: 'Revenue Recognition', detail: 'Calculate recognizable revenue for contracts.' },
        { key: 'intercompany-elimination', title: 'Intercompany Elimination', detail: 'Analyze group reporting eliminations and consolidation exposure.' },
        { key: 'mdg-duplicate-check', title: 'MDG Duplicate Check', detail: 'Detect likely duplicate business partners, suppliers, and materials.' },
      ],
      runs: runs.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/order-to-cash', auth, async (req, res) => {
  try {
    const { orderId = 1 } = req.body || {};
    const order = await getRecord('orders', orderId);
    if (!order) return res.status(404).json({ error: 'Sales order not found' });

    const deliveryNumber = `DLV-AUTO-${Date.now().toString().slice(-6)}`;
    const billingNumber = `BIL-AUTO-${Date.now().toString().slice(-6)}`;
    const delivery = await pool.query(
      `INSERT INTO deliveries (delivery_number, sales_order, customer_name, ship_to_address, delivery_date, actual_ship_date, carrier, tracking_number, total_weight, weight_unit, total_volume, status)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE, $5, $6, $7, 'KG', $8, 'Created') RETURNING *`,
      [deliveryNumber, order.order_number, order.account_name, order.shipping_address || 'Default ship-to', 'SAP Logistics', `TRK-${Date.now().toString().slice(-8)}`, 120, 3.4]
    );
    const billing = await pool.query(
      `INSERT INTO billing_documents (billing_number, customer_name, sales_order, delivery_number, billing_type, amount, tax, total, billing_date, payment_terms, currency, status)
       VALUES ($1, $2, $3, $4, 'Invoice', $5, $6, $7, CURRENT_DATE, 'Net 30', 'EUR', 'Released') RETURNING *`,
      [billingNumber, order.account_name, order.order_number, deliveryNumber, order.amount || order.total || 0, order.tax || 0, order.total || order.amount || 0]
    );
    const posting = await createPosting({
      sourceModule: 'orders',
      sourceId: order.id,
      amount: order.total || order.amount,
      currency: 'EUR',
      createdBy: req.user?.email || 'system',
      documentType: 'SD Billing Accounting Document',
    });
    const output = {
      order,
      delivery: delivery.rows[0],
      billing: billing.rows[0],
      posting,
      chain: [
        { step: 'Sales Order', document: order.order_number, status: order.status },
        { step: 'Outbound Delivery', document: deliveryNumber, status: 'Created' },
        { step: 'Billing Document', document: billingNumber, status: 'Released' },
        { step: 'FI Posting', document: posting.document_number, status: posting.status },
      ],
    };
    await logRun(req, 'order-to-cash', order.order_number, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/procure-to-pay', auth, async (req, res) => {
  try {
    const { purchaseOrderId = 1 } = req.body || {};
    const po = await getRecord('purchase_orders', purchaseOrderId);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const grNumber = `GR-AUTO-${Date.now().toString().slice(-6)}`;
    const invoiceNumber = `AP-AUTO-${Date.now().toString().slice(-6)}`;
    const goodsReceipt = await pool.query(
      `INSERT INTO goods_receipts (gr_number, po_number, vendor_name, material, quantity, unit, receipt_date, plant, storage_location, batch, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'EA', CURRENT_DATE, $6, $7, $8, 'Posted', 'Auto-created by SAP Process Hub') RETURNING *`,
      [grNumber, po.po_number, po.vendor_name, po.material, po.quantity || 1, po.plant || '1000', po.storage_location || 'WH01', `BATCH-${Date.now().toString().slice(-5)}`]
    );
    const ap = await pool.query(
      `INSERT INTO accounts_payable (invoice_number, vendor_name, amount, tax, total, due_date, payment_status, payment_method, days_overdue, notes)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', 'Open', 'Bank Transfer', 0, 'Auto-created by SAP Process Hub') RETURNING *`,
      [invoiceNumber, po.vendor_name, po.total || 0, moneyNum(po.total) * 0.19, moneyNum(po.total) * 1.19]
    );
    const posting = await createPosting({
      sourceModule: 'purchase_orders',
      sourceId: po.id,
      amount: po.total || 0,
      currency: po.currency || 'EUR',
      createdBy: req.user?.email || 'system',
      documentType: 'MM Goods Receipt Accounting Document',
    });
    const output = {
      purchaseOrder: po,
      goodsReceipt: goodsReceipt.rows[0],
      accountsPayable: ap.rows[0],
      posting,
      chain: [
        { step: 'Purchase Order', document: po.po_number, status: po.status },
        { step: 'Goods Receipt', document: grNumber, status: 'Posted' },
        { step: 'AP Invoice', document: invoiceNumber, status: 'Open' },
        { step: 'FI Posting', document: posting.document_number, status: posting.status },
      ],
    };
    await logRun(req, 'procure-to-pay', po.po_number, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/atp-check', auth, async (req, res) => {
  try {
    const { materialNumber, requestedQuantity = 100, plant } = req.body || {};
    const params = [];
    let query = 'SELECT * FROM inventory';
    const where = [];
    if (materialNumber) { params.push(`%${materialNumber}%`); where.push(`(material_number ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    if (plant) { params.push(plant); where.push(`plant = $${params.length}`); }
    if (where.length) query += ` WHERE ${where.join(' AND ')}`;
    query += ' ORDER BY quantity DESC LIMIT 5';
    const inv = await pool.query(query, params);
    const totalAvailable = inv.rows.reduce((sum, row) => sum + moneyNum(row.quantity), 0);
    const requested = moneyNum(requestedQuantity);
    const output = {
      requestedQuantity: requested,
      totalAvailable,
      decision: totalAvailable >= requested ? 'Confirmed in full' : totalAvailable > 0 ? 'Partial confirmation' : 'Not confirmed',
      confirmedQuantity: Math.min(totalAvailable, requested),
      shortage: Math.max(0, requested - totalAvailable),
      confirmations: inv.rows.map((row) => ({
        material: row.material_number,
        plant: row.plant,
        storageLocation: row.storage_location,
        available: Number(row.quantity || 0),
        stockType: row.stock_type,
      })),
    };
    await logRun(req, 'atp-check', materialNumber || 'inventory', req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payroll-calculate', auth, async (req, res) => {
  try {
    const { employeeId = 1, bonus = 0 } = req.body || {};
    const employee = await getRecord('employees', employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    const monthlyGross = moneyNum(employee.salary) / 12 + moneyNum(bonus);
    const incomeTax = monthlyGross * 0.22;
    const socialSecurity = monthlyGross * 0.074;
    const health = monthlyGross * 0.036;
    const netPay = monthlyGross - incomeTax - socialSecurity - health;
    const output = {
      employee: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
      employeeId: employee.id,
      period: new Date().toISOString().slice(0, 7),
      grossPay: Number(monthlyGross.toFixed(2)),
      deductions: [
        { type: 'Income Tax', amount: Number(incomeTax.toFixed(2)) },
        { type: 'Social Security', amount: Number(socialSecurity.toFixed(2)) },
        { type: 'Health Insurance', amount: Number(health.toFixed(2)) },
      ],
      netPay: Number(netPay.toFixed(2)),
      postingReady: true,
    };
    await logRun(req, 'payroll-calc', String(employee.id), req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tax-validate', auth, async (req, res) => {
  try {
    const { country = 'DE', documentType = 'Invoice', amount = 10000, currency = 'EUR' } = req.body || {};
    const vatRates = { DE: 0.19, FR: 0.20, GB: 0.20, US: 0.0825, CH: 0.081, IN: 0.18 };
    const rate = vatRates[country] ?? 0.19;
    const tax = moneyNum(amount) * rate;
    const output = {
      country,
      documentType,
      taxableAmount: moneyNum(amount),
      currency,
      taxRate: rate,
      taxAmount: Number(tax.toFixed(2)),
      requiredArtifacts: ['Tax code mapping', 'E-document validation', 'Audit trail', country === 'US' ? 'Jurisdiction check' : 'VAT report line'],
      decision: tax > 0 ? 'Compliant with review' : 'No tax calculated',
      warnings: country === 'US' ? ['US tax requires jurisdiction-level validation.'] : [],
    };
    await logRun(req, 'tax-validate', `${country}-${documentType}`, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ewm-wave-plan', auth, async (req, res) => {
  try {
    const { warehouse = 'WH01', maxTasks = 10 } = req.body || {};
    const bins = await pool.query('SELECT * FROM storage_bins WHERE warehouse = $1 OR $1 = $2 ORDER BY current_stock DESC LIMIT $3', [warehouse, '', Number(maxTasks) || 10]);
    const tasks = bins.rows.map((bin, index) => ({
      sequence: index + 1,
      sourceBin: bin.bin_id,
      warehouse: bin.warehouse,
      pickQuantity: Math.min(Number(bin.current_stock || 0), 100),
      priority: index < 3 ? 'High' : 'Normal',
    }));
    const output = {
      waveNumber: `WAVE-${Date.now().toString().slice(-6)}`,
      warehouse,
      taskCount: tasks.length,
      estimatedMinutes: tasks.length * 7,
      tasks,
    };
    await logRun(req, 'ewm-wave-plan', output.waveNumber, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tm-route-plan', auth, async (req, res) => {
  try {
    const { origin = 'Walldorf, DE', destination = 'Munich, DE', weightKg = 1000, mode = 'Road' } = req.body || {};
    const distanceKm = Math.max(80, Math.round((origin.length + destination.length) * 13 + moneyNum(weightKg) / 20));
    const cost = distanceKm * (mode === 'Air' ? 4.2 : mode === 'Ocean' ? 0.8 : 1.35) + moneyNum(weightKg) * 0.12;
    const output = {
      freightOrder: `FO-${Date.now().toString().slice(-7)}`,
      origin,
      destination,
      mode,
      distanceKm,
      estimatedCost: Number(cost.toFixed(2)),
      currency: 'EUR',
      transitDays: mode === 'Air' ? 1 : mode === 'Ocean' ? 18 : Math.ceil(distanceKm / 550),
      carrierRecommendation: mode === 'Air' ? 'Lufthansa Cargo' : mode === 'Ocean' ? 'Maersk' : 'DHL Freight',
      risk: distanceKm > 1000 ? 'Medium' : 'Low',
    };
    await logRun(req, 'tm-route-plan', output.freightOrder, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/role-access-check', auth, async (req, res) => {
  try {
    const { role = 'manager', process = 'Procure to Pay', amount = 100000 } = req.body || {};
    const highValue = moneyNum(amount) >= 250000;
    const permissions = {
      display: true,
      create: ['admin', 'manager', 'controller'].includes(role),
      approve: role === 'admin' || (role === 'manager' && !highValue) || role === 'controller',
      post: role === 'admin' || role === 'controller',
    };
    const warnings = [];
    if (permissions.create && permissions.approve && process === 'Procure to Pay') warnings.push('SoD review: same role can create and approve purchasing transaction.');
    if (highValue && role !== 'admin' && role !== 'controller') warnings.push('High-value transaction requires finance/controller release.');
    const output = {
      role,
      process,
      amount: moneyNum(amount),
      authorizationObjects: ['F_BKPF_BUK', 'M_BEST_EKG', 'V_VBAK_VKO', 'S_SERVICE'],
      permissions,
      decision: warnings.length ? 'Allowed with controls' : 'Allowed',
      warnings,
    };
    await logRun(req, 'role-access-check', `${role}-${process}`, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mrp-run', auth, async (req, res) => {
  try {
    const { plant = '1000', planningScope = 'Net Change', maxProposals = 10 } = req.body || {};
    let inventory = await pool.query(
      `SELECT * FROM inventory
       WHERE (plant = $1 OR $1 = '') AND quantity <= reorder_point
       ORDER BY (reorder_point - quantity) DESC NULLS LAST
       LIMIT $2`,
      [plant, Number(maxProposals) || 10]
    );
    if (inventory.rows.length === 0) {
      inventory = await pool.query(
        `SELECT * FROM inventory
         WHERE plant = $1 OR $1 = ''
         ORDER BY quantity ASC NULLS LAST
         LIMIT $2`,
        [plant, Number(maxProposals) || 10]
      );
    }
    const proposals = [];
    for (const row of inventory.rows) {
      const shortage = Math.max(0, moneyNum(row.reorder_point) - moneyNum(row.quantity));
      const proposalQty = Math.max(shortage, Math.round(moneyNum(row.max_stock) * 0.25) || 100);
      const prNumber = `MRP-PR-${Date.now().toString().slice(-6)}-${row.id}`;
      const inserted = await pool.query(
        `INSERT INTO purchase_requisitions
         (pr_number, description, requester, material, quantity, estimated_price, total, required_date, cost_center, priority, status, notes)
         VALUES ($1, $2, 'MRP Controller', $3, $4, $5, $6, CURRENT_DATE + INTERVAL '14 days', 'CC-1000', $7, 'Created', $8)
         RETURNING *`,
        [prNumber, `MRP replenishment for ${row.description}`, row.description || row.material_number, proposalQty, 100, proposalQty * 100, shortage > 100 ? 'High' : 'Normal', `Generated from ${planningScope} planning run`]
      );
      proposals.push({ material: row.material_number, plant: row.plant, shortage, proposalQty, requisition: inserted.rows[0].pr_number });
    }
    const output = {
      summary: `${proposals.length} procurement proposals created for plant ${plant || 'all plants'}.`,
      metrics: [
        { label: 'Planning Scope', value: planningScope },
        { label: 'Plant', value: plant || 'All' },
        { label: 'Proposals', value: proposals.length },
        { label: 'Total Quantity', value: proposals.reduce((sum, p) => sum + p.proposalQty, 0) },
      ],
      rows: proposals,
      warnings: proposals.length === 0 ? ['No materials were available for planning.'] : inventory.rows.some((row) => moneyNum(row.quantity) > moneyNum(row.reorder_point)) ? ['No material was below reorder point; proposals were generated from lowest-stock records for planning review.'] : [],
    };
    await logRun(req, 'mrp-run', plant, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/production-confirmation', auth, async (req, res) => {
  try {
    const { productionOrderId = 1, yieldQuantity, scrapQuantity = 0 } = req.body || {};
    const order = await getRecord('production_orders', productionOrderId);
    if (!order) return res.status(404).json({ error: 'Production order not found' });
    const yieldQty = moneyNum(yieldQuantity || order.quantity || 0);
    const scrapQty = moneyNum(scrapQuantity);
    await pool.query('UPDATE production_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['Confirmed', order.id]);
    const posting = await createPosting({
      sourceModule: 'production_orders',
      sourceId: order.id,
      amount: yieldQty * 150,
      currency: 'EUR',
      createdBy: req.user?.email || 'system',
      documentType: 'Production Goods Receipt',
    });
    const output = {
      summary: `Production order ${order.order_number} confirmed.`,
      metrics: [
        { label: 'Order', value: order.order_number },
        { label: 'Yield', value: yieldQty },
        { label: 'Scrap', value: scrapQty },
        { label: 'Posting', value: posting.document_number },
      ],
      rows: [
        { step: 'Order Confirmation', status: 'Confirmed', quantity: yieldQty },
        { step: 'Goods Receipt', status: 'Posted', quantity: yieldQty - scrapQty },
        { step: 'Variance Review', status: scrapQty > 0 ? 'Required' : 'Not Required', quantity: scrapQty },
      ],
      warnings: scrapQty > yieldQty * 0.05 ? ['Scrap exceeds 5% tolerance and should be reviewed.'] : [],
      posting,
    };
    await logRun(req, 'production-confirmation', order.order_number, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bank-reconciliation', auth, async (req, res) => {
  try {
    const { bankName = '' } = req.body || {};
    const banks = await pool.query(
      `SELECT * FROM bank_accounting WHERE bank_name ILIKE $1 OR $1 = '%%' ORDER BY balance DESC LIMIT 5`,
      [`%${bankName}%`]
    );
    const payments = await pool.query(`SELECT * FROM payments ORDER BY payment_date DESC NULLS LAST LIMIT 15`);
    const totalBank = banks.rows.reduce((sum, b) => sum + moneyNum(b.balance), 0);
    const totalPayments = payments.rows.reduce((sum, p) => sum + moneyNum(p.amount), 0);
    const variance = totalBank - totalPayments;
    const output = {
      summary: `Matched ${payments.rows.length} payment records against ${banks.rows.length} bank accounts.`,
      metrics: [
        { label: 'Bank Balance', value: Number(totalBank.toFixed(2)) },
        { label: 'Payments', value: Number(totalPayments.toFixed(2)) },
        { label: 'Variance', value: Number(variance.toFixed(2)) },
        { label: 'Decision', value: Math.abs(variance) < totalBank * 0.1 ? 'Accept with review' : 'Exception review' },
      ],
      rows: banks.rows.map((b) => ({ bank: b.bank_name, account: b.account_number, balance: b.balance, currency: b.currency, status: b.status })),
      warnings: Math.abs(variance) > totalBank * 0.1 ? ['Variance exceeds 10% of selected bank balance.'] : [],
    };
    await logRun(req, 'bank-reconciliation', bankName || 'all banks', req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dunning-run', auth, async (req, res) => {
  try {
    const { minimumDays = 30 } = req.body || {};
    const ar = await pool.query(
      `SELECT * FROM accounts_receivable
       WHERE days_outstanding >= $1 OR days_overdue >= $1
       ORDER BY days_outstanding DESC NULLS LAST, total DESC LIMIT 25`,
      [Number(minimumDays) || 30]
    ).catch(async () => pool.query(
      `SELECT * FROM accounts_receivable WHERE days_outstanding >= $1 ORDER BY days_outstanding DESC LIMIT 25`,
      [Number(minimumDays) || 30]
    ));
    let selectedRows = ar.rows;
    if (selectedRows.length === 0) {
      const fallback = await pool.query(`SELECT * FROM accounts_receivable ORDER BY days_outstanding DESC NULLS LAST, total DESC LIMIT 10`);
      selectedRows = fallback.rows;
    }
    const rows = selectedRows.map((item) => ({
      invoice: item.invoice_number,
      customer: item.customer_name,
      amount: item.total || item.amount,
      daysOutstanding: item.days_outstanding,
      dunningLevel: item.dunning_level || 'Level 1',
      action: Number(item.days_outstanding || 0) >= Number(minimumDays || 30) ? (Number(item.days_outstanding || 0) > 60 ? 'Final notice' : 'Reminder') : 'Monitor',
    }));
    const output = {
      summary: `${rows.length} receivables selected for dunning.`,
      metrics: [
        { label: 'Minimum Days', value: minimumDays },
        { label: 'Items', value: rows.length },
        { label: 'Exposure', value: rows.reduce((sum, r) => sum + moneyNum(r.amount), 0) },
        { label: 'High Priority', value: rows.filter((r) => r.action === 'Final notice').length },
      ],
      rows,
      warnings: ar.rows.length ? [] : ['No receivables met the threshold; highest-risk open items are shown for monitoring.'],
    };
    await logRun(req, 'dunning-run', `days-${minimumDays}`, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/asset-depreciation', auth, async (req, res) => {
  try {
    const { assetId = 1, months = 1 } = req.body || {};
    const asset = await getRecord('asset_accounting', assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const usefulLifeMonths = Math.max(1, Number(asset.useful_life_years || 5) * 12);
    const monthlyDepreciation = moneyNum(asset.acquisition_value) / usefulLifeMonths;
    const depreciationAmount = monthlyDepreciation * (Number(months) || 1);
    const posting = await createPosting({
      sourceModule: 'asset_accounting',
      sourceId: asset.id,
      amount: depreciationAmount,
      currency: 'EUR',
      createdBy: req.user?.email || 'system',
      documentType: 'Asset Depreciation Posting',
    });
    const output = {
      summary: `Depreciation calculated for ${asset.asset_number}.`,
      metrics: [
        { label: 'Asset', value: asset.asset_number },
        { label: 'Method', value: asset.depreciation_method },
        { label: 'Months', value: months },
        { label: 'Depreciation', value: Number(depreciationAmount.toFixed(2)) },
        { label: 'Posting', value: posting.document_number },
      ],
      rows: [
        { account: 'Depreciation Expense', debit: Number(depreciationAmount.toFixed(2)), credit: 0 },
        { account: 'Accumulated Depreciation', debit: 0, credit: Number(depreciationAmount.toFixed(2)) },
      ],
      posting,
    };
    await logRun(req, 'asset-depreciation', asset.asset_number, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/revenue-recognition', auth, async (req, res) => {
  try {
    const { contractId = 1, recognitionPercent = 25 } = req.body || {};
    const contract = await getRecord('contracts', contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const recognized = moneyNum(contract.value) * (Number(recognitionPercent) || 0) / 100;
    const deferred = moneyNum(contract.value) - recognized;
    const posting = await createPosting({
      sourceModule: 'contracts',
      sourceId: contract.id,
      amount: recognized,
      currency: 'EUR',
      createdBy: req.user?.email || 'system',
      documentType: 'Revenue Recognition Posting',
    });
    const output = {
      summary: `Revenue recognition calculated for ${contract.contract_number}.`,
      metrics: [
        { label: 'Contract', value: contract.contract_number },
        { label: 'Contract Value', value: Number(moneyNum(contract.value).toFixed(2)) },
        { label: 'Recognized', value: Number(recognized.toFixed(2)) },
        { label: 'Deferred', value: Number(deferred.toFixed(2)) },
      ],
      rows: [
        { obligation: 'License / Subscription', allocation: '60%', recognized: Number((recognized * 0.6).toFixed(2)) },
        { obligation: 'Implementation Services', allocation: '30%', recognized: Number((recognized * 0.3).toFixed(2)) },
        { obligation: 'Support', allocation: '10%', recognized: Number((recognized * 0.1).toFixed(2)) },
      ],
      posting,
    };
    await logRun(req, 'revenue-recognition', contract.contract_number, req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/intercompany-elimination', auth, async (req, res) => {
  try {
    const reporting = await pool.query(`SELECT * FROM group_reporting ORDER BY amount DESC NULLS LAST LIMIT 20`).catch(() => ({ rows: [] }));
    const sourceRows = reporting.rows.length ? reporting.rows : [
      { code: 'IC-1000', name: 'Intercompany Revenue', category: 'Intercompany', amount: 250000, status: 'Active' },
      { code: 'IC-2000', name: 'Intercompany COGS', category: 'Intercompany', amount: -180000, status: 'Active' },
    ];
    const exposure = sourceRows.reduce((sum, row) => sum + Math.abs(moneyNum(row.amount)), 0);
    const elimination = sourceRows.reduce((sum, row) => sum + moneyNum(row.amount), 0);
    const output = {
      summary: `${sourceRows.length} consolidation records analyzed for elimination.`,
      metrics: [
        { label: 'Records', value: sourceRows.length },
        { label: 'Gross Exposure', value: Number(exposure.toFixed(2)) },
        { label: 'Net Elimination', value: Number(elimination.toFixed(2)) },
        { label: 'Decision', value: Math.abs(elimination) < exposure * 0.2 ? 'Balanced with review' : 'Unbalanced' },
      ],
      rows: sourceRows.map((row) => ({ code: row.code, name: row.name, category: row.category, amount: row.amount, status: row.status })),
      warnings: Math.abs(elimination) >= exposure * 0.2 ? ['Intercompany imbalance exceeds 20% of gross exposure.'] : [],
    };
    await logRun(req, 'intercompany-elimination', 'group-close', req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mdg-duplicate-check', auth, async (req, res) => {
  try {
    const { search = '' } = req.body || {};
    const accounts = await pool.query(
      `SELECT id, name, industry, country, status FROM accounts
       WHERE name ILIKE $1 OR industry ILIKE $1 OR $1 = '%%'
       ORDER BY name LIMIT 30`,
      [`%${search}%`]
    );
    const groups = new Map();
    for (const account of accounts.rows) {
      const key = String(account.name || '').split(/\s+/)[0].toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(account);
    }
    const duplicates = [];
    for (const [key, rows] of groups.entries()) {
      if (rows.length > 1 || key.length <= 4) {
        rows.slice(0, 3).forEach((row) => duplicates.push({
          candidate: row.name,
          matchGroup: key || 'unknown',
          country: row.country,
          status: row.status,
          confidence: rows.length > 1 ? 'High' : 'Medium',
        }));
      }
    }
    const output = {
      summary: `${duplicates.length} duplicate candidates identified.`,
      metrics: [
        { label: 'Accounts Scanned', value: accounts.rows.length },
        { label: 'Candidates', value: duplicates.length },
        { label: 'High Confidence', value: duplicates.filter((d) => d.confidence === 'High').length },
        { label: 'Decision', value: duplicates.length ? 'Steward review required' : 'No duplicates found' },
      ],
      rows: duplicates,
      warnings: duplicates.length ? ['Potential duplicates should be merged through MDG change request approval.'] : [],
    };
    await logRun(req, 'mdg-duplicate-check', search || 'accounts', req.body, output);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

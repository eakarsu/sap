const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_workflow_tasks (
      id SERIAL PRIMARY KEY,
      task_key TEXT NOT NULL UNIQUE,
      workflow_type TEXT NOT NULL,
      title TEXT NOT NULL,
      business_object TEXT NOT NULL,
      object_key TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Ready',
      processor_role TEXT DEFAULT 'Manager',
      assigned_to TEXT,
      substituted_to TEXT,
      due_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 days',
      payload JSONB DEFAULT '{}'::jsonb,
      decision_history JSONB DEFAULT '[]'::jsonb,
      created_by TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_workflow_delegations (
      id SERIAL PRIMARY KEY,
      delegator TEXT NOT NULL,
      substitute TEXT NOT NULL,
      workflow_type TEXT DEFAULT 'ALL',
      valid_from DATE DEFAULT CURRENT_DATE,
      valid_to DATE DEFAULT CURRENT_DATE + INTERVAL '30 days',
      active BOOLEAN DEFAULT true,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_workflow_audit (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      action TEXT NOT NULL,
      actor TEXT,
      note TEXT,
      before_status TEXT,
      after_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
  ensured = true;
}

async function seedDefaults() {
  const tasks = [
    ['WF-PO-100045', 'Purchase Release', 'Approve high-value purchase order', 'Purchase Order', 'PO-100045', 'High', 'Ready', 'Finance Controller', 'controller@sapcrm.com', { amount: 420000, vendor: 'Global Components AG', companyCode: '1000' }],
    ['WF-VEN-2841', 'Master Data Change', 'Review vendor bank account change', 'Business Partner', 'VEN-2841', 'Critical', 'Ready', 'MDG Steward', 'steward@sapcrm.com', { sensitiveFields: ['bank_account', 'tax_id'], country: 'DE' }],
    ['WF-JE-9042', 'Journal Approval', 'Approve manual journal posting', 'Accounting Document', 'JE-9042', 'High', 'In Review', 'Controller', 'controller@sapcrm.com', { amount: 95000, ledger: '0L', period: '2026-07' }],
    ['WF-CR-8832', 'Credit Block', 'Release customer credit block', 'Sales Order', 'SO-8832', 'Medium', 'Ready', 'Credit Manager', 'credit.manager@sapcrm.com', { customer: 'Acme Corp', exposure: 185000 }],
    ['WF-PRD-711', 'Production Variance', 'Review production variance escalation', 'Production Order', 'PRD-711', 'Medium', 'Ready', 'Plant Controller', 'plant.controller@sapcrm.com', { variancePercent: 12.4, plant: '1000' }],
    ['WF-TAX-5510', 'Tax Compliance', 'Approve e-document correction', 'Tax Document', 'EDOC-5510', 'Critical', 'Escalated', 'Tax Manager', 'tax.manager@sapcrm.com', { country: 'BR', errors: 3 }],
  ];

  for (const task of tasks) {
    await pool.query(
      `INSERT INTO sap_workflow_tasks
       (task_key, workflow_type, title, business_object, object_key, priority, status, processor_role, assigned_to, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (task_key) DO NOTHING`,
      [task[0], task[1], task[2], task[3], task[4], task[5], task[6], task[7], task[8], JSON.stringify(task[9])]
    );
  }

  await pool.query(
    `INSERT INTO sap_workflow_delegations (delegator, substitute, workflow_type, reason)
     VALUES ('controller@sapcrm.com', 'backup.controller@sapcrm.com', 'Journal Approval', 'Month-end coverage')
     ON CONFLICT DO NOTHING`
  );
}

async function audit(taskId, action, actor, note, beforeStatus, afterStatus) {
  await pool.query(
    `INSERT INTO sap_workflow_audit (task_id, action, actor, note, before_status, after_status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [taskId || null, action, actor || 'system', note || null, beforeStatus || null, afterStatus || null]
  );
}

function userEmail(req) {
  return req.user?.email || req.user?.full_name || 'system';
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [tasks, delegations, auditRows] = await Promise.all([
      pool.query('SELECT * FROM sap_workflow_tasks ORDER BY due_at ASC, priority DESC'),
      pool.query('SELECT * FROM sap_workflow_delegations ORDER BY created_at DESC LIMIT 25'),
      pool.query('SELECT * FROM sap_workflow_audit ORDER BY created_at DESC LIMIT 25'),
    ]);
    const now = Date.now();
    const overdue = tasks.rows.filter((t) => new Date(t.due_at).getTime() < now && !['Approved', 'Rejected', 'Completed'].includes(t.status));
    const escalated = tasks.rows.filter((t) => t.status === 'Escalated');
    const ready = tasks.rows.filter((t) => ['Ready', 'In Review', 'Escalated'].includes(t.status));
    res.json({
      summary: {
        total: tasks.rows.length,
        ready: ready.length,
        overdue: overdue.length,
        escalated: escalated.length,
        delegations: delegations.rows.filter((d) => d.active).length,
      },
      tasks: tasks.rows,
      delegations: delegations.rows,
      audit: auditRows.rows,
      capabilities: [
        'Approve and reject workflow tasks',
        'Forward tasks to another processor',
        'Create substitutions and delegations',
        'Escalate overdue or critical work items',
        'Track workflow decision audit history',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', auth, async (req, res) => {
  try {
    await ensureTables();
    const {
      workflow_type = 'General Approval',
      title,
      business_object = 'Business Object',
      object_key,
      priority = 'Medium',
      processor_role = 'Manager',
      assigned_to,
      due_days = 2,
      payload = {},
    } = req.body || {};
    if (!title || !object_key) return res.status(400).json({ error: 'title and object_key required' });
    const taskKey = `WF-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO sap_workflow_tasks
       (task_key, workflow_type, title, business_object, object_key, priority, processor_role, assigned_to, due_at, payload, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW() + ($9::int * INTERVAL '1 day'),$10,$11)
       RETURNING *`,
      [taskKey, workflow_type, title, business_object, object_key, priority, processor_role, assigned_to || null, parseInt(due_days, 10) || 2, JSON.stringify(payload || {}), userEmail(req)]
    );
    await audit(result.rows[0].id, 'CREATE', userEmail(req), 'Workflow task created', null, 'Ready');
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/action', auth, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { action, note, forward_to } = req.body || {};
    const current = await pool.query('SELECT * FROM sap_workflow_tasks WHERE id = $1', [id]);
    const task = current.rows[0];
    if (!task) return res.status(404).json({ error: 'Workflow task not found' });

    const normalized = String(action || '').toLowerCase();
    const statusMap = {
      approve: 'Approved',
      reject: 'Rejected',
      complete: 'Completed',
      escalate: 'Escalated',
      claim: 'In Review',
      release: 'Ready',
      forward: 'Ready',
    };
    const nextStatus = statusMap[normalized];
    if (!nextStatus) return res.status(400).json({ error: 'Unsupported action' });

    const historyEntry = {
      action: normalized,
      actor: userEmail(req),
      note: note || '',
      at: new Date().toISOString(),
      from: task.status,
      to: nextStatus,
      forward_to: forward_to || null,
    };
    const assignedTo = normalized === 'forward' ? forward_to : normalized === 'claim' ? userEmail(req) : task.assigned_to;
    const result = await pool.query(
      `UPDATE sap_workflow_tasks
       SET status = $1,
           assigned_to = COALESCE($2, assigned_to),
           decision_history = decision_history || $3::jsonb,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [nextStatus, assignedTo || null, JSON.stringify([historyEntry]), id]
    );
    await audit(id, normalized.toUpperCase(), userEmail(req), note || forward_to || null, task.status, nextStatus);
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delegations', auth, async (req, res) => {
  try {
    await ensureTables();
    const { delegator = userEmail(req), substitute, workflow_type = 'ALL', valid_from, valid_to, reason } = req.body || {};
    if (!substitute) return res.status(400).json({ error: 'substitute required' });
    const result = await pool.query(
      `INSERT INTO sap_workflow_delegations (delegator, substitute, workflow_type, valid_from, valid_to, reason)
       VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),COALESCE($5::date, CURRENT_DATE + INTERVAL '30 days'),$6)
       RETURNING *`,
      [delegator, substitute, workflow_type, valid_from || null, valid_to || null, reason || null]
    );
    await audit(null, 'DELEGATE', userEmail(req), `${delegator} delegated ${workflow_type} to ${substitute}`, null, null);
    res.json({ delegation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/escalate-overdue', auth, async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(
      `UPDATE sap_workflow_tasks
       SET status = 'Escalated',
           decision_history = decision_history || jsonb_build_array(jsonb_build_object('action','auto_escalate','actor',$1::text,'at',NOW(),'note','Overdue task escalation')),
           updated_at = NOW()
       WHERE due_at < NOW() AND status NOT IN ('Approved', 'Rejected', 'Completed', 'Escalated')
       RETURNING *`,
      [userEmail(req)]
    );
    await audit(null, 'ESCALATE_OVERDUE', userEmail(req), `${result.rows.length} overdue tasks escalated`, null, 'Escalated');
    res.json({ escalated: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

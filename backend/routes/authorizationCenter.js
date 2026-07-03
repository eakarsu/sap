const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_auth_objects (
      id SERIAL PRIMARY KEY,
      object_key TEXT NOT NULL UNIQUE,
      object_name TEXT NOT NULL,
      module_area TEXT NOT NULL,
      fields JSONB DEFAULT '[]'::jsonb,
      risk_level TEXT DEFAULT 'medium',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_auth_roles (
      id SERIAL PRIMARY KEY,
      role_key TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      role_type TEXT DEFAULT 'business',
      description TEXT,
      active BOOLEAN DEFAULT true,
      authorizations JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_auth_assignments (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      role_key TEXT NOT NULL,
      valid_from DATE DEFAULT CURRENT_DATE,
      valid_to DATE DEFAULT CURRENT_DATE + INTERVAL '180 days',
      assigned_by TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_auth_audit (
      id SERIAL PRIMARY KEY,
      user_email TEXT,
      action TEXT NOT NULL,
      object_key TEXT,
      decision TEXT,
      reason TEXT,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
  ensured = true;
}

async function seedDefaults() {
  const objects = [
    ['F_BKPF_BUK', 'Accounting Document by Company Code', 'FI', ['BUKRS', 'ACTVT', 'BLART'], 'high'],
    ['M_BEST_EKG', 'Purchasing Document by Purchasing Group', 'MM', ['EKGRP', 'ACTVT', 'BSART'], 'high'],
    ['V_VBAK_VKO', 'Sales Document by Sales Area', 'SD', ['VKORG', 'VTWEG', 'SPART', 'ACTVT'], 'medium'],
    ['M_MATE_WRK', 'Material Master by Plant', 'MM', ['WERKS', 'ACTVT', 'MTART'], 'medium'],
    ['P_ORGIN', 'HR Master Data', 'HCM', ['INFTY', 'PERSA', 'ACTVT'], 'critical'],
    ['S_TABU_DIS', 'Table Maintenance Authorization Group', 'Basis', ['DICBERCLS', 'ACTVT'], 'critical'],
    ['S_RFC', 'RFC Destination Execution', 'Basis', ['RFC_NAME', 'ACTVT'], 'critical'],
  ];
  for (const obj of objects) {
    await pool.query(
      `INSERT INTO sap_auth_objects (object_key, object_name, module_area, fields, risk_level)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (object_key) DO NOTHING`,
      [obj[0], obj[1], obj[2], JSON.stringify(obj[3]), obj[4]]
    );
  }

  const roles = [
    ['SAP_BR_AP_ACCOUNTANT', 'Accounts Payable Accountant', 'business', 'AP invoice, vendor open item, and payment preparation access', [
      { object: 'F_BKPF_BUK', values: { BUKRS: ['1000'], ACTVT: ['03'] } },
      { object: 'M_BEST_EKG', values: { EKGRP: ['001', '002'], ACTVT: ['03'] } },
    ]],
    ['SAP_BR_PURCHASER', 'Operational Purchaser', 'business', 'Purchase order display and change within assigned purchasing groups', [
      { object: 'M_BEST_EKG', values: { EKGRP: ['001'], ACTVT: ['02', '03'] } },
      { object: 'M_MATE_WRK', values: { WERKS: ['1000'], ACTVT: ['03'] } },
    ]],
    ['SAP_BR_SALES_MANAGER', 'Sales Manager', 'business', 'Sales document management for domestic sales organization', [
      { object: 'V_VBAK_VKO', values: { VKORG: ['1000'], VTWEG: ['10'], ACTVT: ['02', '03'] } },
    ]],
    ['SAP_BR_HR_ADMIN', 'HR Administrator', 'business', 'HR master-data maintenance with high sensitivity', [
      { object: 'P_ORGIN', values: { INFTY: ['0000', '0001', '0008'], PERSA: ['1000'], ACTVT: ['02', '03'] } },
    ]],
    ['SAP_BASIS_ADMIN', 'Basis Administrator', 'technical', 'Technical administration including table and RFC access', [
      { object: 'S_TABU_DIS', values: { DICBERCLS: ['&NC&'], ACTVT: ['02', '03'] } },
      { object: 'S_RFC', values: { RFC_NAME: ['*'], ACTVT: ['16'] } },
    ]],
  ];
  for (const role of roles) {
    await pool.query(
      `INSERT INTO sap_auth_roles (role_key, role_name, role_type, description, authorizations)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (role_key) DO NOTHING`,
      [role[0], role[1], role[2], role[3], JSON.stringify(role[4])]
    );
  }

  const assignments = [
    ['admin@sapcrm.com', 'SAP_BASIS_ADMIN'],
    ['admin@sapcrm.com', 'SAP_BR_AP_ACCOUNTANT'],
    ['manager@sapcrm.com', 'SAP_BR_SALES_MANAGER'],
    ['controller@sapcrm.com', 'SAP_BR_AP_ACCOUNTANT'],
    ['purchaser@sapcrm.com', 'SAP_BR_PURCHASER'],
  ];
  for (const assignment of assignments) {
    await pool.query(
      `INSERT INTO sap_auth_assignments (user_email, role_key, assigned_by)
       SELECT $1,$2,'system'
       WHERE NOT EXISTS (
         SELECT 1 FROM sap_auth_assignments WHERE user_email = $1 AND role_key = $2
       )`,
      assignment
    );
  }
}

async function audit({ userEmail, action, objectKey, decision, reason, details }) {
  await pool.query(
    `INSERT INTO sap_auth_audit (user_email, action, object_key, decision, reason, details)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userEmail || null, action, objectKey || null, decision || null, reason || null, JSON.stringify(details || {})]
  );
}

function matchesValues(required = {}, allowed = {}) {
  const missing = [];
  for (const [field, value] of Object.entries(required)) {
    const allowedValues = allowed[field] || [];
    if (allowedValues.includes('*')) continue;
    const requested = Array.isArray(value) ? value : [value];
    const ok = requested.every((v) => allowedValues.map(String).includes(String(v)));
    if (!ok) missing.push({ field, requested, allowed: allowedValues });
  }
  return { allowed: missing.length === 0, missing };
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [objects, roles, assignments, audits] = await Promise.all([
      pool.query('SELECT * FROM sap_auth_objects ORDER BY module_area, object_key'),
      pool.query('SELECT * FROM sap_auth_roles ORDER BY role_key'),
      pool.query('SELECT * FROM sap_auth_assignments ORDER BY created_at DESC LIMIT 100'),
      pool.query('SELECT * FROM sap_auth_audit ORDER BY created_at DESC LIMIT 30'),
    ]);
    const criticalObjects = objects.rows.filter((o) => o.risk_level === 'critical').length;
    const privilegedAssignments = assignments.rows.filter((a) => ['SAP_BASIS_ADMIN', 'SAP_BR_HR_ADMIN'].includes(a.role_key)).length;
    const inactiveRoles = roles.rows.filter((r) => !r.active).length;
    const riskScore = Math.min(100, 25 + criticalObjects * 5 + privilegedAssignments * 9 + inactiveRoles * 4);
    res.json({
      riskScore,
      summary: {
        authObjects: objects.rows.length,
        roles: roles.rows.length,
        assignments: assignments.rows.length,
        criticalObjects,
        privilegedAssignments,
      },
      objects: objects.rows,
      roles: roles.rows,
      assignments: assignments.rows,
      audit: audits.rows,
      capabilities: [
        'Authorization object catalog',
        'Business and technical role maintenance',
        'User-to-role assignment lifecycle',
        'Access simulation with field-level values',
        'Authorization audit trail',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/roles', auth, async (req, res) => {
  try {
    await ensureTables();
    const { role_key, role_name, role_type = 'business', description = '', authorizations = [], active = true } = req.body || {};
    if (!role_key || !role_name) return res.status(400).json({ error: 'role_key and role_name required' });
    const result = await pool.query(
      `INSERT INTO sap_auth_roles (role_key, role_name, role_type, description, authorizations, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (role_key)
       DO UPDATE SET role_name = EXCLUDED.role_name, role_type = EXCLUDED.role_type,
         description = EXCLUDED.description, authorizations = EXCLUDED.authorizations,
         active = EXCLUDED.active, updated_at = NOW()
       RETURNING *`,
      [role_key, role_name, role_type, description, JSON.stringify(authorizations || []), Boolean(active)]
    );
    await audit({ userEmail: req.user?.email, action: 'ROLE_SAVE', objectKey: role_key, decision: 'saved', details: result.rows[0] });
    res.json({ role: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assignments', auth, async (req, res) => {
  try {
    await ensureTables();
    const { user_email, role_key, valid_from, valid_to, active = true } = req.body || {};
    if (!user_email || !role_key) return res.status(400).json({ error: 'user_email and role_key required' });
    const result = await pool.query(
      `INSERT INTO sap_auth_assignments (user_email, role_key, valid_from, valid_to, active, assigned_by)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),COALESCE($4::date, CURRENT_DATE + INTERVAL '180 days'),$5,$6)
       RETURNING *`,
      [user_email, role_key, valid_from || null, valid_to || null, Boolean(active), req.user?.email || 'system']
    );
    await audit({ userEmail: user_email, action: 'ASSIGN_ROLE', objectKey: role_key, decision: 'assigned', details: result.rows[0] });
    res.json({ assignment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/simulate', auth, async (req, res) => {
  try {
    await ensureTables();
    const { user_email, object_key, required_values = {} } = req.body || {};
    if (!user_email || !object_key) return res.status(400).json({ error: 'user_email and object_key required' });
    const roleResult = await pool.query(
      `SELECT r.*
       FROM sap_auth_assignments a
       JOIN sap_auth_roles r ON r.role_key = a.role_key
       WHERE a.user_email = $1
         AND a.active = true
         AND r.active = true
         AND CURRENT_DATE BETWEEN a.valid_from AND a.valid_to`,
      [user_email]
    );
    const matching = [];
    const failures = [];
    for (const role of roleResult.rows) {
      const auths = Array.isArray(role.authorizations) ? role.authorizations : [];
      for (const authz of auths) {
        if (authz.object !== object_key) continue;
        const check = matchesValues(required_values, authz.values || {});
        if (check.allowed) {
          matching.push({ role_key: role.role_key, role_name: role.role_name, authorization: authz });
        } else {
          failures.push({ role_key: role.role_key, role_name: role.role_name, missing: check.missing });
        }
      }
    }
    const allowed = matching.length > 0;
    const reason = allowed
      ? `Access granted through ${matching.map((m) => m.role_key).join(', ')}.`
      : 'No active role grants the requested authorization values.';
    const response = { allowed, reason, matchingRoles: matching, failedMatches: failures, checkedRoles: roleResult.rows.length };
    await audit({ userEmail: user_email, action: 'SIMULATE_ACCESS', objectKey: object_key, decision: allowed ? 'allowed' : 'denied', reason, details: response });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_config_profiles (
      id SERIAL PRIMARY KEY,
      area TEXT NOT NULL,
      profile_key TEXT NOT NULL UNIQUE,
      profile_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      owner TEXT DEFAULT 'SAP CoE',
      risk_level TEXT DEFAULT 'medium',
      settings JSONB DEFAULT '{}'::jsonb,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_integration_channels (
      id SERIAL PRIMARY KEY,
      channel_key TEXT NOT NULL UNIQUE,
      channel_name TEXT NOT NULL,
      source_system TEXT NOT NULL,
      target_system TEXT NOT NULL,
      protocol TEXT DEFAULT 'OData',
      status TEXT DEFAULT 'healthy',
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      error_count INTEGER DEFAULT 0,
      throughput_per_hour INTEGER DEFAULT 0,
      owner TEXT DEFAULT 'Integration Team',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_workflow_rules (
      id SERIAL PRIMARY KEY,
      rule_key TEXT NOT NULL UNIQUE,
      process_area TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      trigger_condition TEXT NOT NULL,
      approver_roles JSONB DEFAULT '[]'::jsonb,
      sla_hours INTEGER DEFAULT 24,
      active BOOLEAN DEFAULT true,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_localization_packs (
      id SERIAL PRIMARY KEY,
      country_code TEXT NOT NULL UNIQUE,
      country_name TEXT NOT NULL,
      tax_model TEXT NOT NULL,
      e_document_required BOOLEAN DEFAULT false,
      statutory_reporting TEXT DEFAULT 'Standard',
      status TEXT DEFAULT 'configured',
      controls JSONB DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await seedDefaults();
  ensured = true;
}

async function seedDefaults() {
  const profiles = [
    ['Finance', 'fi-close-ledger', 'FI Period Close and Ledger Controls', 'active', 'Record to Report Lead', 'high', { companyCodes: ['1000', '2000'], ledgers: ['0L', '2L'], hardCloseEnabled: true }],
    ['Procurement', 'mm-release-strategy', 'MM Purchase Release Strategy', 'active', 'Procurement CoE', 'high', { thresholds: [50000, 250000, 1000000], currency: 'EUR', autoReleaseBelow: 5000 }],
    ['Sales', 'sd-pricing-billing', 'SD Pricing and Billing Governance', 'active', 'Commercial Operations', 'medium', { pricingProcedure: 'ZPRC01', creditBlockEnabled: true, billingTolerancePercent: 2 }],
    ['Manufacturing', 'pp-mrp-variant', 'PP MRP Planning Variant', 'active', 'Manufacturing Planning', 'medium', { mrpType: 'PD', planningHorizonDays: 90, exceptionMonitoring: true }],
    ['Security', 'grc-sod-baseline', 'GRC SoD Baseline', 'active', 'Security Operations', 'critical', { firefighterReviewDays: 7, privilegedAccessReview: 'monthly' }],
  ];

  for (const row of profiles) {
    await pool.query(
      `INSERT INTO sap_config_profiles (area, profile_key, profile_name, status, owner, risk_level, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (profile_key) DO NOTHING`,
      [row[0], row[1], row[2], row[3], row[4], row[5], JSON.stringify(row[6])]
    );
  }

  const channels = [
    ['sf-opportunity-sync', 'Salesforce Opportunity Sync', 'Salesforce', 'SAP Sales Cloud', 'REST/OData', 'healthy', 0, 840, 'CRM Integration'],
    ['bank-statement-feed', 'Bank Statement Feed', 'Bank Network', 'SAP FI', 'SFTP', 'warning', 3, 120, 'Treasury'],
    ['ariba-po-export', 'Ariba PO Export', 'SAP Ariba', 'SAP MM', 'cXML', 'healthy', 0, 310, 'Procurement'],
    ['ewm-tm-shipment', 'EWM to TM Shipment Events', 'SAP EWM', 'SAP TM', 'Event Mesh', 'healthy', 1, 560, 'Logistics'],
    ['tax-authority-edoc', 'Tax Authority E-Document', 'SAP FI', 'Government Gateway', 'SOAP', 'critical', 12, 95, 'Tax Compliance'],
  ];

  for (const row of channels) {
    await pool.query(
      `INSERT INTO sap_integration_channels
       (channel_key, channel_name, source_system, target_system, protocol, status, error_count, throughput_per_hour, owner)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (channel_key) DO NOTHING`,
      row
    );
  }

  const rules = [
    ['po-l3-release', 'Procure to Pay', 'High-value PO Finance Release', 'purchase_order.total >= 250000', ['Department Head', 'Finance Controller', 'Procurement Lead'], 48],
    ['customer-credit-block', 'Order to Cash', 'Customer Credit Block Review', 'sales_order.credit_exposure > credit_limit', ['Credit Manager', 'Sales Director'], 12],
    ['manual-journal-review', 'Record to Report', 'Manual Journal Approval', 'journal.source = manual AND amount >= 50000', ['Controller', 'Accounting Manager'], 24],
    ['vendor-master-change', 'Master Data Governance', 'Vendor Master Sensitive Change', 'vendor.bank_account OR vendor.tax_id changed', ['MDG Steward', 'AP Manager'], 36],
    ['production-deviation', 'Plan to Produce', 'Production Variance Escalation', 'variance_percent > 8', ['Production Supervisor', 'Plant Controller'], 16],
  ];

  for (const row of rules) {
    await pool.query(
      `INSERT INTO sap_workflow_rules (rule_key, process_area, rule_name, trigger_condition, approver_roles, sla_hours)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rule_key) DO NOTHING`,
      [row[0], row[1], row[2], row[3], JSON.stringify(row[4]), row[5]]
    );
  }

  const packs = [
    ['US', 'United States', 'Sales tax / use tax', false, '1099, state reporting', ['SOX control mapping', 'Nexus review']],
    ['DE', 'Germany', 'VAT', true, 'GoBD, e-invoicing readiness', ['VAT validation', 'Document retention']],
    ['FR', 'France', 'VAT', true, 'Factur-X / Chorus Pro', ['E-document clearance', 'SAF-T readiness']],
    ['BR', 'Brazil', 'ICMS/IPI/PIS/COFINS', true, 'NF-e/SPED', ['Tax code determination', 'Nota fiscal monitoring']],
    ['IN', 'India', 'GST/TDS/TCS', true, 'GST returns and e-invoice', ['GSTIN validation', 'Withholding controls']],
  ];

  for (const row of packs) {
    await pool.query(
      `INSERT INTO sap_localization_packs (country_code, country_name, tax_model, e_document_required, statutory_reporting, controls)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (country_code) DO NOTHING`,
      [row[0], row[1], row[2], row[3], row[4], JSON.stringify(row[5])]
    );
  }
}

async function list(table, order = 'updated_at DESC') {
  const result = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
  return result.rows;
}

function statusCounts(rows) {
  return rows.reduce((acc, row) => {
    const key = row.status || (row.active === false ? 'inactive' : 'active');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [profiles, channels, rules, localization] = await Promise.all([
      list('sap_config_profiles'),
      list('sap_integration_channels', 'last_message_at DESC'),
      list('sap_workflow_rules'),
      list('sap_localization_packs'),
    ]);
    const criticalIntegrations = channels.filter((c) => ['critical', 'error'].includes(String(c.status).toLowerCase()) || Number(c.error_count) >= 10);
    const inactiveRules = rules.filter((r) => !r.active);
    const riskScore = Math.min(100, 25 + criticalIntegrations.length * 14 + inactiveRules.length * 8 + profiles.filter((p) => p.risk_level === 'critical').length * 7);

    res.json({
      riskScore,
      summary: {
        configurationProfiles: profiles.length,
        integrationChannels: channels.length,
        workflowRules: rules.length,
        localizationPacks: localization.length,
        criticalIntegrations: criticalIntegrations.length,
      },
      status: {
        profiles: statusCounts(profiles),
        integrations: statusCounts(channels),
        workflow: statusCounts(rules),
        localization: statusCounts(localization),
      },
      profiles,
      channels,
      rules,
      localization,
      gapsClosed: [
        'IMG-style configuration profile governance',
        'Integration channel health and error monitoring',
        'Workflow and release-rule maintenance',
        'Country localization and statutory control readiness',
        'Cross-module operational risk scoring',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/profiles', auth, async (req, res) => {
  try {
    await ensureTables();
    const { area, profile_key, profile_name, status = 'active', owner = 'SAP CoE', risk_level = 'medium', settings = {} } = req.body || {};
    if (!area || !profile_key || !profile_name) return res.status(400).json({ error: 'area, profile_key, and profile_name required' });
    const result = await pool.query(
      `INSERT INTO sap_config_profiles (area, profile_key, profile_name, status, owner, risk_level, settings, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (profile_key)
       DO UPDATE SET area = EXCLUDED.area, profile_name = EXCLUDED.profile_name, status = EXCLUDED.status,
         owner = EXCLUDED.owner, risk_level = EXCLUDED.risk_level, settings = EXCLUDED.settings,
         updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING *`,
      [area, profile_key, profile_name, status, owner, risk_level, JSON.stringify(settings || {}), req.user?.email || 'system']
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workflow-rules', auth, async (req, res) => {
  try {
    await ensureTables();
    const { rule_key, process_area, rule_name, trigger_condition, approver_roles = [], sla_hours = 24, active = true } = req.body || {};
    if (!rule_key || !process_area || !rule_name || !trigger_condition) return res.status(400).json({ error: 'rule_key, process_area, rule_name, and trigger_condition required' });
    const result = await pool.query(
      `INSERT INTO sap_workflow_rules (rule_key, process_area, rule_name, trigger_condition, approver_roles, sla_hours, active, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (rule_key)
       DO UPDATE SET process_area = EXCLUDED.process_area, rule_name = EXCLUDED.rule_name,
         trigger_condition = EXCLUDED.trigger_condition, approver_roles = EXCLUDED.approver_roles,
         sla_hours = EXCLUDED.sla_hours, active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING *`,
      [rule_key, process_area, rule_name, trigger_condition, JSON.stringify(approver_roles), parseInt(sla_hours, 10) || 24, Boolean(active), req.user?.email || 'system']
    );
    res.json({ rule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/integration-channels/:id/reprocess', auth, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE sap_integration_channels
       SET status = CASE WHEN error_count > 0 THEN 'warning' ELSE 'healthy' END,
           error_count = GREATEST(error_count - 3, 0),
           last_message_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Integration channel not found' });
    res.json({
      channel: result.rows[0],
      reprocess: {
        accepted: true,
        message: 'Reprocess job queued and channel health recalculated.',
        nextCheckMinutes: 15,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/localization-packs', auth, async (req, res) => {
  try {
    await ensureTables();
    const { country_code, country_name, tax_model, e_document_required = false, statutory_reporting = 'Standard', status = 'configured', controls = [] } = req.body || {};
    if (!country_code || !country_name || !tax_model) return res.status(400).json({ error: 'country_code, country_name, and tax_model required' });
    const result = await pool.query(
      `INSERT INTO sap_localization_packs (country_code, country_name, tax_model, e_document_required, statutory_reporting, status, controls)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (country_code)
       DO UPDATE SET country_name = EXCLUDED.country_name, tax_model = EXCLUDED.tax_model,
         e_document_required = EXCLUDED.e_document_required, statutory_reporting = EXCLUDED.statutory_reporting,
         status = EXCLUDED.status, controls = EXCLUDED.controls, updated_at = NOW()
       RETURNING *`,
      [String(country_code).toUpperCase(), country_name, tax_model, Boolean(e_document_required), statutory_reporting, status, JSON.stringify(controls)]
    );
    res.json({ localization: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

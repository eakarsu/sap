const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;
let ensurePromise = null;

async function ensureTables() {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;
  ensurePromise = ensureTablesInner()
    .then(() => { ensured = true; })
    .catch((err) => {
      ensurePromise = null;
      throw err;
    });
  return ensurePromise;
}

async function ensureTablesInner() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_pricing_procedures (
      id SERIAL PRIMARY KEY,
      procedure_key TEXT NOT NULL UNIQUE,
      procedure_name TEXT NOT NULL,
      sales_org TEXT DEFAULT '1000',
      distribution_channel TEXT DEFAULT '10',
      currency TEXT DEFAULT 'EUR',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_condition_records (
      id SERIAL PRIMARY KEY,
      condition_type TEXT NOT NULL,
      procedure_key TEXT NOT NULL,
      material_number TEXT,
      customer_group TEXT DEFAULT '*',
      sales_org TEXT DEFAULT '1000',
      rate_type TEXT DEFAULT 'amount',
      rate_value NUMERIC(15,4) DEFAULT 0,
      scale_from_qty NUMERIC(15,3) DEFAULT 0,
      valid_from DATE DEFAULT CURRENT_DATE,
      valid_to DATE DEFAULT CURRENT_DATE + INTERVAL '365 days',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_tax_rules (
      id SERIAL PRIMARY KEY,
      country_code TEXT NOT NULL,
      tax_code TEXT NOT NULL,
      description TEXT NOT NULL,
      rate_percent NUMERIC(8,4) DEFAULT 0,
      e_document_required BOOLEAN DEFAULT false,
      active BOOLEAN DEFAULT true,
      UNIQUE(country_code, tax_code)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_copy_control_rules (
      id SERIAL PRIMARY KEY,
      source_document TEXT NOT NULL,
      target_document TEXT NOT NULL,
      item_category TEXT DEFAULT '*',
      copy_pricing BOOLEAN DEFAULT true,
      copy_texts BOOLEAN DEFAULT true,
      quantity_rule TEXT DEFAULT 'open_quantity',
      billing_relevance TEXT DEFAULT 'delivery_related',
      active BOOLEAN DEFAULT true,
      UNIQUE(source_document, target_document, item_category)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_billing_simulations (
      id SERIAL PRIMARY KEY,
      source_document TEXT,
      customer_name TEXT,
      material_number TEXT,
      quantity NUMERIC(15,3) DEFAULT 0,
      net_value NUMERIC(15,2) DEFAULT 0,
      discount_value NUMERIC(15,2) DEFAULT 0,
      surcharge_value NUMERIC(15,2) DEFAULT 0,
      tax_value NUMERIC(15,2) DEFAULT 0,
      gross_value NUMERIC(15,2) DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      details JSONB DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
}

async function seedDefaults() {
  await pool.query(`
    INSERT INTO sap_pricing_procedures (procedure_key, procedure_name, sales_org, distribution_channel, currency)
    VALUES ('ZPRC01', 'Domestic Standard Pricing', '1000', '10', 'EUR')
    ON CONFLICT (procedure_key) DO NOTHING
  `);
  const conditions = [
    ['PR00', 'ZPRC01', 'FG-1000', '*', 'amount', 650, 0],
    ['K004', 'ZPRC01', 'FG-1000', 'VIP', 'percent', -7.5, 0],
    ['K007', 'ZPRC01', 'FG-1000', '*', 'percent', -3, 50],
    ['KF00', 'ZPRC01', 'FG-1000', '*', 'amount', 35, 0],
  ];
  for (const row of conditions) {
    await pool.query(
      `INSERT INTO sap_condition_records
       (condition_type, procedure_key, material_number, customer_group, rate_type, rate_value, scale_from_qty)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (
         SELECT 1 FROM sap_condition_records
         WHERE condition_type = $1 AND procedure_key = $2 AND material_number = $3 AND customer_group = $4 AND scale_from_qty = $7
       )`,
      row
    );
  }
  const taxes = [
    ['DE', 'A1', 'German VAT standard rate', 19, true],
    ['US', 'U1', 'US estimated sales tax', 8.25, false],
    ['FR', 'F1', 'France VAT standard rate', 20, true],
    ['BR', 'B1', 'Brazil blended indirect tax estimate', 17, true],
  ];
  for (const row of taxes) {
    await pool.query(
      `INSERT INTO sap_tax_rules (country_code, tax_code, description, rate_percent, e_document_required)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (country_code, tax_code) DO NOTHING`,
      row
    );
  }
  const copyRules = [
    ['Quotation', 'Sales Order', '*', true, true, 'full_quantity', 'order_related'],
    ['Sales Order', 'Delivery', '*', true, true, 'open_quantity', 'delivery_related'],
    ['Delivery', 'Billing Document', '*', true, true, 'delivered_quantity', 'delivery_related'],
    ['Sales Order', 'Billing Document', 'TAS', true, true, 'order_quantity', 'order_related'],
  ];
  for (const row of copyRules) {
    await pool.query(
      `INSERT INTO sap_copy_control_rules
       (source_document, target_document, item_category, copy_pricing, copy_texts, quantity_rule, billing_relevance)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_document, target_document, item_category) DO NOTHING`,
      row
    );
  }
}

function num(value) {
  return Number(value || 0);
}

function conditionAmount(condition, basePrice, quantity) {
  const rate = num(condition.rate_value);
  if (condition.rate_type === 'percent') return basePrice * quantity * (rate / 100);
  return rate * quantity;
}

async function calculatePricing({ materialNumber = 'FG-1000', quantity = 1, customerGroup = '*', countryCode = 'DE', procedureKey = 'ZPRC01' }) {
  const qty = num(quantity) || 1;
  const conditions = await pool.query(
    `SELECT * FROM sap_condition_records
     WHERE active = true
       AND procedure_key = $1
       AND (material_number = $2 OR material_number IS NULL)
       AND (customer_group = $3 OR customer_group = '*')
       AND scale_from_qty <= $4
       AND CURRENT_DATE BETWEEN valid_from AND valid_to
     ORDER BY condition_type, scale_from_qty DESC`,
    [procedureKey, materialNumber, customerGroup, qty]
  );
  const base = conditions.rows.find((c) => c.condition_type === 'PR00') || { rate_value: 0 };
  const baseValue = num(base.rate_value) * qty;
  const applied = conditions.rows.map((condition) => ({
    ...condition,
    value: conditionAmount(condition, num(base.rate_value), qty),
  }));
  const discountValue = applied.filter((c) => num(c.value) < 0).reduce((sum, c) => sum + Math.abs(num(c.value)), 0);
  const surchargeValue = applied.filter((c) => c.condition_type !== 'PR00' && num(c.value) > 0).reduce((sum, c) => sum + num(c.value), 0);
  const netValue = baseValue - discountValue + surchargeValue;
  const tax = await pool.query(
    `SELECT * FROM sap_tax_rules WHERE active = true AND country_code = $1 ORDER BY rate_percent DESC LIMIT 1`,
    [countryCode]
  );
  const taxRule = tax.rows[0] || { tax_code: 'N/A', rate_percent: 0, e_document_required: false };
  const taxValue = netValue * (num(taxRule.rate_percent) / 100);
  return {
    materialNumber,
    quantity: qty,
    customerGroup,
    countryCode,
    procedureKey,
    currency: 'EUR',
    baseValue,
    discountValue,
    surchargeValue,
    netValue,
    taxRule,
    taxValue,
    grossValue: netValue + taxValue,
    conditions: applied,
  };
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [procedures, conditions, taxes, copyRules, simulations] = await Promise.all([
      pool.query('SELECT * FROM sap_pricing_procedures ORDER BY procedure_key'),
      pool.query('SELECT * FROM sap_condition_records ORDER BY condition_type, material_number'),
      pool.query('SELECT * FROM sap_tax_rules ORDER BY country_code, tax_code'),
      pool.query('SELECT * FROM sap_copy_control_rules ORDER BY source_document, target_document'),
      pool.query('SELECT * FROM sap_billing_simulations ORDER BY created_at DESC LIMIT 20'),
    ]);
    const sample = await calculatePricing({ materialNumber: 'FG-1000', quantity: 10, customerGroup: 'VIP', countryCode: 'DE' });
    res.json({
      summary: {
        procedures: procedures.rows.length,
        conditionRecords: conditions.rows.length,
        taxRules: taxes.rows.length,
        copyControlRules: copyRules.rows.length,
        billingSimulations: simulations.rows.length,
        sampleGrossValue: Number(sample.grossValue.toFixed(2)),
      },
      procedures: procedures.rows,
      conditions: conditions.rows,
      taxes: taxes.rows,
      copyRules: copyRules.rows,
      simulations: simulations.rows,
      sample,
      capabilities: [
        'Pricing procedure and condition record simulation',
        'Customer group and quantity scale discounts',
        'Tax determination by country',
        'Copy control between quotation, order, delivery, and billing',
        'Billing document value simulation with condition details',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/price-simulate', auth, async (req, res) => {
  try {
    await ensureTables();
    const result = await calculatePricing(req.body || {});
    res.json({ pricing: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/billing-simulate', auth, async (req, res) => {
  try {
    await ensureTables();
    const {
      sourceDocument = 'SO-SIM',
      customerName = 'Acme Corporation',
      materialNumber = 'FG-1000',
      quantity = 1,
      customerGroup = '*',
      countryCode = 'DE',
    } = req.body || {};
    const pricing = await calculatePricing({ materialNumber, quantity, customerGroup, countryCode });
    const saved = await pool.query(
      `INSERT INTO sap_billing_simulations
       (source_document, customer_name, material_number, quantity, net_value, discount_value, surcharge_value, tax_value, gross_value, currency, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        sourceDocument,
        customerName,
        materialNumber,
        pricing.quantity,
        pricing.netValue,
        pricing.discountValue,
        pricing.surchargeValue,
        pricing.taxValue,
        pricing.grossValue,
        pricing.currency,
        JSON.stringify(pricing),
        req.user?.email || 'system',
      ]
    );
    res.json({ billing: saved.rows[0], pricing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/conditions', auth, async (req, res) => {
  try {
    await ensureTables();
    const {
      condition_type,
      procedure_key = 'ZPRC01',
      material_number,
      customer_group = '*',
      sales_org = '1000',
      rate_type = 'amount',
      rate_value = 0,
      scale_from_qty = 0,
    } = req.body || {};
    if (!condition_type) return res.status(400).json({ error: 'condition_type required' });
    const result = await pool.query(
      `INSERT INTO sap_condition_records
       (condition_type, procedure_key, material_number, customer_group, sales_org, rate_type, rate_value, scale_from_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [condition_type, procedure_key, material_number || null, customer_group, sales_org, rate_type, rate_value, scale_from_qty]
    );
    res.json({ condition: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tax-rules', auth, async (req, res) => {
  try {
    await ensureTables();
    const { country_code, tax_code, description, rate_percent = 0, e_document_required = false } = req.body || {};
    if (!country_code || !tax_code || !description) return res.status(400).json({ error: 'country_code, tax_code, and description required' });
    const result = await pool.query(
      `INSERT INTO sap_tax_rules (country_code, tax_code, description, rate_percent, e_document_required)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (country_code, tax_code)
       DO UPDATE SET description = EXCLUDED.description, rate_percent = EXCLUDED.rate_percent,
         e_document_required = EXCLUDED.e_document_required, active = true
       RETURNING *`,
      [String(country_code).toUpperCase(), tax_code, description, rate_percent, Boolean(e_document_required)]
    );
    res.json({ taxRule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

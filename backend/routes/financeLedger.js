const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_gl_accounts (
      id SERIAL PRIMARY KEY,
      account_number TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      financial_statement_item TEXT DEFAULT 'Unassigned',
      normal_balance TEXT DEFAULT 'debit',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_fiscal_periods (
      id SERIAL PRIMARY KEY,
      company_code TEXT NOT NULL,
      fiscal_year INTEGER NOT NULL,
      period INTEGER NOT NULL,
      status TEXT DEFAULT 'open',
      close_step TEXT DEFAULT 'operational',
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_code, fiscal_year, period)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_universal_journal (
      id SERIAL PRIMARY KEY,
      document_number TEXT NOT NULL,
      company_code TEXT DEFAULT '1000',
      fiscal_year INTEGER NOT NULL,
      period INTEGER NOT NULL,
      posting_date DATE DEFAULT CURRENT_DATE,
      document_type TEXT DEFAULT 'SA',
      line_item INTEGER NOT NULL,
      gl_account TEXT NOT NULL,
      cost_center TEXT,
      profit_center TEXT,
      segment TEXT,
      debit NUMERIC(15,2) DEFAULT 0,
      credit NUMERIC(15,2) DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      text TEXT,
      source_module TEXT DEFAULT 'manual',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
  ensured = true;
}

async function seedDefaults() {
  const accounts = [
    ['100000', 'Cash and Bank', 'Asset', 'Balance Sheet', 'debit'],
    ['110000', 'Customer Receivables', 'Asset', 'Balance Sheet', 'debit'],
    ['200000', 'Vendor Payables', 'Liability', 'Balance Sheet', 'credit'],
    ['300000', 'Retained Earnings', 'Equity', 'Balance Sheet', 'credit'],
    ['400000', 'Product Revenue', 'Revenue', 'Income Statement', 'credit'],
    ['500000', 'Cost of Goods Sold', 'Expense', 'Income Statement', 'debit'],
    ['610000', 'Consulting Expense', 'Expense', 'Income Statement', 'debit'],
    ['220000', 'Tax Payable', 'Liability', 'Balance Sheet', 'credit'],
  ];
  for (const account of accounts) {
    await pool.query(
      `INSERT INTO sap_gl_accounts (account_number, account_name, account_type, financial_statement_item, normal_balance)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_number) DO NOTHING`,
      account
    );
  }

  const now = new Date();
  const fiscalYear = now.getFullYear();
  const currentPeriod = now.getMonth() + 1;
  for (let period = 1; period <= 12; period++) {
    await pool.query(
      `INSERT INTO sap_fiscal_periods (company_code, fiscal_year, period, status, close_step)
       VALUES ('1000',$1,$2,$3,$4)
       ON CONFLICT (company_code, fiscal_year, period) DO NOTHING`,
      [fiscalYear, period, period < currentPeriod ? 'closed' : 'open', period < currentPeriod ? 'closed' : 'operational']
    );
  }

  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM sap_universal_journal');
  if (existing.rows[0]?.count > 0) return;
  await postBalancedDocument({
    companyCode: '1000',
    fiscalYear,
    period: currentPeriod,
    documentType: 'DR',
    sourceModule: 'seed',
    createdBy: 'system',
    lines: [
      { glAccount: '110000', debit: 125000, credit: 0, text: 'Customer receivable invoice' },
      { glAccount: '400000', debit: 0, credit: 125000, text: 'Product revenue' },
    ],
  });
  await postBalancedDocument({
    companyCode: '1000',
    fiscalYear,
    period: currentPeriod,
    documentType: 'KR',
    sourceModule: 'seed',
    createdBy: 'system',
    lines: [
      { glAccount: '610000', debit: 45000, credit: 0, text: 'Consulting expense' },
      { glAccount: '200000', debit: 0, credit: 45000, text: 'Vendor payable' },
    ],
  });
}

function money(value) {
  return Number(value || 0);
}

function documentNumber() {
  return `FI-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
}

async function isPeriodOpen(companyCode, fiscalYear, period) {
  const result = await pool.query(
    'SELECT status FROM sap_fiscal_periods WHERE company_code = $1 AND fiscal_year = $2 AND period = $3',
    [companyCode, fiscalYear, period]
  );
  return !result.rows[0] || result.rows[0].status === 'open';
}

async function postBalancedDocument({ companyCode, fiscalYear, period, documentType, sourceModule, createdBy, lines }) {
  const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
  if (Math.abs(debit - credit) > 0.001) {
    const err = new Error('Journal is not balanced');
    err.status = 400;
    throw err;
  }
  const open = await isPeriodOpen(companyCode, fiscalYear, period);
  if (!open) {
    const err = new Error('Fiscal period is closed');
    err.status = 409;
    throw err;
  }
  const doc = documentNumber();
  const inserted = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = await pool.query(
      `INSERT INTO sap_universal_journal
       (document_number, company_code, fiscal_year, period, document_type, line_item, gl_account,
        cost_center, profit_center, segment, debit, credit, currency, text, source_module, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        doc,
        companyCode,
        fiscalYear,
        period,
        documentType,
        i + 1,
        line.glAccount,
        line.costCenter || null,
        line.profitCenter || null,
        line.segment || null,
        money(line.debit),
        money(line.credit),
        line.currency || 'EUR',
        line.text || '',
        sourceModule || 'manual',
        createdBy || 'system',
      ]
    );
    inserted.push(result.rows[0]);
  }
  return { documentNumber: doc, debit, credit, lines: inserted };
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [accounts, periods, journals, balance] = await Promise.all([
      pool.query('SELECT * FROM sap_gl_accounts ORDER BY account_number'),
      pool.query('SELECT * FROM sap_fiscal_periods ORDER BY fiscal_year DESC, period DESC LIMIT 24'),
      pool.query('SELECT * FROM sap_universal_journal ORDER BY created_at DESC, document_number DESC, line_item ASC LIMIT 80'),
      pool.query(`
        SELECT gl_account, SUM(debit)::numeric AS debit, SUM(credit)::numeric AS credit, (SUM(debit) - SUM(credit))::numeric AS balance
        FROM sap_universal_journal
        GROUP BY gl_account
        ORDER BY gl_account
      `),
    ]);
    const totalDebit = journals.rows.reduce((sum, row) => sum + money(row.debit), 0);
    const totalCredit = journals.rows.reduce((sum, row) => sum + money(row.credit), 0);
    res.json({
      summary: {
        accounts: accounts.rows.length,
        journalLines: journals.rows.length,
        openPeriods: periods.rows.filter((p) => p.status === 'open').length,
        totalDebit,
        totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 0.001,
      },
      accounts: accounts.rows,
      periods: periods.rows,
      journalLines: journals.rows,
      trialBalance: balance.rows,
      capabilities: [
        'Universal Journal line-item table',
        'Balanced manual journal posting',
        'Fiscal period open and close control',
        'GL account master catalog',
        'Trial balance by GL account',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/journal', auth, async (req, res) => {
  try {
    await ensureTables();
    const now = new Date();
    const {
      companyCode = '1000',
      fiscalYear = now.getFullYear(),
      period = now.getMonth() + 1,
      documentType = 'SA',
      lines = [],
    } = req.body || {};
    if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ error: 'At least two journal lines required' });
    const posted = await postBalancedDocument({
      companyCode,
      fiscalYear: parseInt(fiscalYear, 10),
      period: parseInt(period, 10),
      documentType,
      sourceModule: 'manual',
      createdBy: req.user?.email || 'system',
      lines,
    });
    res.json({ posted });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/periods/:id/status', auth, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { status = 'closed', close_step = 'closed' } = req.body || {};
    if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' });
    const result = await pool.query(
      `UPDATE sap_fiscal_periods
       SET status = $1, close_step = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, close_step, req.user?.email || 'system', id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Fiscal period not found' });
    res.json({ period: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', auth, async (req, res) => {
  try {
    await ensureTables();
    const { account_number, account_name, account_type, financial_statement_item = 'Unassigned', normal_balance = 'debit' } = req.body || {};
    if (!account_number || !account_name || !account_type) return res.status(400).json({ error: 'account_number, account_name, and account_type required' });
    const result = await pool.query(
      `INSERT INTO sap_gl_accounts (account_number, account_name, account_type, financial_statement_item, normal_balance)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_number)
       DO UPDATE SET account_name = EXCLUDED.account_name, account_type = EXCLUDED.account_type,
         financial_statement_item = EXCLUDED.financial_statement_item, normal_balance = EXCLUDED.normal_balance
       RETURNING *`,
      [account_number, account_name, account_type, financial_statement_item, normal_balance]
    );
    res.json({ account: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

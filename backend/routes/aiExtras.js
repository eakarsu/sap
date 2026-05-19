// AI Extras — Custom Feature Suggestions (batch 11) for SAP UI shell.
// OData/BAPI Connector, AI Insights Engine, Mobile Approvals,
// Process Mining, Natural-Language SAP Query, Variant Configuration Assistant.

const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

async function callAI(messages, opts = {}) {
  if (!process.env.OPENROUTER_API_KEY) {
    const e = new Error('OPENROUTER_API_KEY not configured');
    e.status = 503;
    throw e;
  }
  const r = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'SAP AI Extras',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: opts.maxTokens || 1500,
      temperature: opts.temperature ?? 0.4,
    }),
  });
  const data = await r.json();
  if (data?.error) throw new Error(data.error.message || 'LLM error');
  return data.choices?.[0]?.message?.content || '';
}

function fail(res, e) { res.status(e?.status || 500).json({ error: e?.message || 'failed' }); }

// 1) OData/BAPI Connector Service — proxy to SAP ECC/S/4HANA OData.
// TODO: configure credentials — SAP_ODATA_URL, SAP_ODATA_USER, SAP_ODATA_PASSWORD.
router.post('/odata/query', auth, async (req, res) => {
  const { entitySet, filters, top = 50 } = req.body || {};
  if (!entitySet) return res.status(400).json({ error: 'entitySet required' });
  const base = process.env.SAP_ODATA_URL;
  if (!base) {
    return res.status(503).json({
      error: 'SAP_ODATA_URL not configured',
      message: 'TODO: configure credentials (SAP_ODATA_URL, SAP_ODATA_USER, SAP_ODATA_PASSWORD).',
    });
  }
  const headers = { Accept: 'application/json' };
  if (process.env.SAP_ODATA_USER && process.env.SAP_ODATA_PASSWORD) {
    headers.Authorization = 'Basic ' + Buffer.from(`${process.env.SAP_ODATA_USER}:${process.env.SAP_ODATA_PASSWORD}`).toString('base64');
  }
  const q = filters ? `$filter=${encodeURIComponent(filters)}&$top=${top}` : `$top=${top}`;
  try {
    const r = await fetch(`${base}/${encodeURIComponent(entitySet)}?${q}`, { headers });
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { rawText: text }; }
    res.status(r.status).json(parsed);
  } catch (e) { fail(res, e); }
});

// 2) AI Insights Engine — wire AIInsights frontend page to real LLM.
router.post('/ai-insights', auth, async (req, res) => {
  try {
    const { module, recordSample = [], focus = 'anomalies and bottlenecks' } = req.body || {};
    if (!module) return res.status(400).json({ error: 'module required (e.g., FI, MM, SD)' });
    const sys = `You are an SAP business analyst. Analyze records from the ${module} module. PII-scrub: anonymize names/emails before reasoning. Focus: ${focus}. Output JSON: { insights, anomalies, suggestedActions }.`;
    const out = await callAI([
      { role: 'system', content: sys },
      { role: 'user', content: `Records sample: ${JSON.stringify(recordSample).slice(0, 6000)}` },
    ], { maxTokens: 1500 });
    res.json({ raw: out, module });
  } catch (e) { fail(res, e); }
});

// 3) Mobile Approvals — push-driven inbox.
const approvals = new Map();
router.get('/approvals/inbox', auth, (req, res) => {
  const userId = req.user?.id;
  const items = Array.from(approvals.values()).filter((a) => a.approverId === userId);
  res.json({ items });
});
router.post('/approvals/decide', auth, (req, res) => {
  const { id, decision, comment } = req.body || {};
  const a = approvals.get(id);
  if (!a) return res.status(404).json({ error: 'approval not found' });
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve|reject' });
  a.decision = decision;
  a.comment = comment;
  a.decidedAt = new Date().toISOString();
  res.json({ approval: a });
});
router.post('/approvals/queue', auth, (req, res) => {
  const { id, type, approverId, payload } = req.body || {};
  if (!id || !approverId || !type) return res.status(400).json({ error: 'id, type, approverId required' });
  approvals.set(id, { id, type, approverId, payload, status: 'pending', queuedAt: new Date().toISOString() });
  res.json({ queued: approvals.get(id) });
});

// 4) Process Mining Agent — reconstruct flows from change history.
router.post('/process-mining', auth, async (req, res) => {
  try {
    const { changeLog = [], processHint } = req.body || {};
    if (!changeLog.length) return res.status(400).json({ error: 'changeLog[] required' });
    const sys = 'You are a process-mining analyst. From change-history events (recordId, timestamp, oldStatus, newStatus, actor), reconstruct end-to-end process variants and surface bottleneck stages. Output JSON: { variants, bottlenecks, avgCycleHours, recommendations }.';
    const user = `Hint: ${processHint || 'unspecified'}\nEvents: ${JSON.stringify(changeLog).slice(0, 6000)}`;
    const out = await callAI([{ role: 'system', content: sys }, { role: 'user', content: user }], { maxTokens: 1800 });
    res.json({ raw: out });
  } catch (e) { fail(res, e); }
});

// 5) Natural-Language SAP Query — NLQ -> SQL/grid filter.
router.post('/nlq', auth, async (req, res) => {
  try {
    const { naturalQuery, schemaHints = [] } = req.body || {};
    if (!naturalQuery) return res.status(400).json({ error: 'naturalQuery required' });
    const sys = 'You are an SAP NLQ translator. Convert the natural query to a structured filter spec (entity, filters[], orderBy, projections). DO NOT execute. Output JSON only. Reject if query requires unrestricted writes.';
    const out = await callAI([
      { role: 'system', content: sys },
      { role: 'user', content: `Schema hints: ${JSON.stringify(schemaHints).slice(0, 1500)}\nQuery: ${naturalQuery}` },
    ], { maxTokens: 900 });
    res.json({ raw: out });
  } catch (e) { fail(res, e); }
});

// 6) Variant Configuration Assistant — pricing-conditions/partner-functions setup.
router.post('/variant-config', auth, async (req, res) => {
  try {
    const { materialNumber, characteristics = [], salesArea } = req.body || {};
    if (!materialNumber || !characteristics.length) return res.status(400).json({ error: 'materialNumber and characteristics[] required' });
    const sys = 'You are an SAP Variant Configuration assistant. Given characteristics + sales area, propose valid value combinations, pricing condition records, and partner-function defaults. Output JSON.';
    const user = `Material: ${materialNumber}\nSalesArea: ${salesArea || 'n/a'}\nCharacteristics: ${JSON.stringify(characteristics).slice(0, 4000)}`;
    const out = await callAI([{ role: 'system', content: sys }, { role: 'user', content: user }], { maxTokens: 1500 });
    res.json({ raw: out });
  } catch (e) { fail(res, e); }
});

module.exports = router;

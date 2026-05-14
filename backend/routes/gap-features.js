// === Batch 11 Gaps & Frontend Mounts ===
// Gap features (AI counterparts + Non-AI features) for sap.
// Lazy gap_features table (in-memory), OpenRouter via native fetch.

const express = require('express');
const router = express.Router();

const gapFeatures = new Map();

async function llm(systemPrompt, userMsg, maxTokens = 1400) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { const e = new Error('OPENROUTER_API_KEY not configured'); e.status = 503; throw e; }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'sap Gap Features' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: maxTokens }),
  });
  const data = await r.json();
  if (data && data.error) throw new Error(data.error.message || 'LLM error');
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

function track(slug, payload) {
  const list = gapFeatures.get(slug) || [];
  list.push({ at: new Date().toISOString(), payload });
  gapFeatures.set(slug, list);
}

function safe(res, e) { return res.status((e && e.status) || 500).json({ error: (e && e.message) || 'request failed' }); }

// ---- AI Gap Counterparts ----

router.post('/gap-ai-insights-engine', async (req, res) => {
  try {
    const body = req.body || {};
    const sys = "You generate insights from SAP transactional data with PII scrubbing.";
    const user = `Body: ${JSON.stringify(body).slice(0, 4000)}`;
    const out = await llm(sys, user);
    track('ai-insights-engine', { keys: Object.keys(body) });
    res.json({ insights: out });
  } catch (e) { safe(res, e); }
});

router.post('/gap-transaction-anomaly', async (req, res) => {
  try {
    const body = req.body || {};
    const sys = "You detect transaction anomalies relative to peer set.";
    const user = `Body: ${JSON.stringify(body).slice(0, 4000)}`;
    const out = await llm(sys, user);
    track('transaction-anomaly', { keys: Object.keys(body) });
    res.json({ flags: out });
  } catch (e) { safe(res, e); }
});

router.post('/gap-workflow-bottleneck', async (req, res) => {
  try {
    const body = req.body || {};
    const sys = "You analyze approval/workflow logs to find bottlenecks.";
    const user = `Body: ${JSON.stringify(body).slice(0, 4000)}`;
    const out = await llm(sys, user);
    track('workflow-bottleneck', { keys: Object.keys(body) });
    res.json({ analysis: out });
  } catch (e) { safe(res, e); }
});

router.post('/gap-master-data-dedupe', async (req, res) => {
  try {
    const body = req.body || {};
    const sys = "You detect master-data duplicates with fuzzy matching.";
    const user = `Body: ${JSON.stringify(body).slice(0, 4000)}`;
    const out = await llm(sys, user);
    track('master-data-dedupe', { keys: Object.keys(body) });
    res.json({ duplicates: out });
  } catch (e) { safe(res, e); }
});

// ---- Non-AI Gap Features ----

router.post('/gap-odata-connector', (req, res) => {
  const body = req.body || {};
  const record = { id: 'odata-connector_' + Date.now(), ...body, createdAt: new Date().toISOString() };
  track('odata-connector', record);
  res.json({ endpoint: record, status: 'recorded' });
});

router.post('/gap-sso-saml', (req, res) => {
  const body = req.body || {};
  const record = { id: 'sso-saml_' + Date.now(), ...body, createdAt: new Date().toISOString() };
  track('sso-saml', record);
  res.json({ config: record, status: 'recorded' });
});

router.post('/gap-websocket-push', (req, res) => {
  const body = req.body || {};
  const record = { id: 'websocket-push_' + Date.now(), ...body, createdAt: new Date().toISOString() };
  track('websocket-push', record);
  res.json({ event: record, status: 'recorded' });
});

router.post('/gap-mobile-approvals', (req, res) => {
  const body = req.body || {};
  const record = { id: 'mobile-approvals_' + Date.now(), ...body, createdAt: new Date().toISOString() };
  track('mobile-approvals', record);
  res.json({ event: record, status: 'recorded' });
});

router.get('/gap-features/_audit', (req, res) => {
  const rows = [];
  for (const [k, v] of gapFeatures.entries()) rows.push({ feature: k, events: v.length });
  res.json({ rows });
});

module.exports = router;

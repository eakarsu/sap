import React, { useState, useEffect } from 'react';
import {
  hybridSearch, recommendApprover, anomalyToTicket, voiceAction,
  aiResults, listTenantKeys, setTenantKey, fetchAnomalies,
  sapOdataProxy, sapBapiCall, sapIdocProcess, sapApprovalWorkflow,
  sapCrossCompanyConsolidation, sapPricingConditions, sapDocumentFlow,
  sapWhereUsed, sapEntityMapping, aiStudioPromptDesign,
} from '../api';
import { FiCpu, FiSearch, FiUserCheck, FiAlertTriangle, FiMic, FiKey, FiList, FiServer } from 'react-icons/fi';

const TABS = [
  { key: 'hybrid', label: 'Hybrid Search', icon: FiSearch },
  { key: 'approver', label: 'Approver Recommender', icon: FiUserCheck },
  { key: 'anomaly', label: 'Anomaly → Ticket', icon: FiAlertTriangle },
  { key: 'voice', label: 'Voice Action', icon: FiMic },
  { key: 'tenant', label: 'Tenant Keys', icon: FiKey },
  { key: 'history', label: 'AI History', icon: FiList },
  // Apply pass 5 additions:
  { key: 'sap-backlog', label: 'SAP Backlog (additive)', icon: FiServer },
];

export default function AIStudio() {
  const [tab, setTab] = useState('hybrid');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1D2D3E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiCpu /> AI Studio
        </h1>
        <span style={{ fontSize: 11, color: '#6A767D' }}>
          model: anthropic/claude-3-5-sonnet-20241022 · 20 req/hr per user
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E8EBF0', marginBottom: 16 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid #0070F2' : '2px solid transparent',
                color: active ? '#0070F2' : '#6A767D',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'hybrid' && <HybridSearchPanel />}
      {tab === 'approver' && <ApproverPanel />}
      {tab === 'anomaly' && <AnomalyPanel />}
      {tab === 'voice' && <VoicePanel />}
      {tab === 'tenant' && <TenantKeysPanel />}
      {tab === 'history' && <HistoryPanel />}
      {tab === 'sap-backlog' && <SapBacklogPanel />}
    </div>
  );
}

// =====================================================================
// Apply pass 5 — additive panel that exposes the new SAP backlog endpoints.
// All endpoints return 503 + { missing: <ENV> } when their env var is unset.
// =====================================================================
function SapBacklogPanel() {
  const [op, setOp] = useState('odata-proxy');
  const [payloadText, setPayloadText] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const OPS = [
    { key: 'odata-proxy', label: 'OData Proxy (NEEDS-CREDS: SAP_ODATA_BASE_URL)', sample: '{"entity":"BusinessPartner","query":{"$top":10}}', call: sapOdataProxy },
    { key: 'bapi-call', label: 'BAPI Call (NEEDS-CREDS: SAP_BAPI_GATEWAY_URL)', sample: '{"bapiName":"BAPI_PO_CREATE1","parameters":{}}', call: sapBapiCall },
    { key: 'idoc-process', label: 'IDoc Process (NEEDS-CREDS: SAP_IDOC_DROP_DIR)', sample: '{"idocPayload":"E2EDP01..."}', call: sapIdocProcess },
    { key: 'approval-workflow', label: 'Approval Workflow', sample: '{"entity_type":"purchase_order","entity_id":"123","action":"create"}', call: sapApprovalWorkflow },
    { key: 'cross-company', label: 'Cross-Company Consolidation', sample: '{"table":"orders","metric":"total"}', call: sapCrossCompanyConsolidation },
    { key: 'pricing-conditions', label: 'Pricing Conditions', sample: '{"condition_type":"discount","expression":"qty > 100 => 5%","priority":1}', call: sapPricingConditions },
    { key: 'document-flow', label: 'Document Flow', sample: '{"document_type":"sales_order","document_id":"4711"}', call: sapDocumentFlow },
    { key: 'where-used', label: 'Where-Used', sample: '{"entity_type":"material","entity_id":"M-001"}', call: sapWhereUsed },
    { key: 'entity-mapping', label: 'Entity Mapping', sample: '{"app_tables":["customers","orders"]}', call: sapEntityMapping },
    { key: 'studio-prompt-design', label: 'AI Studio Prompt Design', sample: '{"goal":"summarize PO","constraints":"json only"}', call: aiStudioPromptDesign },
  ];

  const cur = OPS.find(o => o.key === op);

  const switchOp = (key) => {
    setOp(key);
    const o = OPS.find(x => x.key === key);
    setPayloadText(o.sample);
    setResult(null); setError('');
  };

  const run = async () => {
    setError(''); setResult(null);
    let body;
    try { body = JSON.parse(payloadText); }
    catch (e) { setError('Invalid JSON: ' + e.message); return; }
    setLoading(true);
    try {
      const res = await cur.call(body);
      setResult(res);
    } catch (e) {
      const msg = e?.message || 'Failed';
      const missing = e?.body?.missing;
      setError(missing ? `${msg} (set env var ${missing})` : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        Apply pass 5 — additive backlog endpoints for SAP connectors / workflow / consolidation / pricing / document-flow / where-used / entity-mapping / AI Studio prompt design. Each NEEDS-CREDS endpoint returns 503 with a `missing` env-var name when not configured.
      </p>
      <div style={{ marginBottom: 12 }}>
        <select value={op} onChange={(e) => switchOp(e.target.value)} style={{ ...input, maxWidth: 480 }}>
          {OPS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <textarea
        style={{ ...input, height: 120, fontFamily: 'monospace' }}
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
      />
      <div style={{ marginTop: 12 }}>
        <button style={btn} onClick={run} disabled={loading}>{loading ? 'Running…' : 'Send'}</button>
      </div>
      {error && <pre style={{ color: '#B00020', whiteSpace: 'pre-wrap', marginTop: 12 }}>{error}</pre>}
      {result && (
        <pre style={{ background: '#F8F9FA', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #E8EBF0', borderRadius: 8, padding: 16 };
const input = { width: '100%', padding: '8px 10px', border: '1px solid #D5DADF', borderRadius: 6, fontSize: 13 };
const btn = { padding: '8px 16px', background: '#0070F2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 };

function HybridSearchPanel() {
  const [query, setQuery] = useState('');
  const [alpha, setAlpha] = useState(0.6);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const run = async () => {
    if (!query) return;
    setLoading(true);
    const r = await hybridSearch(query, null, 10, alpha);
    setData(r);
    setLoading(false);
  };

  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        Hybrid retrieval — BM25 full-text + pgvector cosine, blended by alpha.
      </p>
      <input style={input} placeholder="Search query…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
        <label style={{ fontSize: 12, color: '#6A767D' }}>α (vector weight): {alpha.toFixed(2)}</label>
        <input type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
        <button style={btn} onClick={run} disabled={loading || !query}>{loading ? 'Searching…' : 'Search'}</button>
      </div>
      {data?.results && (
        <div>
          <p style={{ fontSize: 12, color: '#6A767D' }}>
            {data.results.length} results · vector hits {data.vectorHits} · BM25 hits {data.bm25Hits}
          </p>
          {data.results.map((r, i) => (
            <div key={i} style={{ borderTop: '1px solid #f0f2f5', padding: '10px 0', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>
                {r.source_type} · {r.source_id} · score {Number(r.hybrid).toFixed(3)}
              </div>
              <div style={{ color: '#6A767D', whiteSpace: 'pre-wrap' }}>{(r.content_chunk || '').slice(0, 280)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApproverPanel() {
  const [mod, setMod] = useState('purchase_orders');
  const [recordId, setRecordId] = useState('');
  const [amount, setAmount] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const run = async () => {
    setLoading(true);
    const r = await recommendApprover({ module: mod, recordId, amount: Number(amount) || undefined, region: region || undefined });
    setData(r);
    setLoading(false);
  };
  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        Recommend the next approver(s) for a transaction based on history.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input style={input} placeholder="module" value={mod} onChange={(e) => setMod(e.target.value)} />
        <input style={input} placeholder="record id" value={recordId} onChange={(e) => setRecordId(e.target.value)} />
        <input style={input} placeholder="amount (optional)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input style={input} placeholder="region (optional)" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>
      <button style={btn} onClick={run} disabled={loading || !recordId}>{loading ? 'Thinking…' : 'Recommend'}</button>
      {data && (
        <pre style={{ background: '#FAFBFC', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AnomalyPanel() {
  const [anomalies, setAnomalies] = useState([]);
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnomalies().then((r) => setAnomalies(r?.anomalies || r || []));
  }, []);

  const create = async () => {
    setLoading(true);
    const r = await anomalyToTicket(anomalies);
    setTickets(r);
    setLoading(false);
  };
  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        One-click — convert dashboard anomalies into routed tickets with linked evidence.
      </p>
      <p style={{ fontSize: 12 }}>Detected anomalies: <strong>{anomalies.length}</strong></p>
      <button style={btn} onClick={create} disabled={loading || anomalies.length === 0}>
        {loading ? 'Creating…' : `Create ${anomalies.length} Tickets`}
      </button>
      {tickets && (
        <pre style={{ background: '#FAFBFC', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(tickets, null, 2)}
        </pre>
      )}
    </div>
  );
}

function VoicePanel() {
  const [transcript, setTranscript] = useState('');
  const [mod, setMod] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [recording, setRecording] = useState(false);
  const recRef = React.useRef(null);

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Browser SpeechRecognition not supported. Type the transcript manually.');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('');
      setTranscript(text);
    };
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };
  const stopMic = () => { recRef.current?.stop(); setRecording(false); };

  const run = async () => {
    setLoading(true);
    const r = await voiceAction(transcript, mod || undefined);
    setPlan(r?.plan);
    setLoading(false);
  };

  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        Voice-driven SAP — transcribe a spoken command (browser STT), then translate it to a tool plan over the 77-module CRUD.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button style={{ ...btn, background: recording ? '#dc2626' : '#0070F2' }} onClick={recording ? stopMic : startMic}>
          <FiMic /> {recording ? 'Stop' : 'Record'}
        </button>
        <input style={input} placeholder="current module (optional)" value={mod} onChange={(e) => setMod(e.target.value)} />
      </div>
      <textarea style={{ ...input, height: 80 }} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcript…" />
      <div style={{ marginTop: 10 }}>
        <button style={btn} onClick={run} disabled={loading || !transcript}>{loading ? 'Translating…' : 'Translate to Action'}</button>
      </div>
      {plan && (
        <pre style={{ background: '#FAFBFC', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(plan, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TenantKeysPanel() {
  const [tenantId, setTenantId] = useState('');
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [list, setList] = useState([]);

  const refresh = async () => {
    const r = await listTenantKeys();
    setList(r?.data || []);
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!tenantId || !key) return;
    await setTenantKey(tenantId, key, model);
    setTenantId(''); setKey(''); setModel('');
    refresh();
  };

  return (
    <div style={card}>
      <p style={{ color: '#6A767D', fontSize: 13, marginTop: 0 }}>
        Per-tenant OpenRouter API key store (admin-only). Production should use KMS / Vault.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 10, marginBottom: 12 }}>
        <input style={input} placeholder="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <input style={input} placeholder="OpenRouter key" value={key} onChange={(e) => setKey(e.target.value)} />
        <input style={input} placeholder="model (optional)" value={model} onChange={(e) => setModel(e.target.value)} />
        <button style={btn} onClick={save}>Save</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#FAFBFC' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Tenant</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Model</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.tenant_id} style={{ borderTop: '1px solid #f0f2f5' }}>
              <td style={{ padding: 8 }}>{r.tenant_id}</td>
              <td style={{ padding: 8 }}>{r.model || '—'}</td>
              <td style={{ padding: 8 }}>{new Date(r.updated_at).toLocaleString()}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={3} style={{ padding: 12, color: '#6A767D' }}>No tenant keys configured.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function HistoryPanel() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1 });
  const [feature, setFeature] = useState('');

  useEffect(() => {
    aiResults({ page, pageSize: 20, feature: feature || undefined }).then((r) => {
      setItems(r?.data || []);
      setPagination(r?.pagination || { totalPages: 1 });
    });
  }, [page, feature]);

  return (
    <div style={card}>
      <div style={{ marginBottom: 10 }}>
        <select value={feature} onChange={(e) => { setFeature(e.target.value); setPage(1); }} style={{ ...input, width: 'auto' }}>
          <option value="">All features</option>
          <option value="hybrid-search">hybrid-search</option>
          <option value="recommend-approver">recommend-approver</option>
          <option value="anomaly-to-ticket">anomaly-to-ticket</option>
          <option value="voice-action">voice-action</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#FAFBFC' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>When</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Feature</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Duration (ms)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f0f2f5' }}>
              <td style={{ padding: 8 }}>{new Date(r.created_at).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{r.feature}</td>
              <td style={{ padding: 8 }}>{r.status}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{r.duration_ms ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={btn}>Prev</button>
        <span style={{ fontSize: 12 }}>page {page} / {pagination.totalPages}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} style={btn}>Next</button>
      </div>
    </div>
  );
}

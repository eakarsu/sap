// Custom Views — 4 endpoints for SAP-integration platform / ERP automation.
// 1) /system-status      — health per SAP module (FI/CO/MM/SD/HR/PP)
// 2) /transaction-volume — multi-line: tx count per module per hour over last 24h
// 3) /idoc/:id           — IDoc inspector (segments, ack status, XML download)
// 4) /batch-jobs         — schedule SAP batch jobs (program/variant/cron/output)

const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const SAP_MODULES = [
  { code: 'FI', name: 'Financial Accounting', color: '#0070F2' },
  { code: 'CO', name: 'Controlling', color: '#A100FF' },
  { code: 'MM', name: 'Materials Mgmt', color: '#0F9D58' },
  { code: 'SD', name: 'Sales & Distribution', color: '#FF8C00' },
  { code: 'HR', name: 'Human Resources', color: '#DB4437' },
  { code: 'PP', name: 'Production Planning', color: '#00B8D9' },
];

// In-memory store for scheduled batch jobs (demo)
const scheduledJobs = [];

// Seeded synthetic IDoc store
const IDOCS = [
  {
    id: 'IDOC-0000100001',
    type: 'ORDERS05',
    direction: 'inbound',
    partner: 'WALMART_US',
    status: '53',
    statusText: 'Application document posted',
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    segments: [
      { name: 'E1EDK01', desc: 'Document Header', fields: { CURCY: 'USD', HWAER: 'USD', WKURS: '1.0', BELNR: '4500001234' } },
      { name: 'E1EDKA1', desc: 'Partner Information', fields: { PARVW: 'AG', PARTN: '0000100210', LIFNR: 'WALMART_US' } },
      { name: 'E1EDP01', desc: 'Item Data', fields: { POSEX: '00010', MENGE: '500', MENEE: 'EA', NETWR: '12500.00' } },
      { name: 'E1EDS01', desc: 'Totals', fields: { SUMID: '010', SUMME: '12500.00', WAERQ: 'USD' } },
    ],
  },
  {
    id: 'IDOC-0000100002',
    type: 'INVOIC02',
    direction: 'outbound',
    partner: 'TARGET_CORP',
    status: '03',
    statusText: 'Data passed to port OK',
    timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
    segments: [
      { name: 'E1EDK01', desc: 'Document Header', fields: { CURCY: 'USD', BELNR: '9000004567', BSART: 'INVO' } },
      { name: 'E1EDP01', desc: 'Item Data', fields: { POSEX: '00010', MENGE: '120', MENEE: 'EA', NETWR: '4800.00' } },
      { name: 'E1EDS01', desc: 'Totals', fields: { SUMID: '010', SUMME: '4800.00', WAERQ: 'USD' } },
    ],
  },
  {
    id: 'IDOC-0000100003',
    type: 'MATMAS05',
    direction: 'inbound',
    partner: 'SAP_ECC_PRD',
    status: '51',
    statusText: 'Application document not posted',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    segments: [
      { name: 'E1MARAM', desc: 'Material Master General Data', fields: { MATNR: 'MAT-001928', MTART: 'FERT', MEINS: 'EA' } },
      { name: 'E1MAKTM', desc: 'Material Description', fields: { SPRAS: 'E', MAKTX: 'Industrial Hydraulic Pump Assembly' } },
      { name: 'E1MARCM', desc: 'Plant Data', fields: { WERKS: '1000', BESKZ: 'F', DISMM: 'PD' } },
    ],
  },
  {
    id: 'IDOC-0000100004',
    type: 'DELVRY07',
    direction: 'outbound',
    partner: 'COSTCO_WHS',
    status: '12',
    statusText: 'Dispatch OK',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    segments: [
      { name: 'E1EDL20', desc: 'Delivery Header', fields: { VBELN: '0080001122', LFART: 'LF', VSTEL: '1000' } },
      { name: 'E1EDL24', desc: 'Delivery Item', fields: { POSNR: '000010', MATNR: 'MAT-001928', LFIMG: '50', VRKME: 'EA' } },
    ],
  },
];

// ---------- 1) SYSTEM STATUS ----------
router.get('/system-status', auth, (req, res) => {
  const now = Date.now();
  const minuteSeed = Math.floor(now / 60000);
  const modules = SAP_MODULES.map((m, i) => {
    const seed = (minuteSeed + i * 17) % 100;
    let health, status;
    if (seed < 70) { health = 'healthy'; status = 'OK'; }
    else if (seed < 90) { health = 'warning'; status = 'Degraded'; }
    else { health = 'critical'; status = 'Down'; }
    return {
      code: m.code,
      name: m.name,
      color: m.color,
      health,
      status,
      uptime: (99.0 + (seed % 10) / 10).toFixed(2) + '%',
      activeUsers: 50 + ((seed * 7) % 250),
      latencyMs: 80 + ((seed * 13) % 400),
      lastCheck: new Date(now).toISOString(),
    };
  });
  res.json({ modules, generatedAt: new Date(now).toISOString() });
});

// ---------- 2) TRANSACTION VOLUME (24h, per module per hour) ----------
router.get('/transaction-volume', auth, (req, res) => {
  const now = new Date();
  const buckets = [];
  for (let h = 23; h >= 0; h--) {
    const d = new Date(now.getTime() - h * 60 * 60 * 1000);
    const label = `${String(d.getHours()).padStart(2, '0')}:00`;
    const entry = { hour: label, ts: d.toISOString() };
    SAP_MODULES.forEach((m, i) => {
      const hr = d.getHours();
      const dayCurve = 0.3 + 0.7 * Math.max(0, Math.sin(((hr - 6) / 12) * Math.PI));
      const base = [1800, 900, 1400, 2200, 600, 1100][i];
      const noise = ((Math.floor(now.getTime() / 3600000) + h * 31 + i * 13) % 200) - 100;
      entry[m.code] = Math.max(0, Math.round(base * dayCurve + noise));
    });
    buckets.push(entry);
  }
  res.json({
    series: buckets,
    modules: SAP_MODULES.map(m => ({ code: m.code, color: m.color })),
  });
});

// ---------- 3) IDOC INSPECTOR ----------
router.get('/idoc', auth, (req, res) => {
  res.json({
    idocs: IDOCS.map(d => ({
      id: d.id, type: d.type, direction: d.direction,
      partner: d.partner, status: d.status, statusText: d.statusText,
      timestamp: d.timestamp,
    })),
  });
});

router.get('/idoc/:id', auth, (req, res) => {
  const doc = IDOCS.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'IDoc not found' });
  const ack = {
    code: doc.status,
    text: doc.statusText,
    posted: doc.status === '53' || doc.status === '03' || doc.status === '12',
    receivedAt: doc.timestamp,
  };
  res.json({ idoc: doc, acknowledgement: ack });
});

router.get('/idoc/:id/xml', auth, (req, res) => {
  const doc = IDOCS.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'IDoc not found' });
  const segXml = doc.segments
    .map(s => {
      const fields = Object.entries(s.fields)
        .map(([k, v]) => `      <${k}>${String(v).replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</${k}>`)
        .join('\n');
      return `    <${s.name}>\n${fields}\n    </${s.name}>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${doc.type}>
  <IDOC BEGIN="1">
    <EDI_DC40 SEGMENT="1">
      <TABNAM>EDI_DC40</TABNAM>
      <MANDT>100</MANDT>
      <DOCNUM>${doc.id}</DOCNUM>
      <STATUS>${doc.status}</STATUS>
      <DIRECT>${doc.direction === 'inbound' ? '2' : '1'}</DIRECT>
      <IDOCTYP>${doc.type}</IDOCTYP>
      <RCVPRN>${doc.partner}</RCVPRN>
      <CREDAT>${doc.timestamp.slice(0, 10)}</CREDAT>
    </EDI_DC40>
${segXml}
  </IDOC>
</${doc.type}>`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.id}.xml"`);
  res.send(xml);
});

// ---------- 4) BATCH JOB SCHEDULER ----------
router.get('/batch-jobs', auth, (req, res) => {
  res.json({ jobs: scheduledJobs });
});

router.post('/batch-jobs', auth, (req, res) => {
  const { program, variant, cron, outputTarget, description } = req.body || {};
  if (!program || !cron) {
    return res.status(400).json({ error: 'program and cron are required' });
  }
  const job = {
    id: `BJ-${Date.now()}`,
    program,
    variant: variant || 'DEFAULT',
    cron,
    outputTarget: outputTarget || 'SPOOL',
    description: description || '',
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email || 'system',
    nextRun: estimateNext(cron),
  };
  scheduledJobs.unshift(job);
  res.status(201).json({ job });
});

router.delete('/batch-jobs/:id', auth, (req, res) => {
  const idx = scheduledJobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'job not found' });
  const [removed] = scheduledJobs.splice(idx, 1);
  res.json({ deleted: removed });
});

function estimateNext(cron) {
  const now = new Date();
  if (/^0 \* \* \* \*/.test(cron)) return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (/^0 \d+ \* \* \*/.test(cron)) return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return new Date(now.getTime() + 5 * 60 * 1000).toISOString();
}

module.exports = router;

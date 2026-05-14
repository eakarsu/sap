const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const auth = require('./middleware/auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: '../.env' });

// Fail fast if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.BACKEND_PORT || 4002;

// Security headers (helmet) — disable CSP since this is an API serving JSON.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS — origins from env (comma-separated) or wildcard for dev.
const corsOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// File upload config
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============ DATABASE INIT (pgvector + RAG tables) ============
async function initDB() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        source_type VARCHAR(50) NOT NULL,
        source_id VARCHAR(100),
        content_chunk TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255),
        content TEXT,
        doc_type VARCHAR(50),
        category VARCHAR(100),
        uploaded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Generic AI invocation log (JSONB input/output) — used by all AI features
    // for audit, history UI, and offline analysis.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        feature VARCHAR(100) NOT NULL,
        user_id INTEGER,
        object_type VARCHAR(100),
        object_id VARCHAR(100),
        input JSONB DEFAULT '{}',
        output JSONB DEFAULT '{}',
        model VARCHAR(200),
        tokens_used INTEGER,
        duration_ms INTEGER,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    try { await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_feature_created ON ai_results (feature, created_at DESC)`); } catch {}
    try { await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_user_created ON ai_results (user_id, created_at DESC)`); } catch {}
    // Add full-text search index on documents.content for hybrid (BM25 + vector) search.
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_content_tsv ON documents USING GIN (to_tsvector('english', coalesce(content,'')))`);
    } catch {}
    // Create index if not exists
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_embeddings_embedding ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)');
    } catch (e) {
      // ivfflat index requires at least some rows; create basic index instead
      try {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings (source_type, source_id)');
      } catch (e2) { /* index may already exist */ }
    }
    console.log('DB initialized: pgvector and RAG tables ready');

    // Auto-sync: embed existing documents and KB articles that aren't embedded yet
    syncEmbeddings();
  } catch (err) {
    console.log('DB init note:', err.message);
  }
}

async function syncEmbeddings() {
  try {
    let totalSynced = 0;

    // 1. Documents
    const docs = await pool.query(`
      SELECT d.id, d.title, d.content, d.category FROM documents d
      WHERE d.content IS NOT NULL AND d.id::text NOT IN (
        SELECT DISTINCT source_id FROM embeddings WHERE source_type = 'document'
      )
    `);
    if (docs.rows.length > 0) {
      console.log(`RAG sync: ${docs.rows.length} documents...`);
      for (const doc of docs.rows) {
        try {
          await embedAndStore('document', String(doc.id), doc.content, { title: doc.title, category: doc.category });
          totalSynced++;
        } catch (e) { console.log(`  Skip doc ${doc.id}: ${e.message}`); }
      }
    }

    // 2. KB articles
    const articles = await pool.query(`
      SELECT kb.id, kb.title, kb.content, kb.category FROM knowledge_base kb
      WHERE (kb.status = 'Published' OR kb.status IS NULL)
        AND kb.id::text NOT IN (
          SELECT DISTINCT source_id FROM embeddings WHERE source_type = 'knowledge_base'
        )
    `);
    if (articles.rows.length > 0) {
      console.log(`RAG sync: ${articles.rows.length} KB articles...`);
      for (const article of articles.rows) {
        try {
          const text = `${article.title}\n\n${article.content || ''}`;
          await embedAndStore('knowledge_base', String(article.id), text, { title: article.title, category: article.category });
          totalSynced++;
        } catch (e) { console.log(`  Skip KB ${article.id}: ${e.message}`); }
      }
    }

    // 3. All business modules — embed unembedded records
    const ragModules = [
      { table: 'accounts', textFn: r => `Account: ${r.name}. Industry: ${r.industry || 'N/A'}. City: ${r.city || 'N/A'}. Country: ${r.country || 'N/A'}. Revenue: ${r.annual_revenue || 'N/A'}. Employees: ${r.employee_count || 'N/A'}. Status: ${r.status || 'N/A'}.` },
      { table: 'contacts', textFn: r => `Contact: ${r.first_name} ${r.last_name}. Email: ${r.email || 'N/A'}. Title: ${r.job_title || 'N/A'}. Company: ${r.company || 'N/A'}. Phone: ${r.phone || 'N/A'}.` },
      { table: 'leads', textFn: r => `Lead: ${r.first_name} ${r.last_name}. Company: ${r.company || 'N/A'}. Source: ${r.source || 'N/A'}. Status: ${r.status || 'N/A'}. Rating: ${r.rating || 'N/A'}. Estimated Value: ${r.estimated_value || 'N/A'}.` },
      { table: 'opportunities', textFn: r => `Opportunity: ${r.name}. Account: ${r.account_name || 'N/A'}. Amount: $${r.amount || 0}. Phase: ${r.phase || 'N/A'}. Probability: ${r.probability || 0}%. Status: ${r.status || 'N/A'}. Close Date: ${r.close_date || 'N/A'}.` },
      { table: 'tickets', textFn: r => `Ticket: ${r.title}. Account: ${r.account_name || 'N/A'}. Priority: ${r.priority || 'N/A'}. Status: ${r.status || 'N/A'}. Category: ${r.category || 'N/A'}. Description: ${(r.description || '').substring(0, 500)}.` },
      { table: 'products', textFn: r => `Product: ${r.name}. Category: ${r.category || 'N/A'}. Price: $${r.price || 0}. Status: ${r.status || 'N/A'}. Description: ${(r.description || '').substring(0, 300)}.` },
      { table: 'contracts', textFn: r => `Contract: ${r.name || r.contract_number || 'N/A'}. Account: ${r.account_name || 'N/A'}. Value: $${r.value || 0}. Status: ${r.status || 'N/A'}. Start: ${r.start_date || 'N/A'}. End: ${r.end_date || 'N/A'}.` },
      { table: 'orders', textFn: r => `Order: ${r.order_number || 'N/A'}. Account: ${r.account_name || 'N/A'}. Total: $${r.total || 0}. Status: ${r.status || 'N/A'}. Date: ${r.order_date || 'N/A'}.` },
      { table: 'invoices', textFn: r => `Invoice: ${r.invoice_number || 'N/A'}. Account: ${r.account_name || 'N/A'}. Total: $${r.total || 0}. Status: ${r.status || 'N/A'}. Due: ${r.due_date || 'N/A'}.` },
      { table: 'campaigns', textFn: r => `Campaign: ${r.name}. Type: ${r.type || 'N/A'}. Status: ${r.status || 'N/A'}. Budget: $${r.budget || 0}. Start: ${r.start_date || 'N/A'}. End: ${r.end_date || 'N/A'}.` },
      { table: 'projects', textFn: r => `Project: ${r.name}. Account: ${r.account_name || 'N/A'}. Status: ${r.status || 'N/A'}. Progress: ${r.progress || 0}%. Budget: $${r.budget || 0}. Actual Cost: $${r.actual_cost || 0}.` },
      { table: 'employees', textFn: r => `Employee: ${r.first_name} ${r.last_name}. Department: ${r.department || 'N/A'}. Position: ${r.position || 'N/A'}. Email: ${r.email || 'N/A'}. Status: ${r.status || 'N/A'}.` },
      { table: 'vendors', textFn: r => `Vendor: ${r.name}. Category: ${r.category || 'N/A'}. Status: ${r.status || 'N/A'}. Rating: ${r.rating || 'N/A'}. Contact: ${r.email || 'N/A'}.` },
      { table: 'competitors', textFn: r => `Competitor: ${r.name}. Industry: ${r.industry || 'N/A'}. Market Share: ${r.market_share || 'N/A'}%. Threat Level: ${r.threat_level || 'N/A'}. Strengths: ${(r.strengths || '').substring(0, 300)}. Weaknesses: ${(r.weaknesses || '').substring(0, 300)}.` },
      { table: 'quotes', textFn: r => `Quote: ${r.quote_number || r.name || 'N/A'}. Account: ${r.account_name || 'N/A'}. Total: $${r.total || 0}. Status: ${r.status || 'N/A'}. Valid Until: ${r.valid_until || 'N/A'}.` },
      { table: 'purchase_orders', textFn: r => `Purchase Order: ${r.po_number || 'N/A'}. Vendor: ${r.vendor_name || 'N/A'}. Total: $${r.total || 0}. Status: ${r.status || 'N/A'}.` },
      { table: 'work_orders', textFn: r => `Work Order: ${r.title || r.work_order_number || 'N/A'}. Status: ${r.status || 'N/A'}. Priority: ${r.priority || 'N/A'}. Description: ${(r.description || '').substring(0, 300)}.` },
    ];

    for (const mod of ragModules) {
      try {
        const records = await pool.query(`
          SELECT * FROM ${mod.table}
          WHERE id::text NOT IN (
            SELECT DISTINCT source_id FROM embeddings WHERE source_type = '${mod.table}'
          )
        `);
        if (records.rows.length > 0) {
          console.log(`RAG sync: ${records.rows.length} ${mod.table}...`);
          for (const row of records.rows) {
            try {
              const text = mod.textFn(row);
              await embedAndStore(mod.table, String(row.id), text, { module: mod.table });
              totalSynced++;
            } catch (e) { /* skip individual record errors */ }
          }
        }
      } catch (e) { /* table may not exist yet, skip */ }
    }

    if (totalSynced > 0) {
      console.log(`RAG sync complete: ${totalSynced} records embedded.`);
    } else {
      console.log('RAG sync: everything already indexed.');
    }
  } catch (err) {
    console.log('RAG sync skipped:', err.message);
  }
}

initDB();

// ============ EMBEDDING ENGINE ============
let embedderInstance = null;
async function getEmbedder() {
  if (embedderInstance) return embedderInstance;
  const { pipeline } = await import('@xenova/transformers');
  embedderInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return embedderInstance;
}

async function getEmbedding(text) {
  const embedder = await getEmbedder();
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

function chunkText(text, chunkSize = 512, overlap = 64) {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk.trim());
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

async function embedAndStore(sourceType, sourceId, content, metadata = {}) {
  const chunks = chunkText(content);
  let stored = 0;
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    const vecStr = '[' + embedding.join(',') + ']';
    await pool.query(
      'INSERT INTO embeddings (source_type, source_id, content_chunk, embedding, metadata) VALUES ($1, $2, $3, $4::vector, $5)',
      [sourceType, sourceId, chunk, vecStr, JSON.stringify(metadata)]
    );
    stored++;
  }
  return stored;
}

async function searchSimilar(queryText, sourceType = null, limit = 5) {
  const embedding = await getEmbedding(queryText);
  const vecStr = '[' + embedding.join(',') + ']';
  let query = 'SELECT id, source_type, source_id, content_chunk, metadata, 1 - (embedding <=> $1::vector) as similarity FROM embeddings';
  const params = [vecStr];
  if (sourceType) {
    query += ' WHERE source_type = $2';
    params.push(sourceType);
  }
  query += ' ORDER BY embedding <=> $1::vector LIMIT $' + (params.length + 1);
  params.push(limit);
  const result = await pool.query(query, params);
  return result.rows;
}

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============ GENERIC CRUD ROUTES ============
const moduleNames = [
  // SD - Sales
  'accounts', 'contacts', 'leads', 'opportunities', 'quotes', 'orders', 'contracts',
  'territories', 'competitors', 'forecasts', 'deliveries', 'shipments', 'billing_documents', 'returns',
  // CS - Service
  'tickets', 'knowledge_base', 'work_orders', 'sla_policies',
  // Marketing
  'campaigns', 'email_templates', 'customer_segments',
  // Products
  'products', 'price_lists', 'material_master',
  // FI - Financial Accounting
  'invoices', 'payments', 'expense_reports', 'general_ledger', 'accounts_payable',
  'accounts_receivable', 'asset_accounting', 'bank_accounting',
  // CO - Controlling
  'cost_centers', 'profit_centers', 'internal_orders', 'profitability_analysis',
  // MM - Materials Management
  'purchase_orders', 'purchase_requisitions', 'goods_receipts', 'inventory', 'vendors',
  // PP - Production
  'bill_of_materials', 'production_orders', 'mrp_runs', 'work_centers', 'routings',
  // PM - Plant Maintenance
  'equipment', 'maintenance_orders', 'maintenance_plans', 'functional_locations',
  // QM - Quality
  'inspection_lots', 'quality_notifications', 'quality_plans',
  // WM - Warehouse
  'storage_bins', 'warehouse_orders', 'stock_transfers',
  // Ariba
  'sourcing_events', 'procurement_contracts',
  // HCM
  'employees', 'departments', 'performance_reviews', 'leave_requests', 'training_courses',
  'recruiting', 'onboarding', 'compensation', 'succession_planning',
  // Concur
  'travel_requests', 'travel_bookings',
  // IBP
  'demand_plans', 'supply_plans',
  // Operations
  'projects', 'tasks', 'activities', 'goals',
  // System
  'audit_logs', 'notifications',
];

// Cache valid columns per table for safe sorting and filtering
const validColumnsCache = {};
async function getValidColumns(table) {
  if (validColumnsCache[table]) return validColumnsCache[table];
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
  );
  validColumnsCache[table] = result.rows.map(r => r.column_name);
  return validColumnsCache[table];
}

moduleNames.forEach((table) => {
  // GET all
  app.get(`/api/${table}`, auth, async (req, res) => {
    try {
      const { search, sort, order, limit, offset } = req.query;
      let query = `SELECT * FROM ${table}`;
      const params = [];

      if (search) {
        const colResult = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND data_type IN ('character varying', 'text')`,
          [table]
        );
        const textCols = colResult.rows.map(r => r.column_name);
        if (textCols.length > 0) {
          const searchConditions = textCols.map((col, i) => `${col} ILIKE $${i + 1}`).join(' OR ');
          params.push(...textCols.map(() => `%${search}%`));
          query += ` WHERE (${searchConditions})`;
        }
      }

      const validCols = await getValidColumns(table);
      const safeSort = (sort && validCols.includes(sort)) ? sort : 'id';
      const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${safeSort} ${safeOrder}`;
      if (limit) query += ` LIMIT ${parseInt(limit) || 50}`;
      if (offset) query += ` OFFSET ${parseInt(offset) || 0}`;

      const data = await pool.query(query, params);
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      res.json({ data: data.rows, total: parseInt(countResult.rows[0].count) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET by id
  app.get(`/api/${table}/:id`, auth, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create
  app.post(`/api/${table}`, auth, async (req, res) => {
    try {
      const validCols = await getValidColumns(table);
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && validCols.includes(k));
      const values = keys.map(k => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const result = await pool.query(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update (with change history tracking)
  app.put(`/api/${table}/:id`, auth, async (req, res) => {
    try {
      // Fetch old record for change tracking
      const oldResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      const oldRecord = oldResult.rows[0];

      const validCols = await getValidColumns(table);
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && validCols.includes(k));
      const values = keys.map(k => req.body[k]);
      let setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      if (validCols.includes('updated_at')) {
        setClause += ', updated_at = NOW()';
      }
      values.push(req.params.id);
      const result = await pool.query(
        `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      // Track field-level changes in audit_logs
      if (oldRecord) {
        try {
          const changes = [];
          for (const key of keys) {
            const oldVal = oldRecord[key];
            const newVal = req.body[key];
            if (String(oldVal || '') !== String(newVal || '')) {
              changes.push({ field: key, old_value: String(oldVal || ''), new_value: String(newVal || '') });
            }
          }
          if (changes.length > 0) {
            const old_values = {};
            for (const ch of changes) old_values[ch.field] = ch.old_value;
            await pool.query(
              `INSERT INTO audit_logs (entity_type, entity_id, action, changes, changed_by, old_values, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [table, req.params.id, 'update', JSON.stringify(changes), req.user?.email || 'system', JSON.stringify(old_values)]
            );
          }
        } catch (auditErr) { /* audit logging is best-effort */ }
      }

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete(`/api/${table}/:id`, auth, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', auth, async (req, res) => {
  try {
    const [leads, opportunities, tickets, invoices, projects, employees] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM leads WHERE status NOT IN ('Disqualified','Converted')"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM opportunities WHERE status = 'Open'"),
      pool.query("SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Resolved', 'Closed')"),
      pool.query("SELECT COALESCE(SUM(total), 0) as revenue FROM invoices WHERE status = 'Paid'"),
      pool.query("SELECT COUNT(*) FROM projects WHERE status = 'In Progress'"),
      pool.query("SELECT COUNT(*) FROM employees WHERE status = 'Active'"),
    ]);

    const recentActivities = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10');
    const pipelinePhases = await pool.query("SELECT phase, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM opportunities WHERE status = 'Open' GROUP BY phase ORDER BY count DESC");
    const topDeals = await pool.query("SELECT * FROM opportunities WHERE status = 'Open' ORDER BY amount DESC LIMIT 5");

    // Module counts
    const moduleCounts = {};
    for (const table of moduleNames) {
      try {
        const r = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        moduleCounts[table] = parseInt(r.rows[0].count);
      } catch { moduleCounts[table] = 0; }
    }

    res.json({
      pipeline_value: parseFloat(opportunities.rows[0].total),
      total_revenue: parseFloat(invoices.rows[0].revenue),
      active_leads: parseInt(leads.rows[0].count),
      open_tickets: parseInt(tickets.rows[0].count),
      active_projects: parseInt(projects.rows[0].count),
      total_employees: parseInt(employees.rows[0].count),
      recent_activities: recentActivities.rows,
      pipeline_by_phase: pipelinePhases.rows,
      top_deals: topDeals.rows,
      module_counts: moduleCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GLOBAL SEARCH ============
app.get('/api/search/global', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ results: [] });
    const searchTerm = `%${q.trim()}%`;
    const results = [];
    const searchables = [
      { table: 'accounts', cols: ['name', 'industry', 'city'], label: 'name' },
      { table: 'contacts', cols: ['first_name', 'last_name', 'email', 'company'], label: 'first_name' },
      { table: 'leads', cols: ['first_name', 'last_name', 'email', 'company'], label: 'first_name' },
      { table: 'opportunities', cols: ['name', 'account_name'], label: 'name' },
      { table: 'tickets', cols: ['title', 'ticket_number', 'account_name'], label: 'title' },
      { table: 'products', cols: ['name', 'material_number'], label: 'name' },
      { table: 'projects', cols: ['name', 'account_name'], label: 'name' },
      { table: 'employees', cols: ['first_name', 'last_name', 'email'], label: 'first_name' },
    ];
    for (const s of searchables) {
      const where = s.cols.map((c, i) => `${c} ILIKE $${i + 1}`).join(' OR ');
      const params = s.cols.map(() => searchTerm);
      const r = await pool.query(`SELECT id, ${s.cols.join(', ')} FROM ${s.table} WHERE ${where} LIMIT 5`, params);
      r.rows.forEach(row => results.push({ module: s.table, id: row.id, label: row[s.label] || row.name || row.title, ...row }));
    }
    res.json({ results: results.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ USER MANAGEMENT ============
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', auth, async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at',
      [email, hash, full_name, role || 'user']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const { full_name, role, email } = req.body;
    const result = await pool.query(
      'UPDATE users SET full_name = $1, role = $2, email = $3 WHERE id = $4 RETURNING id, email, full_name, role, created_at',
      [full_name, role, email, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', auth, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ AI ROUTES (OpenRouter) ============
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// AI rate limiter: 20 requests per hour, keyed by authenticated user (fallback to IP).
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Limit is 20 per hour per user. Please try again later.' },
  keyGenerator: (req) => {
    // Decode JWT lazily without auth middleware overhead — best-effort.
    try {
      const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (tok) {
        const decoded = jwt.verify(tok, process.env.JWT_SECRET);
        if (decoded?.id) return `user:${decoded.id}`;
      }
    } catch {}
    return `ip:${req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip}`;
  },
});

// Apply AI rate limiter to all /api/ai/* and /api/nlq routes
app.use('/api/ai', aiRateLimiter);
app.use('/api/nlq', aiRateLimiter);

const AI_CONTEXT_MAX_CHARS = 8000;

function truncateContext(text) {
  if (typeof text !== 'string') return text;
  if (text.length <= AI_CONTEXT_MAX_CHARS) return text;
  return text.substring(0, AI_CONTEXT_MAX_CHARS) + '\n[context truncated for length]';
}

function sanitizeMessages(messages) {
  return messages.map(msg => ({
    ...msg,
    content: truncateContext(msg.content),
  }));
}

async function callAI(messages, opts = {}) {
  const sanitized = sanitizeMessages(messages);
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'SAP CRM AI Assistant',
    },
    body: JSON.stringify({
      model: opts.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: sanitized,
      max_tokens: opts.maxTokens || 16000,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : undefined,
    }),
  });
  const data = await response.json();
  return data;
}

// ---------------------------------------------------------------------------
// parseAIJson — 3-strategy JSON parsing for resilient LLM output handling.
//   1) direct JSON.parse  2) extract from markdown code fence  3) repair
//      truncated/unterminated JSON.
// ---------------------------------------------------------------------------
function _repairTruncatedJSON(json) {
  let str = String(json || '').trim();
  const firstBrace = str.search(/[\{\[]/);
  if (firstBrace > 0) str = str.substring(firstBrace);
  str = str.replace(/,\s*$/, '');
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
  }
  if (inString) str += '"';
  str = str.replace(/,\s*$/, '');
  while (stack.length > 0) str += stack.pop();
  return str;
}

function parseAIJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('parseAIJson: empty input');
  const normalized = raw
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .trim();
  try { return JSON.parse(normalized); } catch {}
  const fence = normalized.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1].trim()); } catch {
      try { return JSON.parse(_repairTruncatedJSON(fence[1])); } catch {}
    }
  }
  return JSON.parse(_repairTruncatedJSON(normalized));
}

// ---------------------------------------------------------------------------
// recordAIResult — persist any AI invocation to the ai_results JSONB table
// for a unified audit log + observability.
// ---------------------------------------------------------------------------
async function recordAIResult({ feature, userId, objectType, objectId, input, output, status, errorMessage, durationMs, model }) {
  try {
    await pool.query(
      `INSERT INTO ai_results (feature, user_id, object_type, object_id, input, output, status, error_message, duration_ms, model)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
      [
        feature,
        userId || null,
        objectType || null,
        objectId || null,
        JSON.stringify(input || {}),
        JSON.stringify(output || {}),
        status || 'success',
        errorMessage || null,
        durationMs || null,
        model || (process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022'),
      ]
    );
  } catch (e) {
    console.warn('recordAIResult failed:', e.message);
  }
}

// AI Sales Forecast
app.post('/api/ai/sales-forecast', auth, async (req, res) => {
  try {
    const opps = await pool.query("SELECT name, amount, phase, probability, close_date FROM opportunities WHERE status = 'Open' ORDER BY amount DESC");
    const invoices = await pool.query("SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'Paid'");

    let ragContext = '';
    try {
      const similar = await searchSimilar('sales forecast revenue pipeline opportunities close rate', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a senior sales analyst for an SAP CRM enterprise platform. Analyze this sales data and provide a comprehensive forecast.

Current Pipeline:
${opps.rows.map(o => `- ${o.name}: $${o.amount} (${o.phase}, ${o.probability}% probability, closes ${o.close_date})`).join('\n')}

Total Revenue Collected: $${invoices.rows[0].total}
${ragContext}

Provide:
1. **Revenue Forecast** - Expected revenue for next quarter with confidence levels
2. **Pipeline Health** - Assessment of pipeline quality and stage distribution
3. **Risk Analysis** - Deals at risk and recommended actions
4. **Top Recommendations** - 3-5 specific actions to improve close rates
5. **Key Metrics** - Win rate prediction, average deal size trend, sales velocity

Format your response with clear headers, bullet points, and specific dollar amounts.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Lead Scoring
app.post('/api/ai/lead-scoring', auth, async (req, res) => {
  try {
    const leads = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');

    let ragContext = '';
    try {
      const similar = await searchSimilar('lead scoring qualification conversion probability rating source', 'leads', 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are an AI lead scoring expert for SAP CRM. Analyze these leads and provide scoring and recommendations.

Leads:
${leads.rows.map(l => `- ${l.first_name} ${l.last_name} (${l.company}): Source=${l.source}, Status=${l.status}, Rating=${l.rating}, Est. Value=$${l.estimated_value}`).join('\n')}
${ragContext}

For each lead, provide:
1. **AI Score** (1-100) based on likelihood to convert
2. **Priority Ranking** (1=highest priority)
3. **Key Factors** affecting the score
4. **Recommended Next Action**

Then provide overall lead analysis:
- **Pipeline Quality Assessment**
- **Source Performance** - Which lead sources are performing best
- **Recommendations** for improving lead conversion

Format with clear structure and specific actionable insights.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Sentiment Analysis
app.post('/api/ai/sentiment', auth, async (req, res) => {
  try {
    const tickets = await pool.query('SELECT title, description, priority, status, category FROM tickets ORDER BY created_at DESC');

    let ragContext = '';
    try {
      const similar = await searchSimilar('customer sentiment satisfaction service ticket complaint resolution', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a customer sentiment analysis AI for SAP CRM. Analyze these service tickets to determine customer sentiment and trends.

Recent Service Tickets:
${tickets.rows.map(t => `- [${t.priority}] ${t.title} (${t.status}, ${t.category}): ${t.description || 'No description'}`).join('\n')}
${ragContext}

Provide:
1. **Overall Sentiment Score** (1-10, where 10 is very positive)
2. **Sentiment Breakdown** by category
3. **Trending Issues** - Top 3 most concerning patterns
4. **Customer Health Indicators** - Areas of satisfaction and concern
5. **Proactive Recommendations** - Steps to improve customer satisfaction
6. **Risk Alerts** - Accounts that may be at risk of churn

Format professionally with headers, bullet points, and specific data-driven insights.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Content Generation
app.post('/api/ai/content-generate', auth, async (req, res) => {
  try {
    const { contentType, topic, audience, tone } = req.body;

    let ragContext = '';
    try {
      const similar = await searchSimilar(`${topic || ''} ${contentType || ''} ${audience || ''}`, null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a professional content creator for an SAP CRM marketing team. Generate the following content:

Content Type: ${contentType || 'Marketing Email'}
Topic: ${topic || 'New product features and platform updates'}
Target Audience: ${audience || 'Enterprise IT decision makers'}
Tone: ${tone || 'Professional and engaging'}
${ragContext}

Generate:
1. **Subject Line** (3 options)
2. **Main Content** - Full content piece with proper formatting
3. **Call to Action** (2-3 options)
4. **Social Media Snippets** - 3 social media versions (LinkedIn, Twitter, Short)
5. **SEO Keywords** - 5-7 relevant keywords

Make the content compelling, professional, and aligned with SAP enterprise brand voice.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Business Insights
app.post('/api/ai/insights', auth, async (req, res) => {
  try {
    const [opps, tickets, leads, invoices, employees] = await Promise.all([
      pool.query("SELECT phase, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM opportunities GROUP BY phase"),
      pool.query("SELECT status, COUNT(*) as count FROM tickets GROUP BY status"),
      pool.query("SELECT status, COUNT(*) as count FROM leads GROUP BY status"),
      pool.query("SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total FROM invoices GROUP BY status"),
      pool.query("SELECT department, COUNT(*) as count FROM employees GROUP BY department"),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar('business performance revenue pipeline operations strategic insights', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a senior business intelligence analyst for SAP CRM. Analyze this comprehensive business data and provide executive-level insights.

Sales Pipeline by Stage:
${opps.rows.map(o => `- ${o.phase}: ${o.count} deals worth $${o.total}`).join('\n')}

Service Tickets by Status:
${tickets.rows.map(t => `- ${t.status}: ${t.count} tickets`).join('\n')}

Lead Distribution:
${leads.rows.map(l => `- ${l.status}: ${l.count} leads`).join('\n')}

Invoice Status:
${invoices.rows.map(i => `- ${i.status}: ${i.count} invoices totaling $${i.total}`).join('\n')}

Team Distribution:
${employees.rows.map(e => `- ${e.department}: ${e.count} employees`).join('\n')}
${ragContext}

Provide:
1. **Executive Summary** - Top 3 key findings
2. **Revenue Analysis** - Current state and trends
3. **Operational Efficiency** - Support and service metrics
4. **Growth Indicators** - Positive trends and opportunities
5. **Risk Factors** - Areas requiring immediate attention
6. **Strategic Recommendations** - Top 5 action items for leadership
7. **90-Day Outlook** - Short-term predictions

Format as an executive briefing with clear headers and actionable insights.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Copilot Chat (RAG-enhanced with multi-turn history)
app.post('/api/ai/copilot', auth, async (req, res) => {
  try {
    const { message, history } = req.body;
    const [contacts, accounts, opps, tickets] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM contacts'),
      pool.query('SELECT COUNT(*) as c FROM accounts'),
      pool.query("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM opportunities WHERE status = 'Open'"),
      pool.query("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('Resolved','Closed')"),
    ]);

    // RAG: retrieve relevant context
    let ragContext = '';
    try {
      const similar = await searchSimilar(message, null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant knowledge base context:\n' + similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const systemContext = `You are SAP CRM Copilot, an AI assistant built into SAP CRM. You have access to the following live data:
- ${contacts.rows[0].c} contacts in the system
- ${accounts.rows[0].c} accounts being managed
- ${opps.rows[0].c} open opportunities worth $${opps.rows[0].total}
- ${tickets.rows[0].c} open service tickets
${ragContext}

You help users with CRM tasks, sales strategy, customer service, data analysis, and business operations. Be helpful, specific, and professional. Reference actual data when relevant. Provide actionable advice.`;

    // Build message array with history for multi-turn context
    const messages = [{ role: 'system', content: systemContext }];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const result = await callAI(messages);
    const content = result?.choices?.[0]?.message?.content || 'I could not process your request.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Performance Analysis
app.post('/api/ai/performance', auth, async (req, res) => {
  try {
    const goals = await pool.query('SELECT * FROM goals');
    const projects = await pool.query('SELECT name, status, progress, budget, actual_cost FROM projects');

    let ragContext = '';
    try {
      const similar = await searchSimilar('project performance goals budget progress completion risk', null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a performance analytics AI for SAP CRM. Analyze the following performance data.

Goals:
${goals.rows.map(g => `- ${g.name} (${g.type}): Target=${g.target_value}, Actual=${g.actual_value}, Progress=${g.progress}%, Status=${g.status}`).join('\n')}

Projects:
${projects.rows.map(p => `- ${p.name}: ${p.status}, ${p.progress}% complete, Budget=$${p.budget}, Spent=$${p.actual_cost}`).join('\n')}
${ragContext}

Provide:
1. **Performance Summary** - Overall organizational performance score
2. **Goals On Track** - Which goals are meeting targets
3. **Goals At Risk** - Which goals need intervention
4. **Project Health** - Budget vs actual analysis
5. **Resource Utilization** - Are resources being used efficiently
6. **Improvement Plan** - Specific actions to get back on track

Use data-driven analysis with specific numbers and percentages.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Competitor Analysis
app.post('/api/ai/competitor-analysis', auth, async (req, res) => {
  try {
    const competitors = await pool.query('SELECT * FROM competitors ORDER BY market_share DESC');

    let ragContext = '';
    try {
      const similar = await searchSimilar('competitor market share strengths weaknesses battle card win strategy', 'competitors', 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a competitive intelligence analyst for SAP CRM. Analyze the competitive landscape.

Competitors:
${competitors.rows.map(c => `- ${c.name}: Market Share=${c.market_share}%, Threat=${c.threat_level}, Industry=${c.industry}
  Strengths: ${c.strengths}
  Weaknesses: ${c.weaknesses}`).join('\n\n')}
${ragContext}

Provide:
1. **Competitive Landscape Overview** - Market positioning map
2. **Top Threats** - Ranked by impact on our business
3. **Competitive Advantages** - Our key differentiators
4. **Win Strategy** per major competitor - How to win against each top 5
5. **Market Trends** - Industry direction and implications
6. **Battle Card Summary** - Quick reference for sales team

Be specific and actionable. Focus on strategies that drive wins.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate response.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SAP BUILD CODE - CODE GENERATOR ENGINE ============

// Code template library
const codeTemplates = {
  ABAP: {
    class: (name, desc) => `CLASS ${name} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    TYPES:
      BEGIN OF ty_record,
        id          TYPE i,
        name        TYPE string,
        description TYPE string,
        status      TYPE string,
        created_at  TYPE timestamp,
        updated_at  TYPE timestamp,
      END OF ty_record,
      tt_records TYPE STANDARD TABLE OF ty_record WITH DEFAULT KEY.

    METHODS:
      constructor,
      get_all     RETURNING VALUE(rt_result) TYPE tt_records
                  RAISING   cx_abap_error,
      get_by_id   IMPORTING iv_id            TYPE i
                  RETURNING VALUE(rs_result) TYPE ty_record
                  RAISING   cx_abap_error,
      create      IMPORTING is_record        TYPE ty_record
                  RETURNING VALUE(rs_result) TYPE ty_record
                  RAISING   cx_abap_error,
      update      IMPORTING iv_id            TYPE i
                            is_record        TYPE ty_record
                  RETURNING VALUE(rs_result) TYPE ty_record
                  RAISING   cx_abap_error,
      delete      IMPORTING iv_id            TYPE i
                  RAISING   cx_abap_error.

  PRIVATE SECTION.
    DATA: mt_data TYPE tt_records.
    METHODS: _validate IMPORTING is_record TYPE ty_record
                       RAISING   cx_abap_error.
ENDCLASS.

CLASS ${name} IMPLEMENTATION.
  METHOD constructor.
    " Initialize - ${desc}
  ENDMETHOD.

  METHOD get_all.
    SELECT * FROM ztable INTO TABLE @rt_result
      ORDER BY created_at DESCENDING.
    IF sy-subrc <> 0.
      rt_result = VALUE #( ).
    ENDIF.
  ENDMETHOD.

  METHOD get_by_id.
    SELECT SINGLE * FROM ztable INTO @rs_result
      WHERE id = @iv_id.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_error
        EXPORTING textid = cx_abap_error=>not_found.
    ENDIF.
  ENDMETHOD.

  METHOD create.
    _validate( is_record ).
    rs_result = is_record.
    GET TIME STAMP FIELD rs_result-created_at.
    rs_result-updated_at = rs_result-created_at.
    INSERT ztable FROM @rs_result.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_error.
    ENDIF.
  ENDMETHOD.

  METHOD update.
    _validate( is_record ).
    rs_result = is_record.
    rs_result-id = iv_id.
    GET TIME STAMP FIELD rs_result-updated_at.
    UPDATE ztable FROM @rs_result.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_error.
    ENDIF.
  ENDMETHOD.

  METHOD delete.
    DELETE FROM ztable WHERE id = @iv_id.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_error
        EXPORTING textid = cx_abap_error=>not_found.
    ENDIF.
  ENDMETHOD.

  METHOD _validate.
    IF is_record-name IS INITIAL.
      RAISE EXCEPTION TYPE cx_abap_error
        EXPORTING textid = cx_abap_error=>validation_error.
    ENDIF.
  ENDMETHOD.
ENDCLASS.`,
    report: (name, desc) => `*&---------------------------------------------------------------------*
*& Report ${name}
*&---------------------------------------------------------------------*
*& ${desc}
*&---------------------------------------------------------------------*
REPORT ${name}.

" Selection screen
SELECTION-SCREEN BEGIN OF BLOCK b01 WITH FRAME TITLE TEXT-001.
  PARAMETERS:     p_bukrs TYPE bukrs OBLIGATORY DEFAULT '1000'.
  SELECT-OPTIONS: s_erdat FOR sy-datum.
  PARAMETERS:     p_max   TYPE i DEFAULT 100.
SELECTION-SCREEN END OF BLOCK b01.

" Types
TYPES: BEGIN OF ty_output,
         id          TYPE i,
         name        TYPE string,
         status      TYPE string,
         amount      TYPE p DECIMALS 2,
         created_at  TYPE timestamp,
       END OF ty_output.

DATA: gt_output TYPE STANDARD TABLE OF ty_output,
      go_alv    TYPE REF TO cl_salv_table.

START-OF-SELECTION.
  PERFORM fetch_data.
  PERFORM display_alv.

FORM fetch_data.
  SELECT id, name, status, amount, created_at
    FROM ztable
    INTO TABLE @gt_output
    WHERE created_at IN @s_erdat
    UP TO @p_max ROWS
    ORDER BY created_at DESCENDING.

  IF sy-subrc <> 0.
    MESSAGE 'No data found' TYPE 'S' DISPLAY LIKE 'W'.
    LEAVE LIST-PROCESSING.
  ENDIF.
ENDFORM.

FORM display_alv.
  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = go_alv
        CHANGING  t_table      = gt_output ).

      " Set column titles
      DATA(lo_cols) = go_alv->get_columns( ).
      lo_cols->set_optimize( abap_true ).

      " Set display settings
      DATA(lo_display) = go_alv->get_display_settings( ).
      lo_display->set_striped_pattern( abap_true ).

      " Enable toolbar functions
      DATA(lo_functions) = go_alv->get_functions( ).
      lo_functions->set_all( abap_true ).

      go_alv->display( ).
    CATCH cx_salv_msg INTO DATA(lx_msg).
      MESSAGE lx_msg TYPE 'E'.
  ENDTRY.
ENDFORM.`,
  },

  CDS: {
    view: (name, desc) => `@AbapCatalog.sqlViewName: '${name.substring(0, 16).toUpperCase()}'
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: '${desc}'

@UI.headerInfo: {
  typeName: 'Record',
  typeNamePlural: 'Records',
  title: { type: #STANDARD, value: 'Name' },
  description: { type: #STANDARD, value: 'Description' }
}

@Search.searchable: true

define view entity ${name}
  as select from ztable as _main
  association [0..1] to I_BusinessPartner as _BusinessPartner
    on $projection.BusinessPartner = _BusinessPartner.BusinessPartner
  association [0..1] to I_Currency as _Currency
    on $projection.Currency = _Currency.Currency
{
      @UI.facet: [
        { id: 'General', purpose: #STANDARD, type: #IDENTIFICATION_REFERENCE, label: 'General', position: 10 },
        { id: 'Details', purpose: #STANDARD, type: #FIELDGROUP_REFERENCE, label: 'Details', position: 20, targetQualifier: 'Details' }
      ]

      @UI.lineItem: [{ position: 10, importance: #HIGH }]
      @UI.identification: [{ position: 10 }]
  key _main.id                as ID,

      @UI.lineItem: [{ position: 20, importance: #HIGH }]
      @UI.identification: [{ position: 20 }]
      @Search.defaultSearchElement: true
      _main.name              as Name,

      @UI.lineItem: [{ position: 30 }]
      @UI.identification: [{ position: 30 }]
      @UI.fieldGroup: [{ qualifier: 'Details', position: 10 }]
      _main.description       as Description,

      @UI.lineItem: [{ position: 40, criticality: 'StatusCriticality' }]
      @UI.identification: [{ position: 40 }]
      _main.status            as Status,

      @UI.hidden: true
      case _main.status
        when 'Active'    then 3  " Green
        when 'Draft'     then 2  " Yellow
        when 'Inactive'  then 1  " Red
        else 0
      end                       as StatusCriticality,

      @UI.lineItem: [{ position: 50 }]
      @UI.identification: [{ position: 50 }]
      @Semantics.amount.currencyCode: 'Currency'
      _main.amount            as Amount,

      @UI.hidden: true
      _main.currency_code     as Currency,

      @UI.identification: [{ position: 60 }]
      @UI.fieldGroup: [{ qualifier: 'Details', position: 20 }]
      _main.business_partner  as BusinessPartner,

      @UI.lineItem: [{ position: 60 }]
      @Semantics.systemDateTime.createdAt: true
      _main.created_at        as CreatedAt,

      @Semantics.systemDateTime.lastChangedAt: true
      _main.updated_at        as UpdatedAt,

      /* Associations */
      _BusinessPartner,
      _Currency
}`,
    service: (name) => `@EndUserText.label: '${name} Service'
define service ${name} {
  expose ${name}View as Records;
  expose I_BusinessPartner as BusinessPartners;
  expose I_Currency as Currencies;
}`,
  },

  'OData V4': {
    service: (name, desc) => `<!-- ${desc} -->
<!-- OData V4 Service Metadata Document (EDMX) -->
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm"
            Namespace="com.sap.${name.toLowerCase()}">

      <!-- Entity Type Definition -->
      <EntityType Name="${name}">
        <Key>
          <PropertyRef Name="ID"/>
        </Key>
        <Property Name="ID" Type="Edm.Int32" Nullable="false"/>
        <Property Name="Name" Type="Edm.String" MaxLength="255"/>
        <Property Name="Description" Type="Edm.String"/>
        <Property Name="Status" Type="Edm.String" MaxLength="50"/>
        <Property Name="Amount" Type="Edm.Decimal" Precision="15" Scale="2"/>
        <Property Name="Currency" Type="Edm.String" MaxLength="3"/>
        <Property Name="BusinessPartner" Type="Edm.String" MaxLength="10"/>
        <Property Name="CreatedAt" Type="Edm.DateTimeOffset"/>
        <Property Name="UpdatedAt" Type="Edm.DateTimeOffset"/>
        <NavigationProperty Name="ToItems" Type="Collection(com.sap.${name.toLowerCase()}.${name}Item)"/>
      </EntityType>

      <!-- Item Entity Type -->
      <EntityType Name="${name}Item">
        <Key>
          <PropertyRef Name="ParentID"/>
          <PropertyRef Name="ItemNumber"/>
        </Key>
        <Property Name="ParentID" Type="Edm.Int32" Nullable="false"/>
        <Property Name="ItemNumber" Type="Edm.Int32" Nullable="false"/>
        <Property Name="ProductID" Type="Edm.String" MaxLength="40"/>
        <Property Name="Quantity" Type="Edm.Decimal" Precision="13" Scale="3"/>
        <Property Name="UnitPrice" Type="Edm.Decimal" Precision="15" Scale="2"/>
        <Property Name="NetAmount" Type="Edm.Decimal" Precision="15" Scale="2"/>
      </EntityType>

      <!-- Entity Container -->
      <EntityContainer Name="${name}Service">
        <EntitySet Name="${name}Set" EntityType="com.sap.${name.toLowerCase()}.${name}">
          <NavigationPropertyBinding Path="ToItems" Target="${name}ItemSet"/>
        </EntitySet>
        <EntitySet Name="${name}ItemSet" EntityType="com.sap.${name.toLowerCase()}.${name}Item"/>

        <!-- Function Import for custom operations -->
        <FunctionImport Name="GetBy Status"
                        ReturnType="Collection(com.sap.${name.toLowerCase()}.${name})">
          <Parameter Name="Status" Type="Edm.String"/>
        </FunctionImport>

        <!-- Action Import -->
        <ActionImport Name="Approve" EntitySet="${name}Set"/>
      </EntityContainer>

    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`,
  },

  'SAP Fiori UI5': {
    view: (name, desc) => `<!-- ${desc} -->
<mvc:View
    controllerName="com.sap.${name.toLowerCase()}.controller.Main"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m"
    xmlns:f="sap.f"
    xmlns:core="sap.ui.core"
    xmlns:smartFilterBar="sap.ui.comp.smartfilterbar"
    xmlns:smartTable="sap.ui.comp.smarttable">

    <f:DynamicPage id="dynamicPage" headerExpanded="true" toggleHeaderOnTitleClick="true">

        <!-- Dynamic Page Title -->
        <f:title>
            <f:DynamicPageTitle>
                <f:heading>
                    <Title text="${desc}" />
                </f:heading>
                <f:actions>
                    <Button text="Create" icon="sap-icon://add" type="Emphasized" press="onCreatePress" />
                    <Button text="Export" icon="sap-icon://excel-attachment" press="onExportPress" />
                    <Button text="Refresh" icon="sap-icon://refresh" press="onRefreshPress" />
                </f:actions>
            </f:DynamicPageTitle>
        </f:title>

        <!-- Dynamic Page Header -->
        <f:header>
            <f:DynamicPageHeader>
                <smartFilterBar:SmartFilterBar
                    id="smartFilterBar"
                    entitySet="${name}Set"
                    persistencyKey="SmartFilter_${name}"
                    useProvidedNavigationProperties="false"
                    showFilterConfiguration="true"
                    liveMode="true">
                    <smartFilterBar:controlConfiguration>
                        <smartFilterBar:ControlConfiguration key="Status" visibleInAdvancedArea="true" preventInitialDataFetchInValueHelpDialog="false" />
                    </smartFilterBar:controlConfiguration>
                </smartFilterBar:SmartFilterBar>
            </f:DynamicPageHeader>
        </f:header>

        <!-- Content -->
        <f:content>
            <smartTable:SmartTable
                id="smartTable"
                entitySet="${name}Set"
                smartFilterId="smartFilterBar"
                tableType="ResponsiveTable"
                useExportToExcel="true"
                useVariantManagement="true"
                useTablePersonalisation="true"
                header="${desc}"
                showRowCount="true"
                enableAutoBinding="true"
                persistencyKey="SmartTable_${name}"
                demandPopin="true"
                itemPress="onItemPress">
                <smartTable:customToolbar>
                    <OverflowToolbar>
                        <ToolbarSpacer />
                        <SearchField width="20%" search="onSearch" />
                    </OverflowToolbar>
                </smartTable:customToolbar>
            </smartTable:SmartTable>
        </f:content>

    </f:DynamicPage>
</mvc:View>`,
    controller: (name, desc) => `sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
], function (Controller, JSONModel, MessageBox, MessageToast, Spreadsheet, exportLibrary) {
    "use strict";

    return Controller.extend("com.sap.${name.toLowerCase()}.controller.Main", {

        onInit: function () {
            // Initialize view model
            var oViewModel = new JSONModel({
                busy: false,
                itemCount: 0,
                selectedItem: null
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        onCreatePress: function () {
            // Navigate to create view or open dialog
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("create");
        },

        onItemPress: function (oEvent) {
            // Navigate to detail view
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            var oContext = oItem.getBindingContext();
            var sPath = oContext.getPath();
            var sId = oContext.getProperty("ID");

            this.getOwnerComponent().getRouter().navTo("detail", {
                id: sId
            });
        },

        onRefreshPress: function () {
            var oTable = this.byId("smartTable");
            oTable.rebindTable();
            MessageToast.show("Data refreshed");
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oSmartTable = this.byId("smartTable");
            var oBinding = oSmartTable.getTable().getBinding("items");

            if (sQuery) {
                var oFilter = new sap.ui.model.Filter("Name", sap.ui.model.FilterOperator.Contains, sQuery);
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onExportPress: function () {
            var oTable = this.byId("smartTable").getTable();
            var oBinding = oTable.getBinding("items");

            var aCols = [
                { label: "ID", property: "ID", type: exportLibrary.EdmType.Number },
                { label: "Name", property: "Name", type: exportLibrary.EdmType.String },
                { label: "Status", property: "Status", type: exportLibrary.EdmType.String },
                { label: "Amount", property: "Amount", type: exportLibrary.EdmType.Number, scale: 2 },
                { label: "Created", property: "CreatedAt", type: exportLibrary.EdmType.DateTime }
            ];

            var oSpreadsheet = new Spreadsheet({
                workbook: { columns: aCols },
                dataSource: oBinding,
                fileName: "${name}_Export.xlsx"
            });

            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });
        },

        onDeletePress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sName = oContext.getProperty("Name");

            MessageBox.confirm("Delete '" + sName + "'?", {
                title: "Confirm Deletion",
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        oContext.delete().then(function () {
                            MessageToast.show("Deleted successfully");
                        });
                    }
                }
            });
        }
    });
});`,
  },

  'ABAP RAP': {
    bo: (name, desc) => `" -----------------------------------------------
" ${desc}
" RAP Managed Business Object - Behavior Definition
" -----------------------------------------------
managed implementation in class zbp_${name.toLowerCase()} unique;
strict ( 2 );

define behavior for Z${name.toUpperCase()} alias ${name}
persistent table z${name.toLowerCase()}
lock master
authorization master ( instance )
etag master UpdatedAt
{
  // Standard operations
  create;
  update;
  delete;

  // Draft support
  draft action Edit;
  draft action Activate optimized;
  draft action Discard;
  draft action Resume;
  draft determine action Prepare;

  // Custom actions
  action ( features : instance ) approve result [1] $self;
  action ( features : instance ) reject result [1] $self;

  // Field properties
  field ( readonly ) ID, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy;
  field ( readonly : update ) Status;
  field ( mandatory ) Name;

  // Validations
  validation validateName on save { create; update; field Name; }
  validation validateAmount on save { create; update; field Amount; }

  // Determinations
  determination setDefaults on modify { create; }
  determination calculateTotal on modify { create; update; field Amount, Quantity; }

  // Associations
  association _Items { create; }

  // Mapping
  mapping for Z${name.toUpperCase()}
  {
    ID           = id;
    Name         = name;
    Description  = description;
    Status       = status;
    Amount       = amount;
    CreatedAt    = created_at;
    UpdatedAt    = updated_at;
  }
}

define behavior for Z${name.toUpperCase()}_ITEM alias ${name}Item
persistent table z${name.toLowerCase()}_item
lock dependent by _Parent
authorization dependent by _Parent
etag master UpdatedAt
{
  update;
  delete;

  field ( readonly ) ParentID;

  association _Parent;

  mapping for Z${name.toUpperCase()}_ITEM
  {
    ParentID   = parent_id;
    ItemNumber = item_number;
    ProductID  = product_id;
    Quantity   = quantity;
    UnitPrice  = unit_price;
    NetAmount  = net_amount;
  }
}`,
    impl: (name) => `CLASS zbp_${name.toLowerCase()} DEFINITION PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF Z${name.toUpperCase()}.
ENDCLASS.

CLASS zbp_${name.toLowerCase()} IMPLEMENTATION.
ENDCLASS.

CLASS lhc_${name} DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      get_instance_authorizations FOR INSTANCE AUTHORIZATION
        IMPORTING keys REQUEST requested_authorizations FOR ${name} RESULT result,

      validateName FOR VALIDATE ON SAVE
        IMPORTING keys FOR ${name}~validateName,

      validateAmount FOR VALIDATE ON SAVE
        IMPORTING keys FOR ${name}~validateAmount,

      setDefaults FOR DETERMINE ON MODIFY
        IMPORTING keys FOR ${name}~setDefaults,

      calculateTotal FOR DETERMINE ON MODIFY
        IMPORTING keys FOR ${name}~calculateTotal,

      approve FOR MODIFY
        IMPORTING keys FOR ACTION ${name}~approve RESULT result,

      reject FOR MODIFY
        IMPORTING keys FOR ACTION ${name}~reject RESULT result,

      get_instance_features FOR INSTANCE FEATURES
        IMPORTING keys REQUEST requested_features FOR ${name} RESULT result.
ENDCLASS.

CLASS lhc_${name} IMPLEMENTATION.

  METHOD get_instance_authorizations.
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name}
      ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    result = VALUE #( FOR rec IN records
      ( %tky = rec-%tky
        %update = COND #( WHEN rec-Status = 'Approved' THEN if_abap_behv=>auth-unauthorized
                          ELSE if_abap_behv=>auth-allowed )
        %delete = COND #( WHEN rec-Status = 'Approved' THEN if_abap_behv=>auth-unauthorized
                          ELSE if_abap_behv=>auth-allowed ) ) ).
  ENDMETHOD.

  METHOD validateName.
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} FIELDS ( Name ) WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    LOOP AT records INTO DATA(rec) WHERE Name IS INITIAL.
      APPEND VALUE #( %tky = rec-%tky ) TO failed-${name.toLowerCase()}.
      APPEND VALUE #( %tky = rec-%tky
                      %msg = new_message_with_text( text = 'Name is required' severity = if_abap_behv_message=>severity-error )
                      %element-Name = if_abap_behv=>mk-on ) TO reported-${name.toLowerCase()}.
    ENDLOOP.
  ENDMETHOD.

  METHOD validateAmount.
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} FIELDS ( Amount ) WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    LOOP AT records INTO DATA(rec) WHERE Amount < 0.
      APPEND VALUE #( %tky = rec-%tky ) TO failed-${name.toLowerCase()}.
      APPEND VALUE #( %tky = rec-%tky
                      %msg = new_message_with_text( text = 'Amount must be positive' severity = if_abap_behv_message=>severity-error )
                      %element-Amount = if_abap_behv=>mk-on ) TO reported-${name.toLowerCase()}.
    ENDLOOP.
  ENDMETHOD.

  METHOD setDefaults.
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    MODIFY ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name}
      UPDATE FIELDS ( Status )
      WITH VALUE #( FOR rec IN records WHERE ( Status IS INITIAL )
        ( %tky = rec-%tky Status = 'Draft' ) ).
  ENDMETHOD.

  METHOD calculateTotal.
    " Recalculate totals from line items
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} BY \\_Items ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(items).
  ENDMETHOD.

  METHOD approve.
    MODIFY ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name}
      UPDATE FIELDS ( Status )
      WITH VALUE #( FOR key IN keys ( %tky = key-%tky Status = 'Approved' ) ).

    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    result = VALUE #( FOR rec IN records ( %tky = rec-%tky %param = rec ) ).
  ENDMETHOD.

  METHOD reject.
    MODIFY ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name}
      UPDATE FIELDS ( Status )
      WITH VALUE #( FOR key IN keys ( %tky = key-%tky Status = 'Rejected' ) ).

    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    result = VALUE #( FOR rec IN records ( %tky = rec-%tky %param = rec ) ).
  ENDMETHOD.

  METHOD get_instance_features.
    READ ENTITIES OF Z${name.toUpperCase()} IN LOCAL MODE
      ENTITY ${name} FIELDS ( Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(records).

    result = VALUE #( FOR rec IN records
      ( %tky = rec-%tky
        %action-approve = COND #( WHEN rec-Status = 'Draft' THEN if_abap_behv=>fc-o-enabled
                                  ELSE if_abap_behv=>fc-o-disabled )
        %action-reject  = COND #( WHEN rec-Status = 'Draft' THEN if_abap_behv=>fc-o-enabled
                                  ELSE if_abap_behv=>fc-o-disabled ) ) ).
  ENDMETHOD.

ENDCLASS.`,
  },

  'SAP CAP Node.js': {
    schema: (name, desc) => `// ${desc}
// db/schema.cds - Domain Model

namespace com.sap.${name.toLowerCase()};

using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';

entity ${name} : cuid, managed {
  name         : String(255) @mandatory;
  description  : String(1000);
  status       : Association to StatusCodes;
  priority     : Association to PriorityCodes;
  amount       : Decimal(15,2);
  currency     : Currency;
  businessPartner : String(10);
  startDate    : Date;
  endDate      : Date;
  items        : Composition of many ${name}Item on items.parent = $self;
}

entity ${name}Item : cuid, managed {
  parent       : Association to ${name};
  itemNumber   : Integer;
  product      : String(40);
  description  : String(255);
  quantity     : Decimal(13,3);
  unit         : String(3);
  unitPrice    : Decimal(15,2);
  netAmount    : Decimal(15,2);
  currency     : Currency;
}

entity StatusCodes : CodeList {
  key code : String(20);
}

entity PriorityCodes : CodeList {
  key code : String(20);
}`,
    service: (name) => `// srv/service.cds - Service Definition

using { com.sap.${name.toLowerCase()} as db } from '../db/schema';

service ${name}Service @(path: '/api/${name.toLowerCase()}') {

  @odata.draft.enabled
  entity Records as projection on db.${name} {
    *,
    items : redirected to RecordItems
  } actions {
    @(requires: 'Manager')
    action approve() returns Records;
    action reject() returns Records;
    function getByStatus(status: String) returns array of Records;
  };

  entity RecordItems as projection on db.${name}Item {
    *,
    parent : redirected to Records
  };

  // Read-only views
  @readonly
  entity StatusCodes as projection on db.StatusCodes;

  @readonly
  entity PriorityCodes as projection on db.PriorityCodes;
}`,
    handler: (name) => `// srv/service.js - Custom Handlers

const cds = require('@sap/cds');

module.exports = class ${name}Service extends cds.ApplicationService {

  async init() {
    const { Records, RecordItems } = this.entities;

    // Before CREATE - set defaults
    this.before('CREATE', Records, async (req) => {
      const { data } = req;
      if (!data.status_code) data.status_code = 'DRAFT';
      if (!data.priority_code) data.priority_code = 'MEDIUM';
    });

    // Before UPDATE - validate
    this.before('UPDATE', Records, async (req) => {
      const { data } = req;
      if (data.amount !== undefined && data.amount < 0) {
        req.reject(400, 'Amount must be positive');
      }
    });

    // After READ - enrich with computed fields
    this.after('READ', Records, (each) => {
      if (Array.isArray(each)) {
        each.forEach(e => this._enrichRecord(e));
      } else if (each) {
        this._enrichRecord(each);
      }
    });

    // Action: Approve
    this.on('approve', async (req) => {
      const { ID } = req.params[0];
      const record = await SELECT.one.from(Records).where({ ID });

      if (!record) req.reject(404, 'Record not found');
      if (record.status_code !== 'DRAFT') {
        req.reject(400, \`Cannot approve record in status \${record.status_code}\`);
      }

      await UPDATE(Records).set({
        status_code: 'APPROVED',
        modifiedAt: new Date()
      }).where({ ID });

      // Log the action
      console.log(\`Record \${ID} approved by \${req.user.id}\`);

      return SELECT.one.from(Records).where({ ID });
    });

    // Action: Reject
    this.on('reject', async (req) => {
      const { ID } = req.params[0];
      await UPDATE(Records).set({
        status_code: 'REJECTED',
        modifiedAt: new Date()
      }).where({ ID });

      return SELECT.one.from(Records).where({ ID });
    });

    // Function: Get by status
    this.on('getByStatus', async (req) => {
      const { status } = req.data;
      return SELECT.from(Records).where({ status_code: status });
    });

    // Before DELETE - check status
    this.before('DELETE', Records, async (req) => {
      const record = await SELECT.one.from(Records).where({ ID: req.data.ID });
      if (record && record.status_code === 'APPROVED') {
        req.reject(400, 'Cannot delete approved records');
      }
    });

    // Calculate item totals on item changes
    this.after(['CREATE', 'UPDATE', 'DELETE'], RecordItems, async (_, req) => {
      const parentID = req.data?.parent_ID;
      if (parentID) {
        const items = await SELECT.from(RecordItems).where({ parent_ID: parentID });
        const total = items.reduce((sum, item) => sum + (Number(item.netAmount) || 0), 0);
        await UPDATE(Records).set({ amount: total }).where({ ID: parentID });
      }
    });

    await super.init();
  }

  _enrichRecord(record) {
    if (record.amount) {
      record.formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: record.currency_code || 'EUR'
      }).format(record.amount);
    }
  }
};`,
  },

  'SQL HANA': {
    calcView: (name, desc) => `-- ${desc}
-- SAP HANA Calculation View / Analytical Query

-- Create column table
CREATE COLUMN TABLE "${name.toUpperCase()}" (
    "ID"               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "NAME"             NVARCHAR(255) NOT NULL,
    "DESCRIPTION"      NVARCHAR(1000),
    "STATUS"           NVARCHAR(50) DEFAULT 'Active',
    "AMOUNT"           DECIMAL(15,2),
    "CURRENCY"         NVARCHAR(3) DEFAULT 'EUR',
    "CATEGORY"         NVARCHAR(100),
    "REGION"           NVARCHAR(100),
    "BUSINESS_PARTNER" NVARCHAR(10),
    "CREATED_AT"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "UPDATED_AT"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytical view
CREATE VIEW "${name.toUpperCase()}_ANALYTICS" AS
SELECT
    t."CATEGORY",
    t."REGION",
    t."STATUS",
    t."CURRENCY",
    COUNT(*) AS "RECORD_COUNT",
    SUM(t."AMOUNT") AS "TOTAL_AMOUNT",
    AVG(t."AMOUNT") AS "AVG_AMOUNT",
    MIN(t."AMOUNT") AS "MIN_AMOUNT",
    MAX(t."AMOUNT") AS "MAX_AMOUNT",
    STDDEV(t."AMOUNT") AS "AMOUNT_STDDEV",
    COUNT(CASE WHEN t."STATUS" = 'Active' THEN 1 END) AS "ACTIVE_COUNT",
    COUNT(CASE WHEN t."STATUS" = 'Closed' THEN 1 END) AS "CLOSED_COUNT"
FROM "${name.toUpperCase()}" t
GROUP BY t."CATEGORY", t."REGION", t."STATUS", t."CURRENCY";

-- Time-series analytics with window functions
CREATE VIEW "${name.toUpperCase()}_TREND" AS
SELECT
    TO_DATE("CREATED_AT") AS "DATE",
    "CATEGORY",
    COUNT(*) AS "DAILY_COUNT",
    SUM("AMOUNT") AS "DAILY_AMOUNT",
    SUM(COUNT(*)) OVER (
        PARTITION BY "CATEGORY"
        ORDER BY TO_DATE("CREATED_AT")
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS "CUMULATIVE_COUNT",
    SUM(SUM("AMOUNT")) OVER (
        PARTITION BY "CATEGORY"
        ORDER BY TO_DATE("CREATED_AT")
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS "CUMULATIVE_AMOUNT",
    AVG(SUM("AMOUNT")) OVER (
        PARTITION BY "CATEGORY"
        ORDER BY TO_DATE("CREATED_AT")
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS "MOVING_AVG_7D"
FROM "${name.toUpperCase()}"
GROUP BY TO_DATE("CREATED_AT"), "CATEGORY";

-- Top performers with ranking
CREATE VIEW "${name.toUpperCase()}_RANKING" AS
SELECT
    "NAME",
    "CATEGORY",
    "REGION",
    "AMOUNT",
    RANK() OVER (PARTITION BY "CATEGORY" ORDER BY "AMOUNT" DESC) AS "RANK_IN_CATEGORY",
    PERCENT_RANK() OVER (ORDER BY "AMOUNT" DESC) AS "PERCENTILE",
    NTILE(4) OVER (ORDER BY "AMOUNT" DESC) AS "QUARTILE"
FROM "${name.toUpperCase()}"
WHERE "STATUS" = 'Active';

-- Stored procedure for data aggregation
CREATE PROCEDURE "${name.toUpperCase()}_AGGREGATE" (
    IN  iv_category NVARCHAR(100),
    IN  iv_date_from DATE,
    IN  iv_date_to DATE,
    OUT ot_result TABLE (
        "REGION" NVARCHAR(100),
        "RECORD_COUNT" INTEGER,
        "TOTAL_AMOUNT" DECIMAL(15,2),
        "AVG_AMOUNT" DECIMAL(15,2)
    )
)
LANGUAGE SQLSCRIPT
SQL SECURITY INVOKER
READS SQL DATA
AS
BEGIN
    ot_result = SELECT
        "REGION",
        COUNT(*) AS "RECORD_COUNT",
        SUM("AMOUNT") AS "TOTAL_AMOUNT",
        AVG("AMOUNT") AS "AVG_AMOUNT"
    FROM "${name.toUpperCase()}"
    WHERE "CATEGORY" = :iv_category
      AND "CREATED_AT" BETWEEN :iv_date_from AND :iv_date_to
    GROUP BY "REGION"
    ORDER BY "TOTAL_AMOUNT" DESC;
END;`,
  },

  'Integration Flow': {
    iflow: (name, desc) => `<!-- ${desc} -->
<!-- SAP Integration Suite - Integration Flow Definition -->
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
                   xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd"
                   id="${name}_IFlow">

  <bpmn2:process id="Process_${name}" name="${desc}">

    <!-- Sender Channel (HTTP/OData) -->
    <bpmn2:startEvent id="StartEvent_1" name="Start">
      <bpmn2:documentation>Trigger: Scheduled or HTTP request</bpmn2:documentation>
    </bpmn2:startEvent>

    <!-- Step 1: Fetch data from source system -->
    <bpmn2:serviceTask id="Step_FetchData" name="Fetch Source Data">
      <bpmn2:documentation>
        Adapter: OData V2
        Address: https://source-system.com/sap/opu/odata/sap/API_BUSINESS_PARTNER
        Operation: GET
        Query: $filter=LastChangeDate gt datetime'${new Date().toISOString()}'
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 2: Content Modifier - Set Headers -->
    <bpmn2:serviceTask id="Step_SetHeaders" name="Set Processing Headers">
      <bpmn2:documentation>
        Set Header: X-Batch-ID = ${new Date().getTime()}
        Set Property: RecordCount = ${'{'}xpath:/records/count${'}'}
        Set Property: ProcessingDate = ${'{'}currentDate${'}'}
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 3: Mapping -->
    <bpmn2:serviceTask id="Step_Mapping" name="Transform Data">
      <bpmn2:documentation>
        Type: Message Mapping
        Source: SourceBusinessPartner
        Target: TargetBusinessPartner

        Field Mappings:
        - BusinessPartner -> ExternalID
        - BusinessPartnerFullName -> Name
        - OrganizationBPName1 -> CompanyName
        - EmailAddress -> Email
        - PhoneNumber -> Phone
        - AddressStreetName + AddressHouseNumber -> Address
        - AddressCityName -> City
        - AddressCountry -> Country
        - CreationDate -> CreatedAt (format: yyyy-MM-dd)
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 4: Groovy Script - Validate & Enrich -->
    <bpmn2:scriptTask id="Step_Validate" name="Validate Records" scriptFormat="groovy">
      <bpmn2:script>
import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

def Message processData(Message message) {
    def body = message.getBody(String)
    def jsonSlurper = new JsonSlurper()
    def records = jsonSlurper.parseText(body)

    def validRecords = []
    def errorRecords = []
    def stats = [total: 0, valid: 0, invalid: 0]

    records.each { record ->
        stats.total++
        if (record.Name &amp;&amp; record.Email) {
            // Enrich with processing metadata
            record.ProcessedAt = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'")
            record.SyncStatus = 'PENDING'
            record.BatchID = message.getProperty('X-Batch-ID')
            validRecords.add(record)
            stats.valid++
        } else {
            record.ErrorReason = !record.Name ? 'Missing Name' : 'Missing Email'
            errorRecords.add(record)
            stats.invalid++
        }
    }

    message.setProperty('ValidationStats', JsonOutput.toJson(stats))
    message.setProperty('ErrorRecords', JsonOutput.toJson(errorRecords))
    message.setBody(JsonOutput.toJson(validRecords))
    return message
}
      </bpmn2:script>
    </bpmn2:scriptTask>

    <!-- Step 5: Router - Check if records exist -->
    <bpmn2:exclusiveGateway id="Gateway_CheckRecords" name="Records Found?">
      <bpmn2:documentation>
        Condition: ${'{'}property.RecordCount > 0${'}'}
        Default: End (no records)
      </bpmn2:documentation>
    </bpmn2:exclusiveGateway>

    <!-- Step 6: Splitter for batch processing -->
    <bpmn2:serviceTask id="Step_Split" name="Split to Batches">
      <bpmn2:documentation>
        Type: Iterating Splitter
        Expression: //record
        Parallel Processing: true
        Max Threads: 5
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 7: Send to target system -->
    <bpmn2:serviceTask id="Step_SendTarget" name="Upsert to Target">
      <bpmn2:documentation>
        Adapter: HTTP
        Method: POST
        Address: https://target-system.com/api/records
        Headers:
          Content-Type: application/json
          Authorization: Bearer ${'{'}property.TargetToken${'}'}
        Retry: 3 times with 5s delay
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 8: Gather results -->
    <bpmn2:serviceTask id="Step_Gather" name="Gather Results">
      <bpmn2:documentation>Aggregate batch processing results</bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- Step 9: Send notification -->
    <bpmn2:serviceTask id="Step_Notify" name="Send Summary Email">
      <bpmn2:documentation>
        Adapter: Mail
        To: integration-team@company.com
        Subject: [${name}] Sync Complete - ${'{'}property.ProcessingDate${'}'}
        Body: Processed ${'{'}property.ValidationStats${'}'}
      </bpmn2:documentation>
    </bpmn2:serviceTask>

    <!-- End Event -->
    <bpmn2:endEvent id="EndEvent_1" name="End" />

    <!-- Error Handling -->
    <bpmn2:boundaryEvent id="ErrorHandler" attachedToRef="Step_SendTarget">
      <bpmn2:errorEventDefinition />
    </bpmn2:boundaryEvent>

    <bpmn2:serviceTask id="Step_ErrorLog" name="Log Error">
      <bpmn2:documentation>
        Log to Message Processing Log with ERROR level
        Store failed records for retry
      </bpmn2:documentation>
    </bpmn2:serviceTask>

  </bpmn2:process>
</bpmn2:definitions>`,
  },

  'Workflow': {
    definition: (name, desc) => `// ${desc}
// SAP Build Process Automation - Workflow Definition
{
  "id": "${name.toLowerCase()}_workflow",
  "name": "${desc}",
  "version": "1.0.0",
  "triggerEvents": [
    {
      "type": "api",
      "name": "StartApproval",
      "inputs": {
        "recordId": "string",
        "recordName": "string",
        "amount": "number",
        "requestor": "string",
        "requestorEmail": "string",
        "department": "string"
      }
    }
  ],
  "steps": [
    {
      "id": "step_determine_approver",
      "type": "script",
      "name": "Determine Approver",
      "script": "// Determine approval level based on amount\\nvar amount = $.context.amount;\\nvar approver;\\nvar approvalLevel;\\n\\nif (amount <= 10000) {\\n  approver = 'manager@company.com';\\n  approvalLevel = 'Manager';\\n} else if (amount <= 100000) {\\n  approver = 'director@company.com';\\n  approvalLevel = 'Director';\\n} else {\\n  approver = 'vp@company.com';\\n  approvalLevel = 'VP';\\n}\\n\\n$.context.approver = approver;\\n$.context.approvalLevel = approvalLevel;"
    },
    {
      "id": "step_approval",
      "type": "approval",
      "name": "Approval Decision",
      "assignedTo": "$.context.approver",
      "subject": "Approval Required: $.context.recordName ($$.context.amount)",
      "description": "Please review and approve/reject this request.\\n\\nRequested by: $.context.requestor\\nDepartment: $.context.department\\nAmount: $.context.amount\\nApproval Level: $.context.approvalLevel",
      "actions": ["approve", "reject"],
      "dueDate": "P3D",
      "escalation": {
        "after": "P5D",
        "to": "admin@company.com"
      }
    },
    {
      "id": "step_check_decision",
      "type": "gateway",
      "name": "Check Decision",
      "conditions": [
        {
          "expression": "$.context.approval_decision == 'approve'",
          "next": "step_approved"
        },
        {
          "expression": "$.context.approval_decision == 'reject'",
          "next": "step_rejected"
        }
      ]
    },
    {
      "id": "step_approved",
      "type": "script",
      "name": "Process Approval",
      "script": "// Update record status via API\\n$.context.newStatus = 'Approved';\\n$.context.approvedAt = new Date().toISOString();\\n$.context.approvedBy = $.context.approver;"
    },
    {
      "id": "step_notify_approved",
      "type": "notification",
      "name": "Notify Requestor - Approved",
      "to": "$.context.requestorEmail",
      "subject": "Request Approved: $.context.recordName",
      "body": "Your request has been approved by $.context.approvedBy."
    },
    {
      "id": "step_rejected",
      "type": "script",
      "name": "Process Rejection",
      "script": "$.context.newStatus = 'Rejected';\\n$.context.rejectedAt = new Date().toISOString();"
    },
    {
      "id": "step_notify_rejected",
      "type": "notification",
      "name": "Notify Requestor - Rejected",
      "to": "$.context.requestorEmail",
      "subject": "Request Rejected: $.context.recordName",
      "body": "Your request has been rejected. Please contact your approver for details."
    }
  ]
}`,
  },

  JavaScript: {
    module: (name, desc) => `// ${desc}
// Node.js / Express Module

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/${name.toLowerCase()}
 * @desc    Get all ${name} records with search, sort, pagination
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { search, sort = 'id', order = 'desc', limit = 50, offset = 0 } = req.query;
    const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let query = 'SELECT * FROM ${name.toLowerCase()}';
    const params = [];

    if (search) {
      params.push(\`%\${search}%\`);
      query += \` WHERE name ILIKE $\${params.length} OR description ILIKE $\${params.length}\`;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);

    query += \` ORDER BY \${sort} \${safeOrder}\`;
    params.push(limit);
    query += \` LIMIT $\${params.length}\`;
    params.push(offset);
    query += \` OFFSET $\${params.length}\`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/${name.toLowerCase()}/:id
 * @desc    Get single ${name} record
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ${name.toLowerCase()} WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/${name.toLowerCase()}
 * @desc    Create new ${name} record
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map((_, i) => \`$\${i + 1}\`).join(', ');
    const result = await pool.query(
      \`INSERT INTO ${name.toLowerCase()} (\${keys.join(', ')}) VALUES (\${placeholders}) RETURNING *\`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/${name.toLowerCase()}/:id
 * @desc    Update ${name} record
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const values = keys.map(k => req.body[k]);
    const setClause = keys.map((k, i) => \`\${k} = $\${i + 1}\`).join(', ');
    values.push(req.params.id);
    const result = await pool.query(
      \`UPDATE ${name.toLowerCase()} SET \${setClause}, updated_at = NOW() WHERE id = $\${values.length} RETURNING *\`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   DELETE /api/${name.toLowerCase()}/:id
 * @desc    Delete ${name} record
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ${name.toLowerCase()} WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`,
  },

  'BTP Extension': {
    app: (name, desc) => `// ${desc}
// SAP BTP Extension Application

const cds = require('@sap/cds');
const xsenv = require('@sap/xsenv');
const passport = require('passport');
const { JWTStrategy } = require('@sap/xssec');

// Load BTP services
xsenv.loadEnv();
const services = xsenv.getServices({
  uaa: { tag: 'xsuaa' },
  dest: { tag: 'destination' },
  conn: { tag: 'connectivity' }
});

// Configure authentication
passport.use(new JWTStrategy(services.uaa));

module.exports = cds.server;

// package.json dependencies:
// {
//   "dependencies": {
//     "@sap/cds": "^7",
//     "@sap/xssec": "^3",
//     "@sap/xsenv": "^4",
//     "@sap/hana-client": "^2",
//     "passport": "^0.6",
//     "express": "^4"
//   },
//   "scripts": {
//     "start": "cds-serve",
//     "build": "cds build --production"
//   },
//   "cds": {
//     "requires": {
//       "db": {
//         "kind": "hana",
//         "model": ["db/", "srv/"]
//       },
//       "auth": {
//         "kind": "xsuaa"
//       },
//       "API_BUSINESS_PARTNER": {
//         "kind": "odata-v2",
//         "model": "srv/external/API_BUSINESS_PARTNER"
//       }
//     }
//   }
// }

// xs-app.json (App Router config):
// {
//   "authenticationMethod": "route",
//   "routes": [
//     {
//       "source": "^/api/(.*)$",
//       "target": "/api/$1",
//       "destination": "srv-api",
//       "authenticationType": "xsuaa"
//     },
//     {
//       "source": "^(.*)$",
//       "target": "$1",
//       "service": "html5-apps-repo-rt",
//       "authenticationType": "xsuaa"
//     }
//   ]
// }

// mta.yaml (deployment descriptor):
// ID: ${name.toLowerCase()}-app
// _schema-version: '3.1'
// version: 1.0.0
// modules:
//   - name: ${name.toLowerCase()}-srv
//     type: nodejs
//     path: gen/srv
//     requires:
//       - name: ${name.toLowerCase()}-db
//       - name: ${name.toLowerCase()}-auth
//     provides:
//       - name: srv-api
//         properties:
//           srv-url: \${default-url}
//
//   - name: ${name.toLowerCase()}-db-deployer
//     type: hdb
//     path: gen/db
//     requires:
//       - name: ${name.toLowerCase()}-db
//
//   - name: ${name.toLowerCase()}-app-router
//     type: approuter.nodejs
//     path: app/router
//     requires:
//       - name: srv-api
//         group: destinations
//       - name: ${name.toLowerCase()}-auth
//
// resources:
//   - name: ${name.toLowerCase()}-db
//     type: com.sap.xs.hdi-container
//   - name: ${name.toLowerCase()}-auth
//     type: org.cloudfoundry.managed-service
//     parameters:
//       service: xsuaa
//       service-plan: application`,
  },
};

// Extract entity name from description
function extractEntityName(description) {
  const words = description.replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
  const keywords = ['create', 'build', 'generate', 'make', 'implement', 'a', 'an', 'the', 'for', 'with', 'and', 'or', 'to', 'of', 'in', 'on'];
  const meaningful = words.filter(w => !keywords.includes(w.toLowerCase()) && w.length > 2);
  if (meaningful.length > 0) {
    return meaningful[0].charAt(0).toUpperCase() + meaningful[0].slice(1);
  }
  return 'Entity';
}

// Code generation endpoint - template-based + AI enhanced
app.post('/api/ai/code-generate', auth, async (req, res) => {
  try {
    const { language, description, context } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const entityName = extractEntityName(description);
    const lang = language || 'ABAP';
    const ctx = context || 'SAP S/4HANA';
    let templateCode = '';
    let files = [];

    // Generate template-based code
    switch (lang) {
      case 'ABAP':
        if (description.toLowerCase().includes('report') || description.toLowerCase().includes('alv')) {
          templateCode = codeTemplates.ABAP.report(`Z${entityName.toUpperCase()}_REPORT`, description);
          files = [{ name: `z${entityName.toLowerCase()}_report.abap`, type: 'abap' }];
        } else {
          templateCode = codeTemplates.ABAP.class(`ZCL_${entityName.toUpperCase()}`, description);
          files = [{ name: `zcl_${entityName.toLowerCase()}.abap`, type: 'abap' }];
        }
        break;

      case 'CDS':
        templateCode = codeTemplates.CDS.view(`Z_I_${entityName.toUpperCase()}`, description);
        templateCode += '\n\n---\n\n' + codeTemplates.CDS.service(entityName);
        files = [{ name: `Z_I_${entityName}.cds`, type: 'cds' }, { name: `Z_${entityName}_Service.cds`, type: 'cds' }];
        break;

      case 'OData V4':
        templateCode = codeTemplates['OData V4'].service(entityName, description);
        files = [{ name: `${entityName}Service.edmx`, type: 'xml' }];
        break;

      case 'SAP Fiori UI5':
        templateCode = codeTemplates['SAP Fiori UI5'].view(entityName, description);
        templateCode += '\n\n---\n\n' + codeTemplates['SAP Fiori UI5'].controller(entityName, description);
        files = [
          { name: `Main.view.xml`, type: 'xml' },
          { name: `Main.controller.js`, type: 'javascript' },
        ];
        break;

      case 'ABAP RAP':
        templateCode = codeTemplates['ABAP RAP'].bo(entityName, description);
        templateCode += '\n\n---\n\n' + codeTemplates['ABAP RAP'].impl(entityName);
        files = [
          { name: `Z${entityName}_BehaviorDef.bdef`, type: 'abap' },
          { name: `zbp_${entityName.toLowerCase()}.abap`, type: 'abap' },
        ];
        break;

      case 'SAP CAP Node.js':
        templateCode = codeTemplates['SAP CAP Node.js'].schema(entityName, description);
        templateCode += '\n\n---\n\n' + codeTemplates['SAP CAP Node.js'].service(entityName);
        templateCode += '\n\n---\n\n' + codeTemplates['SAP CAP Node.js'].handler(entityName);
        files = [
          { name: `db/schema.cds`, type: 'cds' },
          { name: `srv/service.cds`, type: 'cds' },
          { name: `srv/service.js`, type: 'javascript' },
        ];
        break;

      case 'SQL HANA':
        templateCode = codeTemplates['SQL HANA'].calcView(entityName, description);
        files = [{ name: `${entityName}_analytics.sql`, type: 'sql' }];
        break;

      case 'Integration Flow':
        templateCode = codeTemplates['Integration Flow'].iflow(entityName, description);
        files = [{ name: `${entityName}_IFlow.iflw`, type: 'xml' }];
        break;

      case 'Workflow':
        templateCode = codeTemplates['Workflow'].definition(entityName, description);
        files = [{ name: `${entityName}_Workflow.json`, type: 'json' }];
        break;

      case 'JavaScript':
        templateCode = codeTemplates['JavaScript'].module(entityName, description);
        files = [{ name: `routes/${entityName.toLowerCase()}.js`, type: 'javascript' }];
        break;

      case 'BTP Extension':
        templateCode = codeTemplates['BTP Extension'].app(entityName, description);
        files = [{ name: `server.js`, type: 'javascript' }];
        break;

      default:
        templateCode = `// ${lang} code for: ${description}`;
        files = [{ name: `${entityName.toLowerCase()}.txt`, type: 'text' }];
    }

    // Now enhance with AI
    const aiPrompt = `You are SAP Build Code with Joule AI. The user requested ${lang} code for "${description}" in the context of ${ctx}.

I have generated a template below. Please:
1. Review and customize this code to match the user's specific request: "${description}"
2. Add proper SAP-specific annotations and best practices
3. Ensure all code is production-ready with error handling
4. Add brief explanations between code sections
5. Keep the template structure but adapt entity names, fields, and logic to match the description
6. Wrap each code file in \`\`\` code blocks with the appropriate language tag

Files to generate: ${files.map(f => f.name).join(', ')}

Template code to customize:
${templateCode}

Customize this for: "${description}" in ${ctx} context. Make it specific, not generic.`;

    try {
      const aiResult = await callAI([{ role: 'user', content: aiPrompt }]);
      const aiContent = aiResult?.choices?.[0]?.message?.content;
      if (aiContent) {
        res.json({ result: aiContent, files, language: lang, context: ctx });
        return;
      }
    } catch (aiErr) {
      // AI enhancement failed - return template code directly
      console.log('AI enhancement skipped:', aiErr.message);
    }

    // Return template code with formatting if AI is unavailable
    const langMap = { 'ABAP': 'abap', 'CDS': 'cds', 'OData V4': 'xml', 'SAP Fiori UI5': 'xml', 'ABAP RAP': 'abap', 'SAP CAP Node.js': 'javascript', 'SAP CAP Java': 'java', 'SQL HANA': 'sql', 'Integration Flow': 'xml', 'Workflow': 'json', 'JavaScript': 'javascript', 'BTP Extension': 'javascript' };
    const codeLang = langMap[lang] || 'text';

    const sections = templateCode.split('\n\n---\n\n');
    let formatted = `## Generated ${lang} Code\n\n**Context:** ${ctx}\n**Description:** ${description}\n**Files:** ${files.map(f => f.name).join(', ')}\n\n`;
    sections.forEach((section, i) => {
      if (files[i]) formatted += `### ${files[i].name}\n\n`;
      formatted += '```' + codeLang + '\n' + section + '\n```\n\n';
    });
    formatted += `## Deployment Notes\n\n- Deploy to your ${ctx} environment\n- Ensure proper authorizations are configured\n- Test in development before moving to production`;

    res.json({ result: formatted, files, language: lang, context: ctx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ AI SMART FEATURES ============

// 1. AI Generate Record - Generate field values from natural language description
app.post('/api/ai/generate-record', auth, async (req, res) => {
  try {
    const { module, description, fields } = req.body;
    if (!description || !module) return res.status(400).json({ error: 'Module and description required' });

    const fieldDefs = (fields || []).map(f => {
      let def = `${f.key} (${f.label}, type: ${f.type}`;
      if (f.required) def += ', required';
      if (f.options) def += `, options: [${f.options.join(', ')}]`;
      def += ')';
      return def;
    }).join('\n');

    let ragContext = '';
    try {
      const similar = await searchSimilar(description, module, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a data entry assistant for an SAP CRM system. Given a natural language description, generate appropriate field values for a "${module}" record.

Available fields:
${fieldDefs}

User description: "${description}"
${ragContext}

Return ONLY a JSON object with field keys and values. Use exact option values for select fields. Use appropriate formats (dates as YYYY-MM-DD, numbers as plain numbers). Only include fields that can be reasonably inferred from the description. Do not include fields you cannot determine.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AI Check Duplicates - Find potential duplicate records
app.post('/api/ai/check-duplicates', auth, async (req, res) => {
  try {
    const { module, data } = req.body;
    if (!module || !data) return res.status(400).json({ duplicates: [] });
    if (!moduleNames.includes(module)) return res.status(400).json({ error: 'Invalid module' });

    const checkFields = ['name', 'first_name', 'last_name', 'email', 'company', 'account_name'];
    const validCols = await getValidColumns(module);
    const conditions = [];
    const params = [];

    checkFields.forEach(f => {
      if (data[f] && String(data[f]).trim() && validCols.includes(f)) {
        params.push(`%${data[f]}%`);
        conditions.push(`${f} ILIKE $${params.length}`);
      }
    });

    if (conditions.length === 0) return res.json({ duplicates: [] });

    const query = `SELECT * FROM ${module} WHERE ${conditions.join(' OR ')} LIMIT 5`;
    const result = await pool.query(query, params);
    res.json({ duplicates: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. AI Record Summary - Analyze a record and provide insights
app.post('/api/ai/record-summary', auth, async (req, res) => {
  try {
    const { module, record, fields } = req.body;
    if (!module || !record) return res.status(400).json({ error: 'Module and record required' });

    let crossContext = '';
    try {
      if (record.account_name) {
        const accts = await pool.query("SELECT * FROM accounts WHERE name ILIKE $1 LIMIT 1", [`%${record.account_name}%`]);
        if (accts.rows[0]) crossContext += `\nRelated Account: ${JSON.stringify(accts.rows[0])}`;
      }
      if (record.contact_name) {
        const contacts = await pool.query("SELECT * FROM contacts WHERE first_name ILIKE $1 OR last_name ILIKE $1 LIMIT 1", [`%${record.contact_name}%`]);
        if (contacts.rows[0]) crossContext += `\nRelated Contact: ${JSON.stringify(contacts.rows[0])}`;
      }
    } catch (e) { /* cross-context is optional */ }

    let ragContext = '';
    try {
      const recordPairs = Object.entries(record).filter(([k, v]) => v && String(v).trim()).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(', ');
      const similar = await searchSimilar(recordPairs, module, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are an AI analyst for SAP CRM. Analyze this ${module} record and provide insights.

Record data:
${JSON.stringify(record, null, 2)}
${crossContext}${ragContext}

Provide a concise analysis with these sections:
**Summary**: 2-3 sentence overview of this record
**Key Insights**: 3-4 bullet points of notable observations
**Next Best Actions**: 2-3 recommended next steps
**Risk Factors**: Any concerns or risks to flag

Keep it concise and actionable. Use markdown formatting.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate summary.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. AI Draft Email - Generate contextual email drafts
app.post('/api/ai/draft-email', auth, async (req, res) => {
  try {
    const { module, record } = req.body;
    if (!module || !record) return res.status(400).json({ error: 'Module and record required' });

    const recipientName = record.contact_name || record.customer_name || record.account_name || record.name || 'there';

    let ragContext = '';
    try {
      const emailQuery = [record.status, record.phase, record.priority, record.amount, record.total, record.name].filter(Boolean).join(' ');
      const similar = await searchSimilar(emailQuery || module, module, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are a professional business email writer for SAP CRM. Draft an appropriate email based on this ${module} record.

Record data:
${JSON.stringify(record, null, 2)}
${ragContext}

Write a professional email with:
- Subject line (prefix with "Subject: ")
- Appropriate greeting to ${recipientName}
- Body relevant to this ${module} record's current state and context
- Professional closing

The email should be contextually appropriate - e.g., follow-up for opportunities, status update for tickets, payment reminder for invoices, etc.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate email draft.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. AI Smart Search - Natural language to SQL search
app.post('/api/ai/smart-search', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.length < 3) return res.status(400).json({ error: 'Query too short' });

    const tableList = moduleNames.join(', ');
    const prompt = `You are a SQL query interpreter for an SAP CRM system. Convert this natural language query into structured search parameters.

Available tables: ${tableList}

User query: "${query}"

Return ONLY a JSON object with:
- "table": the most relevant table name (must be from the list above)
- "conditions": array of { "column": "col_name", "operator": "ILIKE", "value": "search_term" }
- "orderBy": column to sort by (optional)
- "orderDir": "ASC" or "DESC" (optional)
- "interpretation": brief human-readable interpretation of the query

Valid operators: =, ILIKE, >, <, >=, <=, IS NULL, IS NOT NULL
For ILIKE, wrap the value in % for partial matching.`;

    const aiResult = await callAI([{ role: 'user', content: prompt }]);
    const content = aiResult?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ results: [], interpretation: 'Could not interpret query' });

    const parsed = JSON.parse(jsonMatch[0]);
    const { table, conditions = [], orderBy, orderDir, interpretation } = parsed;

    if (!table || !moduleNames.includes(table)) {
      return res.json({ results: [], interpretation: interpretation || 'Invalid table', table });
    }

    const validCols = await getValidColumns(table);
    const allowedOps = ['=', 'ILIKE', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL'];
    const whereParts = [];
    const params = [];

    for (const cond of conditions) {
      if (!validCols.includes(cond.column)) continue;
      if (!allowedOps.includes(cond.operator)) continue;
      if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
        whereParts.push(`${cond.column} ${cond.operator}`);
      } else {
        params.push(cond.value);
        whereParts.push(`${cond.column} ${cond.operator} $${params.length}`);
      }
    }

    let sql = `SELECT * FROM ${table}`;
    if (whereParts.length > 0) sql += ` WHERE ${whereParts.join(' AND ')}`;

    const safeOrderBy = (orderBy && validCols.includes(orderBy)) ? orderBy : 'id';
    const safeDir = orderDir === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${safeOrderBy} ${safeDir} LIMIT 20`;

    const result = await pool.query(sql, params);
    res.json({ results: result.rows, table, interpretation, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ RAG ENDPOINTS ============

// Embed all published KB articles
app.post('/api/rag/embed-knowledge-base', auth, async (req, res) => {
  try {
    const articles = await pool.query("SELECT id, title, content, category FROM knowledge_base WHERE status = 'Published' OR status IS NULL");
    let total = 0;
    for (const article of articles.rows) {
      const text = `${article.title}\n\n${article.content || ''}`;
      const chunks = await embedAndStore('knowledge_base', String(article.id), text, { title: article.title, category: article.category });
      total += chunks;
    }
    res.json({ message: `Embedded ${articles.rows.length} KB articles into ${total} chunks`, articles: articles.rows.length, chunks: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Semantic search across embeddings
app.post('/api/rag/search', auth, async (req, res) => {
  try {
    const { query, sourceType, limit } = req.body;
    if (!query || query.trim().length < 2) return res.json({ results: [] });
    const results = await searchSimilar(query, sourceType || null, limit || 10);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload and embed a document (PDF or TXT)
app.post('/api/rag/upload-document', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, category } = req.body;
    const filename = req.file.originalname;
    const ext = path.extname(filename).toLowerCase();

    let content = '';
    if (ext === '.pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      content = pdfData.text;
    } else {
      content = req.file.buffer.toString('utf-8');
    }

    if (!content.trim()) return res.status(400).json({ error: 'Could not extract text from file' });

    const docResult = await pool.query(
      'INSERT INTO documents (title, filename, content, doc_type, category, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title || filename, filename, content, ext.replace('.', ''), category || 'General', req.user?.full_name || 'System']
    );
    const doc = docResult.rows[0];
    const chunks = await embedAndStore('document', String(doc.id), content, { title: doc.title, filename, category: doc.category });
    res.json({ document: doc, chunks_embedded: chunks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List uploaded documents
app.get('/api/rag/documents', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, filename, doc_type, category, uploaded_by, created_at FROM documents ORDER BY created_at DESC');
    res.json({ documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document and its embeddings
app.delete('/api/rag/documents/:id', auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM embeddings WHERE source_type = 'document' AND source_id = $1", [req.params.id]);
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document and embeddings deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Embed any record from any module
app.post('/api/rag/embed-record', auth, async (req, res) => {
  try {
    const { module, recordId } = req.body;
    if (!module || !recordId) return res.status(400).json({ error: 'Module and recordId required' });
    const record = await pool.query(`SELECT * FROM ${module} WHERE id = $1`, [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const text = Object.entries(record.rows[0]).map(([k, v]) => `${k}: ${v}`).join('\n');
    const chunks = await embedAndStore(module, String(recordId), text, { module });
    res.json({ message: `Embedded record ${recordId} from ${module}`, chunks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ENHANCED AI ENDPOINTS ============

// Ticket Auto-Classify with RAG
app.post('/api/ai/ticket-classify', auth, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Ticket title required' });

    // RAG: find similar past tickets and KB articles
    let ragContext = '';
    try {
      const similar = await searchSimilar(`${title} ${description || ''}`, null, 5);
      if (similar.length > 0) {
        ragContext = '\n\nSimilar past records for context:\n' + similar.map(s => `- [${s.source_type}] ${s.content_chunk.substring(0, 200)}`).join('\n');
      }
    } catch (e) { /* RAG optional */ }

    // Also get existing ticket categories for reference
    const categories = await pool.query('SELECT DISTINCT category FROM tickets WHERE category IS NOT NULL');
    const priorities = ['Very High', 'High', 'Medium', 'Low'];

    const prompt = `You are an AI ticket classification system for SAP CRM. Classify this support ticket.

Ticket Title: ${title}
Ticket Description: ${description || 'No description provided'}
${ragContext}

Available categories: ${categories.rows.map(c => c.category).join(', ')}
Available priorities: ${priorities.join(', ')}

Return ONLY a JSON object with:
{
  "category": "most appropriate category",
  "priority": "Very High|High|Medium|Low",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggested_resolution": "recommended steps to resolve",
  "estimated_effort": "Low|Medium|High",
  "tags": ["tag1", "tag2"]
}`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not classify' };
    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer 360 AI Summary
app.post('/api/ai/customer-360', auth, async (req, res) => {
  try {
    const { accountName } = req.body;
    if (!accountName) return res.status(400).json({ error: 'Account name required' });

    const [account, contacts, opps, tickets, orders, invoices] = await Promise.all([
      pool.query("SELECT * FROM accounts WHERE name ILIKE $1 LIMIT 1", [`%${accountName}%`]),
      pool.query("SELECT first_name, last_name, email, job_title, phone FROM contacts WHERE company ILIKE $1", [`%${accountName}%`]),
      pool.query("SELECT name, amount, phase, status, close_date, probability FROM opportunities WHERE account_name ILIKE $1", [`%${accountName}%`]),
      pool.query("SELECT title, status, priority, category, created_at FROM tickets WHERE account_name ILIKE $1 ORDER BY created_at DESC LIMIT 10", [`%${accountName}%`]),
      pool.query("SELECT order_number, total, status, order_date FROM orders WHERE account_name ILIKE $1", [`%${accountName}%`]),
      pool.query("SELECT invoice_number, total, status, due_date FROM invoices WHERE account_name ILIKE $1", [`%${accountName}%`]),
    ]);

    if (account.rows.length === 0) return res.json({ result: `No account found matching "${accountName}"` });

    let ragContext = '';
    try {
      const similar = await searchSimilar(accountName, null, 5);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const stats = {
      contacts: contacts.rows.length,
      opportunities: opps.rows.length,
      tickets: tickets.rows.length,
      orders: orders.rows.length,
      invoices: invoices.rows.length,
      totalPipeline: opps.rows.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0),
      totalRevenue: invoices.rows.filter(i => i.status === 'Paid').reduce((s, i) => s + (parseFloat(i.total) || 0), 0),
    };

    const prompt = `You are an AI customer intelligence analyst for SAP CRM. Provide a comprehensive 360-degree view of this customer.

Account: ${JSON.stringify(account.rows[0])}

Contacts (${contacts.rows.length}):
${contacts.rows.map(c => `- ${c.first_name} ${c.last_name} (${c.job_title || 'N/A'}) - ${c.email}`).join('\n') || 'None'}

Opportunities (${opps.rows.length}):
${opps.rows.map(o => `- ${o.name}: $${o.amount} (${o.phase}, ${o.status}, ${o.probability}% prob)`).join('\n') || 'None'}

Recent Tickets (${tickets.rows.length}):
${tickets.rows.map(t => `- [${t.priority}] ${t.title} (${t.status}, ${t.category})`).join('\n') || 'None'}

Orders (${orders.rows.length}):
${orders.rows.map(o => `- ${o.order_number}: $${o.total} (${o.status})`).join('\n') || 'None'}

Invoices (${invoices.rows.length}):
${invoices.rows.map(i => `- ${i.invoice_number}: $${i.total} (${i.status}, due ${i.due_date})`).join('\n') || 'None'}
${ragContext}

Provide:
1. **Customer Health Score** (1-100) with reasoning
2. **Executive Summary** - 3-4 sentence overview
3. **Revenue Analysis** - Total spend, trends, pipeline
4. **Relationship Map** - Key contacts and their roles
5. **Service Quality** - Ticket patterns, satisfaction signals
6. **Growth Opportunities** - Upsell/cross-sell potential
7. **Risk Factors** - Churn indicators, open issues
8. **Recommended Actions** - Top 5 next steps

Use specific numbers and data-driven insights.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate customer 360 view.';
    res.json({ result: content, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Recommendations (cross-sell/upsell)
app.post('/api/ai/recommendations', auth, async (req, res) => {
  try {
    const { accountName } = req.body;
    if (!accountName) return res.status(400).json({ error: 'Account name required' });

    const [orders, products, opps] = await Promise.all([
      pool.query("SELECT o.* FROM orders o WHERE o.account_name ILIKE $1", [`%${accountName}%`]),
      pool.query("SELECT name, category, price, status FROM products WHERE status = 'Active' LIMIT 50"),
      pool.query("SELECT name, amount, phase, status FROM opportunities WHERE account_name ILIKE $1", [`%${accountName}%`]),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar(accountName + ' products purchase recommendations upsell', 'products', 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are an AI sales advisor for SAP CRM. Generate cross-sell and upsell recommendations for this account.

Account: ${accountName}

Purchase History (${orders.rows.length} orders):
${orders.rows.map(o => `- ${o.order_number}: $${o.total} (${o.status}, ${o.order_date})`).join('\n') || 'No orders yet'}

Current Opportunities:
${opps.rows.map(o => `- ${o.name}: $${o.amount} (${o.phase})`).join('\n') || 'None'}

Available Products:
${products.rows.map(p => `- ${p.name} ($${p.price}, ${p.category})`).join('\n')}
${ragContext}

Return a JSON array of recommendations:
[
  {
    "type": "upsell|cross-sell|renewal",
    "product": "product name",
    "reason": "why this is recommended",
    "estimated_value": 0,
    "confidence": "high|medium|low",
    "action": "recommended next step"
  }
]

Provide 3-5 specific, actionable recommendations. Return ONLY the JSON array.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let recommendations = [];
    try {
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      // AI returned malformed JSON — return the raw text so user can still see something
      return res.json({ result: content, account: accountName });
    }
    res.json({ result: recommendations, account: accountName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workflow Suggestions
app.post('/api/ai/workflow-suggestions', auth, async (req, res) => {
  try {
    const [pendingApprovals, overdueTickets, staleOpps, expiringContracts, overBudgetProjects] = await Promise.all([
      pool.query("SELECT title, status, priority, created_at FROM tickets WHERE status = 'Pending' OR status = 'Waiting' ORDER BY created_at ASC LIMIT 10"),
      pool.query("SELECT title, priority, status, created_at, account_name FROM tickets WHERE priority IN ('Very High','High') AND status NOT IN ('Resolved','Closed') ORDER BY created_at ASC LIMIT 10"),
      pool.query("SELECT name, amount, phase, account_name, updated_at FROM opportunities WHERE status = 'Open' AND updated_at < NOW() - INTERVAL '14 days' ORDER BY amount DESC LIMIT 10"),
      pool.query("SELECT name, account_name, end_date, value FROM contracts WHERE status = 'Active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '60 days' ORDER BY end_date ASC LIMIT 10"),
      pool.query("SELECT name, budget, actual_cost, status, progress FROM projects WHERE actual_cost > budget AND budget > 0 AND status = 'In Progress' LIMIT 10"),
    ]);

    const stats = {
      pending_approvals: pendingApprovals.rows.length,
      overdue_tickets: overdueTickets.rows.length,
      stale_opportunities: staleOpps.rows.length,
      expiring_contracts: expiringContracts.rows.length,
      over_budget_projects: overBudgetProjects.rows.length,
    };

    let ragContext = '';
    try {
      const similar = await searchSimilar('workflow automation escalation resolution process best practice SLA', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are an AI workflow automation advisor for SAP CRM. Analyze the current business state and provide prioritized action recommendations.

Pending/Waiting Tickets (${pendingApprovals.rows.length}):
${pendingApprovals.rows.map(t => `- ${t.title} (${t.priority}, since ${t.created_at})`).join('\n') || 'None'}

High Priority Unresolved Tickets (${overdueTickets.rows.length}):
${overdueTickets.rows.map(t => `- ${t.title} (${t.priority}, ${t.account_name}, since ${t.created_at})`).join('\n') || 'None'}

Stale Opportunities (${staleOpps.rows.length}):
${staleOpps.rows.map(o => `- ${o.name}: $${o.amount} (${o.phase}, ${o.account_name}, last updated ${o.updated_at})`).join('\n') || 'None'}

Expiring Contracts (${expiringContracts.rows.length}):
${expiringContracts.rows.map(c => `- ${c.name} ($${c.value}, ${c.account_name}, expires ${c.end_date})`).join('\n') || 'None'}

Over-Budget Projects (${overBudgetProjects.rows.length}):
${overBudgetProjects.rows.map(p => `- ${p.name}: Budget $${p.budget}, Spent $${p.actual_cost} (${p.progress}% done)`).join('\n') || 'None'}
${ragContext}

Provide a prioritized action plan with:
1. **Critical Actions** (do today)
2. **High Priority** (this week)
3. **Medium Priority** (this month)
4. **Automation Suggestions** - processes that could be automated
5. **Resource Allocation** - where to focus team effort

Be specific with names, dollar amounts, and deadlines. Format with clear markdown headers and bullet points.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate workflow suggestions.';
    res.json({ result: content, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Anomaly Explanations
app.post('/api/ai/explain-anomalies', auth, async (req, res) => {
  try {
    const { anomalies } = req.body;
    if (!anomalies || anomalies.length === 0) return res.status(400).json({ error: 'No anomalies to explain' });

    // Gather supporting data for each anomaly
    let dataContext = '';
    for (const a of anomalies) {
      try {
        if (a.type === 'overdue_invoices') {
          const r = await pool.query("SELECT invoice_number, account_name, total, due_date, status FROM invoices WHERE status IN ('Pending','Overdue') AND due_date < NOW() ORDER BY total DESC LIMIT 5");
          dataContext += `\nOverdue Invoices Detail:\n${r.rows.map(i => `- ${i.invoice_number} (${i.account_name}): $${i.total}, due ${i.due_date}`).join('\n')}`;
        } else if (a.type === 'stale_opportunities') {
          const r = await pool.query("SELECT name, account_name, amount, phase, updated_at FROM opportunities WHERE status = 'Open' AND updated_at < NOW() - INTERVAL '30 days' ORDER BY amount DESC LIMIT 5");
          dataContext += `\nStale Opportunities Detail:\n${r.rows.map(o => `- ${o.name} (${o.account_name}): $${o.amount}, ${o.phase}, last updated ${o.updated_at}`).join('\n')}`;
        } else if (a.type === 'critical_tickets') {
          const r = await pool.query("SELECT title, account_name, priority, status, category, created_at FROM tickets WHERE priority IN ('Very High','High') AND status NOT IN ('Resolved','Closed') ORDER BY created_at ASC LIMIT 5");
          dataContext += `\nCritical Tickets Detail:\n${r.rows.map(t => `- ${t.title} (${t.account_name}): ${t.priority}, ${t.category}, since ${t.created_at}`).join('\n')}`;
        } else if (a.type === 'over_budget') {
          const r = await pool.query("SELECT name, budget, actual_cost, progress, status FROM projects WHERE actual_cost > budget AND budget > 0 AND status = 'In Progress' LIMIT 5");
          dataContext += `\nOver-Budget Projects Detail:\n${r.rows.map(p => `- ${p.name}: Budget $${p.budget}, Spent $${p.actual_cost} (${p.progress}% done)`).join('\n')}`;
        } else if (a.type === 'expiring_contracts') {
          const r = await pool.query("SELECT name, account_name, value, end_date FROM contracts WHERE status = 'Active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' ORDER BY end_date ASC LIMIT 5");
          dataContext += `\nExpiring Contracts Detail:\n${r.rows.map(c => `- ${c.name} (${c.account_name}): $${c.value}, expires ${c.end_date}`).join('\n')}`;
        }
      } catch (e) { /* data gathering is best-effort */ }
    }

    let ragContext = '';
    try {
      const anomalyQuery = anomalies.map(a => `${a.title} ${a.description || ''}`).join(' ');
      const similar = await searchSimilar(anomalyQuery, null, 5);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional enhancement */ }

    const prompt = `You are an AI root cause analyst for SAP CRM. Explain these business anomalies and provide corrective actions.

Detected Anomalies:
${anomalies.map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}

Supporting Data:${dataContext}
${ragContext}

For each anomaly, provide:
1. **Root Cause Analysis** - Why is this happening?
2. **Business Impact** - What's the financial/operational impact?
3. **Corrective Actions** - Specific steps to resolve
4. **Prevention** - How to prevent recurrence

Be specific with numbers, names, and actionable recommendations. Format with clear markdown.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to explain anomalies.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Dashboard Anomalies - Detect business anomalies across modules
app.get('/api/dashboard/anomalies', auth, async (req, res) => {
  try {
    const anomalies = [];

    // 1. Overdue invoices
    try {
      const r = await pool.query("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM invoices WHERE status IN ('Pending', 'Overdue') AND due_date < NOW()");
      if (parseInt(r.rows[0].cnt) > 0) {
        anomalies.push({ type: 'overdue_invoices', severity: 'high', title: `${r.rows[0].cnt} Overdue Invoices`, description: `$${Number(r.rows[0].total).toLocaleString()} in unpaid invoices past due date`, module: 'invoices' });
      }
    } catch (e) {}

    // 2. Stale opportunities
    try {
      const r = await pool.query("SELECT COUNT(*) as cnt FROM opportunities WHERE status = 'Open' AND updated_at < NOW() - INTERVAL '30 days'");
      if (parseInt(r.rows[0].cnt) > 0) {
        anomalies.push({ type: 'stale_opportunities', severity: 'medium', title: `${r.rows[0].cnt} Stale Opportunities`, description: 'Open opportunities not updated in 30+ days', module: 'opportunities' });
      }
    } catch (e) {}

    // 3. High priority unresolved tickets
    try {
      const r = await pool.query("SELECT COUNT(*) as cnt FROM tickets WHERE priority IN ('Very High', 'High') AND status NOT IN ('Resolved', 'Closed')");
      if (parseInt(r.rows[0].cnt) > 0) {
        anomalies.push({ type: 'critical_tickets', severity: 'high', title: `${r.rows[0].cnt} High Priority Tickets`, description: 'Unresolved tickets requiring immediate attention', module: 'tickets' });
      }
    } catch (e) {}

    // 4. Projects over budget
    try {
      const r = await pool.query("SELECT COUNT(*) as cnt FROM projects WHERE actual_cost > budget AND budget > 0 AND status = 'In Progress'");
      if (parseInt(r.rows[0].cnt) > 0) {
        anomalies.push({ type: 'over_budget', severity: 'medium', title: `${r.rows[0].cnt} Projects Over Budget`, description: 'Active projects where actual cost exceeds budget', module: 'projects' });
      }
    } catch (e) {}

    // 5. Contracts expiring within 30 days
    try {
      const r = await pool.query("SELECT COUNT(*) as cnt FROM contracts WHERE status = 'Active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'");
      if (parseInt(r.rows[0].cnt) > 0) {
        anomalies.push({ type: 'expiring_contracts', severity: 'medium', title: `${r.rows[0].cnt} Contracts Expiring Soon`, description: 'Active contracts expiring within the next 30 days', module: 'contracts' });
      }
    } catch (e) {}

    res.json({ anomalies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ DOCUMENT FLOW ============
const FLOW_CHAINS = {
  sales: {
    tables: ['quotes', 'orders', 'deliveries', 'billing_documents', 'payments'],
    links: [
      { from: 'quotes', to: 'orders', fromField: 'account_name', toField: 'account_name', numField: 'quote_number' },
      { from: 'orders', to: 'deliveries', fromField: 'order_number', toField: 'sales_order', numField: 'order_number' },
      { from: 'deliveries', to: 'billing_documents', fromField: 'customer_name', toField: 'customer_name', numField: 'delivery_number' },
      { from: 'billing_documents', to: 'payments', fromField: 'customer_name', toField: 'account_name', numField: 'billing_number' },
    ],
  },
  procurement: {
    tables: ['purchase_requisitions', 'purchase_orders', 'goods_receipts', 'accounts_payable'],
    links: [
      { from: 'purchase_requisitions', to: 'purchase_orders', fromField: 'material', toField: 'material', numField: 'pr_number' },
      { from: 'purchase_orders', to: 'goods_receipts', fromField: 'po_number', toField: 'po_number', numField: 'po_number' },
      { from: 'goods_receipts', to: 'accounts_payable', fromField: 'vendor_name', toField: 'vendor_name', numField: 'gr_number' },
    ],
  },
  production: {
    tables: ['bill_of_materials', 'production_orders', 'goods_receipts'],
    links: [
      { from: 'bill_of_materials', to: 'production_orders', fromField: 'material', toField: 'material', numField: 'bom_number' },
      { from: 'production_orders', to: 'goods_receipts', fromField: 'material', toField: 'material', numField: 'order_number' },
    ],
  },
};

app.get('/api/document-flow/:module/:id', auth, async (req, res) => {
  try {
    const { module: mod, id } = req.params;
    const record = await pool.query(`SELECT * FROM ${mod} WHERE id = $1`, [id]);
    if (record.rows.length === 0) return res.json({ steps: [] });
    const item = record.rows[0];

    // Determine which flow this module belongs to
    let flowType = null;
    for (const [type, chain] of Object.entries(FLOW_CHAINS)) {
      if (chain.tables.includes(mod)) { flowType = type; break; }
    }
    if (!flowType) return res.json({ steps: [] });

    const chain = FLOW_CHAINS[flowType];
    const steps = [];

    for (let i = 0; i < chain.tables.length; i++) {
      const table = chain.tables[i];
      if (table === mod) {
        const numField = chain.links.find(l => l.from === table)?.numField || 'id';
        steps.push({ found: true, number: item[numField] || `#${item.id}`, status: item.status || '' });
      } else {
        // Try to find linked record
        let found = null;
        try {
          // Find link connecting to this table
          const linkTo = chain.links.find(l => l.to === table);
          const linkFrom = chain.links.find(l => l.from === table);
          if (linkTo && item[linkTo.fromField]) {
            const r = await pool.query(`SELECT * FROM ${table} WHERE ${linkTo.toField} ILIKE $1 LIMIT 1`, [`%${item[linkTo.fromField]}%`]);
            if (r.rows.length > 0) {
              const numField = linkFrom?.numField || linkTo?.numField || 'id';
              found = { found: true, number: r.rows[0][numField] || `#${r.rows[0].id}`, status: r.rows[0].status || '' };
            }
          }
          if (!found && linkFrom && item[linkFrom.toField]) {
            const r = await pool.query(`SELECT * FROM ${table} WHERE ${linkFrom.fromField} ILIKE $1 LIMIT 1`, [`%${item[linkFrom.toField]}%`]);
            if (r.rows.length > 0) {
              const numField = linkFrom?.numField || 'id';
              found = { found: true, number: r.rows[0][numField] || `#${r.rows[0].id}`, status: r.rows[0].status || '' };
            }
          }
        } catch (e) { /* table might not exist */ }
        steps.push(found || { found: false });
      }
    }
    res.json({ steps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ENHANCED DASHBOARD STATS ============
app.get('/api/dashboard/enhanced-stats', auth, async (req, res) => {
  try {
    const results = {};

    // Invoices by status
    try {
      const r = await pool.query("SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM invoices GROUP BY status");
      results.invoices_by_status = r.rows;
    } catch (e) { results.invoices_by_status = []; }

    // Tickets by priority
    try {
      const r = await pool.query("SELECT priority, COUNT(*) as count FROM tickets WHERE status NOT IN ('Resolved', 'Closed') GROUP BY priority");
      results.tickets_by_priority = r.rows;
    } catch (e) { results.tickets_by_priority = []; }

    // Employees by department
    try {
      const r = await pool.query("SELECT department, COUNT(*) as count FROM employees WHERE status = 'Active' GROUP BY department ORDER BY count DESC");
      results.employees_by_dept = r.rows;
    } catch (e) { results.employees_by_dept = []; }

    // Expenses by category
    try {
      const r = await pool.query("SELECT category, COALESCE(SUM(total_amount), 0) as total FROM expense_reports GROUP BY category ORDER BY total DESC");
      results.expenses_by_category = r.rows;
    } catch (e) { results.expenses_by_category = []; }

    // Purchase orders by status
    try {
      const r = await pool.query("SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM purchase_orders GROUP BY status");
      results.po_by_status = r.rows;
    } catch (e) { results.po_by_status = []; }

    // Production orders by status
    try {
      const r = await pool.query("SELECT status, COUNT(*) as count FROM production_orders GROUP BY status");
      results.production_by_status = r.rows;
    } catch (e) { results.production_by_status = []; }

    // Opportunities by phase (pipeline)
    try {
      const r = await pool.query("SELECT phase as name, COUNT(*) as count, COALESCE(SUM(amount), 0) as value FROM opportunities WHERE status = 'Open' GROUP BY phase ORDER BY value DESC");
      results.pipeline = r.rows;
    } catch (e) { results.pipeline = []; }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SERVER-SIDE AGGREGATION ============
app.get('/api/:table/aggregate', auth, async (req, res) => {
  try {
    const { table } = req.params;
    const { groupBy, aggregate, valueField } = req.query;
    if (!groupBy || !aggregate) return res.status(400).json({ error: 'groupBy and aggregate are required' });
    if (!moduleNames.includes(table)) return res.status(404).json({ error: 'Invalid table' });

    let query;
    if (aggregate === 'count') {
      query = `SELECT ${groupBy} as name, COUNT(*) as value FROM ${table} WHERE ${groupBy} IS NOT NULL GROUP BY ${groupBy} ORDER BY value DESC LIMIT 20`;
    } else if (aggregate === 'sum' && valueField) {
      query = `SELECT ${groupBy} as name, COALESCE(SUM(CAST(${valueField} AS NUMERIC)), 0) as value FROM ${table} WHERE ${groupBy} IS NOT NULL GROUP BY ${groupBy} ORDER BY value DESC LIMIT 20`;
    } else {
      return res.status(400).json({ error: 'Invalid aggregate type' });
    }

    const r = await pool.query(query);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SAP ADVANCED FEATURES - NEW TABLES ============
async function initAdvancedTables() {
  try {
    // Ensure audit_logs has changes column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(100),
        entity_id VARCHAR(100),
        action VARCHAR(50),
        changes JSONB DEFAULT '[]',
        changed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    try { await pool.query('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT \'[]\''); } catch(e) {}
    try { await pool.query('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_by VARCHAR(255)'); } catch(e) {}
    try { await pool.query('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB DEFAULT \'{}\''); } catch(e) {}

    // Org Units
    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_units (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        org_type VARCHAR(100),
        parent_id INTEGER REFERENCES org_units(id),
        code VARCHAR(50),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Partner Functions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partner_functions (
        id SERIAL PRIMARY KEY,
        source_module VARCHAR(100),
        source_id INTEGER,
        role VARCHAR(100),
        partner_name VARCHAR(255),
        partner_module VARCHAR(100),
        partner_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Pricing Conditions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_conditions (
        id SERIAL PRIMARY KEY,
        condition_type VARCHAR(20),
        module VARCHAR(100),
        record_id INTEGER,
        description VARCHAR(255),
        amount DECIMAL(15,2) DEFAULT 0,
        percentage DECIMAL(8,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        valid_from DATE,
        valid_to DATE,
        step_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Batches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        batch_number VARCHAR(100),
        material VARCHAR(255),
        plant VARCHAR(100),
        quantity DECIMAL(15,2),
        manufacturing_date DATE,
        expiry_date DATE,
        quality_status VARCHAR(50) DEFAULT 'Released',
        module_ref VARCHAR(100),
        record_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Approval Steps
    await pool.query(`
      CREATE TABLE IF NOT EXISTS approval_steps (
        id SERIAL PRIMARY KEY,
        module VARCHAR(100),
        record_id INTEGER,
        step_order INTEGER DEFAULT 1,
        approver VARCHAR(255),
        delegate VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Pending',
        decision_date TIMESTAMP,
        comments TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Cross-Company Links
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_company_links (
        id SERIAL PRIMARY KEY,
        source_company VARCHAR(100),
        source_module VARCHAR(100),
        source_id INTEGER,
        target_company VARCHAR(100),
        target_module VARCHAR(100),
        target_id INTEGER,
        link_type VARCHAR(100) DEFAULT 'Intercompany',
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed org_units if empty
    const orgCount = await pool.query('SELECT COUNT(*) FROM org_units');
    if (parseInt(orgCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO org_units (name, org_type, parent_id, code, description, status) VALUES
        ('SAP Global Corp', 'Company Code', NULL, '1000', 'Global headquarters company code', 'Active'),
        ('US Operations', 'Company Code', 1, '1100', 'US subsidiary', 'Active'),
        ('EU Operations', 'Company Code', 1, '1200', 'European subsidiary', 'Active'),
        ('Plant Dallas', 'Plant', 2, 'DL01', 'Dallas manufacturing plant', 'Active'),
        ('Plant Chicago', 'Plant', 2, 'CH01', 'Chicago distribution center', 'Active'),
        ('Plant Munich', 'Plant', 3, 'MU01', 'Munich production facility', 'Active'),
        ('Domestic Sales', 'Sales Org', 2, 'SO10', 'US domestic sales organization', 'Active'),
        ('Export Sales', 'Sales Org', 2, 'SO20', 'International export sales', 'Active'),
        ('EU Sales', 'Sales Org', 3, 'SO30', 'European sales organization', 'Active'),
        ('Wholesale', 'Distribution Channel', 7, 'DC10', 'Wholesale distribution channel', 'Active'),
        ('Retail', 'Distribution Channel', 7, 'DC20', 'Retail distribution channel', 'Active'),
        ('Online', 'Distribution Channel', 8, 'DC30', 'E-commerce channel', 'Active')
      `);
    }

    console.log('Advanced SAP tables initialized');
  } catch (err) {
    console.log('Advanced tables init note:', err.message);
  }
}
initAdvancedTables();

// ============ BUSINESS LOGIC CONSTANTS ============
const FK_MAP = {
  products: [
    { target: 'bill_of_materials', field: 'material', sourceField: 'name' },
    { target: 'routings', field: 'material', sourceField: 'name' },
    { target: 'production_orders', field: 'material', sourceField: 'name' },
    { target: 'inventory', field: 'material', sourceField: 'name' },
    { target: 'purchase_orders', field: 'material', sourceField: 'name' },
  ],
  accounts: [
    { target: 'orders', field: 'account_name', sourceField: 'name' },
    { target: 'invoices', field: 'account_name', sourceField: 'name' },
    { target: 'contracts', field: 'account_name', sourceField: 'name' },
    { target: 'opportunities', field: 'account_name', sourceField: 'name' },
    { target: 'quotes', field: 'account_name', sourceField: 'name' },
  ],
  contacts: [
    { target: 'orders', field: 'contact_name', sourceField: 'name' },
    { target: 'activities', field: 'contact_name', sourceField: 'name' },
    { target: 'tickets', field: 'contact_name', sourceField: 'name' },
  ],
  vendors: [
    { target: 'purchase_orders', field: 'vendor_name', sourceField: 'name' },
    { target: 'invoices', field: 'vendor_name', sourceField: 'name' },
  ],
  work_centers: [
    { target: 'routings', field: 'work_center', sourceField: 'name' },
    { target: 'production_orders', field: 'work_center', sourceField: 'name' },
  ],
};

const MANDATORY_ROLES = {
  orders: ['Sold-To'],
  invoices: ['Sold-To', 'Bill-To'],
  deliveries: ['Sold-To', 'Ship-To'],
};

const VALID_CONDITION_TYPES = ['PR00', 'K004', 'K005', 'KF00', 'MWST', 'ZN00'];
const DISCOUNT_LIMITS = { K004: 30, K005: 15 };

function calculatePricing(conditions) {
  let runningTotal = 0;
  const breakdown = [];
  for (const c of conditions) {
    const amt = Number(c.amount) || 0;
    const pct = Number(c.percentage) || 0;
    const calculatedAmount = pct !== 0
      ? Math.round(runningTotal * pct / 100 * 100) / 100
      : amt;
    runningTotal = Math.round((runningTotal + calculatedAmount) * 100) / 100;
    breakdown.push({
      ...c,
      calculated_amount: calculatedAmount,
      running_total: runningTotal,
    });
  }
  return { breakdown, total: runningTotal };
}

const VALID_CC_TRANSITIONS = {
  'Draft': ['Active'],
  'Active': ['Reconciled'],
  'Reconciled': ['Closed'],
};

// ============ CHANGE HISTORY ============
app.get('/api/:table/:id/history', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const { dateFrom, dateTo, user, field } = req.query;
    let query = 'SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2';
    const params = [table, String(id)];
    let pIdx = 3;
    if (dateFrom) { query += ` AND created_at >= $${pIdx++}`; params.push(dateFrom); }
    if (dateTo) { query += ` AND created_at <= $${pIdx++}`; params.push(dateTo + 'T23:59:59'); }
    if (user) { query += ` AND changed_by ILIKE $${pIdx++}`; params.push(`%${user}%`); }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const result = await pool.query(query, params);
    let history = result.rows.map(row => ({
      ...row,
      changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : (row.changes || []),
      old_values: typeof row.old_values === 'string' ? JSON.parse(row.old_values) : (row.old_values || {}),
    }));
    if (field) {
      history = history.filter(h => h.changes.some(c => c.field === field));
    }
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback a change
app.post('/api/:table/:id/rollback/:auditId', auth, async (req, res) => {
  try {
    const { table, id, auditId } = req.params;
    if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const auditResult = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [auditId]);
    if (auditResult.rows.length === 0) return res.status(404).json({ error: 'Audit entry not found' });
    const audit = auditResult.rows[0];
    const oldValues = typeof audit.old_values === 'string' ? JSON.parse(audit.old_values) : (audit.old_values || {});
    if (Object.keys(oldValues).length === 0) return res.status(400).json({ error: 'No old values to rollback' });
    const currentResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const currentRecord = currentResult.rows[0];
    const validCols = await getValidColumns(table);
    const keys = Object.keys(oldValues).filter(k => validCols.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to rollback' });
    const values = keys.map(k => oldValues[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(id);
    await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${values.length}`, values);
    const rollbackChanges = keys.map(k => ({
      field: k,
      old_value: String(currentRecord[k] || ''),
      new_value: String(oldValues[k] || ''),
    }));
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, changes, changed_by, old_values, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [table, id, 'rollback', JSON.stringify(rollbackChanges), req.user?.email || 'system', JSON.stringify({})]
    );
    res.json({ message: 'Rollback successful', rolledBackFields: keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ WHERE-USED LISTS (FK-based) ============
app.get('/api/where-used/:module/:id', auth, async (req, res) => {
  try {
    const { module: mod, id } = req.params;
    const record = await pool.query(`SELECT * FROM ${mod} WHERE id = $1`, [id]);
    if (record.rows.length === 0) return res.json({ results: [] });
    const item = record.rows[0];
    const mappings = FK_MAP[mod];
    if (!mappings || mappings.length === 0) return res.json({ results: [] });
    const sourceValue = item[mappings[0].sourceField] || item.name || item.title || '';
    if (!sourceValue) return res.json({ results: [] });
    const results = [];
    for (const m of mappings) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${m.target} WHERE ${m.field} = $1`, [sourceValue]);
        const totalCount = parseInt(countResult.rows[0].count);
        if (totalCount > 0) {
          const found = await pool.query(`SELECT * FROM ${m.target} WHERE ${m.field} = $1 LIMIT 10`, [sourceValue]);
          results.push({
            module: m.target.replace(/_/g, ' '),
            moduleKey: m.target,
            field: m.field,
            totalCount,
            records: found.rows.map(r => ({
              id: r.id,
              name: r.name || r.title || r[m.field] || '',
              number: r.order_number || r.po_number || r.invoice_number || r.bom_number || '',
              status: r.status || '',
            })),
          });
        }
      } catch (e) { /* table may not exist */ }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ORG UNITS TREE ============
app.get('/api/org-units/tree', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM org_units ORDER BY id ASC');
    const nodes = result.rows;
    const map = {};
    nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
    const tree = [];
    nodes.forEach(n => {
      if (n.parent_id && map[n.parent_id]) {
        map[n.parent_id].children.push(map[n.id]);
      } else {
        tree.push(map[n.id]);
      }
    });
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ORG ASSIGNMENT ============
app.put('/api/:table/:id/org-assign', auth, async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });
    const orgUpdates = req.body;
    const orgFields = Object.keys(orgUpdates);
    if (orgFields.length === 0) return res.status(400).json({ error: 'No org fields provided' });
    for (const [field, value] of Object.entries(orgUpdates)) {
      if (!value) continue;
      const orgResult = await pool.query(
        'SELECT * FROM org_units WHERE (code = $1 OR name = $1) AND status = $2 LIMIT 1',
        [value, 'Active']
      );
      if (orgResult.rows.length === 0) {
        return res.status(400).json({ error: `Org unit "${value}" for field "${field}" not found or not Active` });
      }
    }
    const currentResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const currentRecord = currentResult.rows[0];
    const validCols = await getValidColumns(table);
    const keys = orgFields.filter(k => validCols.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid org fields found on this record' });
    const values = keys.map(k => orgUpdates[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(id);
    const result = await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    const changes = keys.map(k => ({
      field: k,
      old_value: String(currentRecord[k] || ''),
      new_value: String(orgUpdates[k] || ''),
    }));
    const old_values = {};
    for (const ch of changes) old_values[ch.field] = ch.old_value;
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, changes, changed_by, old_values, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [table, id, 'org_reassignment', JSON.stringify(changes), req.user?.email || 'system', JSON.stringify(old_values)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PARTNER FUNCTIONS ============
app.get('/api/partner-functions/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ results: [] });
    const results = [];
    for (const src of ['contacts', 'accounts', 'vendors']) {
      try {
        const found = await pool.query(`SELECT id, name FROM ${src} WHERE name ILIKE $1 LIMIT 10`, [`%${q}%`]);
        for (const r of found.rows) {
          results.push({ id: r.id, name: r.name, source: src });
        }
      } catch (e) { /* table may not exist */ }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/partner-functions/:module/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM partner_functions WHERE source_module = $1 AND source_id = $2 ORDER BY created_at ASC',
      [req.params.module, req.params.id]
    );
    const partners = result.rows;
    const mandatory = MANDATORY_ROLES[req.params.module] || [];
    const existingRoles = partners.map(p => p.role);
    const missingMandatory = mandatory.filter(r => !existingRoles.includes(r));
    res.json({ partners, mandatoryRoles: mandatory, missingMandatory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/partner-functions/:module/:id', auth, async (req, res) => {
  try {
    const { role, partner_name, partner_module, partner_id } = req.body;
    if (!role || !partner_name) return res.status(400).json({ error: 'Role and partner name are required' });
    const dupCheck = await pool.query(
      'SELECT id FROM partner_functions WHERE source_module = $1 AND source_id = $2 AND role = $3 AND partner_name = $4',
      [req.params.module, req.params.id, role, partner_name]
    );
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: `Duplicate: ${partner_name} already assigned as ${role}` });
    let partnerFound = false;
    for (const src of ['contacts', 'accounts', 'vendors']) {
      try {
        const pCheck = await pool.query(`SELECT id FROM ${src} WHERE name = $1 LIMIT 1`, [partner_name]);
        if (pCheck.rows.length > 0) { partnerFound = true; break; }
      } catch (e) {}
    }
    if (!partnerFound) return res.status(400).json({ error: `Partner "${partner_name}" not found in contacts, accounts, or vendors` });
    if (role === 'Ship-To' || role === 'Bill-To') {
      const soldTo = await pool.query(
        'SELECT id FROM partner_functions WHERE source_module = $1 AND source_id = $2 AND role = $3',
        [req.params.module, req.params.id, 'Sold-To']
      );
      if (soldTo.rows.length === 0) return res.status(400).json({ error: `${role} requires a Sold-To partner to be assigned first` });
    }
    const result = await pool.query(
      'INSERT INTO partner_functions (source_module, source_id, role, partner_name, partner_module, partner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.module, req.params.id, role, partner_name, partner_module || null, partner_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/partner-functions/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM partner_functions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PRICING CONDITIONS ============
app.get('/api/pricing-conditions/:module/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pricing_conditions WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC, id ASC',
      [req.params.module, req.params.id]
    );
    const { breakdown, total } = calculatePricing(result.rows);
    let parentStatus = null;
    try {
      const parent = await pool.query(`SELECT status FROM ${req.params.module} WHERE id = $1`, [req.params.id]);
      if (parent.rows.length > 0) parentStatus = parent.rows[0].status;
    } catch(e) {}
    res.json({ conditions: breakdown, total, parentStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pricing-conditions/:module/:id', auth, async (req, res) => {
  try {
    const { condition_type, description, amount, percentage, currency, valid_from, valid_to, step_order } = req.body;
    if (!VALID_CONDITION_TYPES.includes(condition_type)) {
      return res.status(400).json({ error: `Invalid condition type. Must be one of: ${VALID_CONDITION_TYPES.join(', ')}` });
    }
    try {
      const parent = await pool.query(`SELECT status FROM ${req.params.module} WHERE id = $1`, [req.params.id]);
      if (parent.rows.length > 0 && parent.rows[0].status === 'Approved') {
        return res.status(400).json({ error: 'Cannot modify pricing on an Approved record' });
      }
    } catch(e) {}
    const pct = Number(percentage) || 0;
    if (DISCOUNT_LIMITS[condition_type] && Math.abs(pct) > DISCOUNT_LIMITS[condition_type]) {
      return res.status(400).json({ error: `${condition_type} discount cannot exceed ${DISCOUNT_LIMITS[condition_type]}%` });
    }
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
    const cur = currency || 'USD';
    if (!validCurrencies.includes(cur)) {
      return res.status(400).json({ error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}` });
    }
    const countResult = await pool.query('SELECT COUNT(*) FROM pricing_conditions WHERE module = $1 AND record_id = $2', [req.params.module, req.params.id]);
    const order = step_order || (parseInt(countResult.rows[0].count) + 1) * 10;
    const result = await pool.query(
      'INSERT INTO pricing_conditions (condition_type, module, record_id, description, amount, percentage, currency, valid_from, valid_to, step_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [condition_type, req.params.module, req.params.id, description || '', amount || 0, pct, cur, valid_from || null, valid_to || null, order]
    );
    const allConditions = await pool.query(
      'SELECT * FROM pricing_conditions WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC, id ASC',
      [req.params.module, req.params.id]
    );
    const { total } = calculatePricing(allConditions.rows);
    try { await pool.query(`UPDATE ${req.params.module} SET total = $1 WHERE id = $2`, [total, req.params.id]); } catch(e) {}
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/pricing-conditions/:id', auth, async (req, res) => {
  try {
    const cond = await pool.query('SELECT * FROM pricing_conditions WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM pricing_conditions WHERE id = $1', [req.params.id]);
    if (cond.rows.length > 0) {
      const c = cond.rows[0];
      const allConditions = await pool.query(
        'SELECT * FROM pricing_conditions WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC, id ASC',
        [c.module, c.record_id]
      );
      const { total } = calculatePricing(allConditions.rows);
      try { await pool.query(`UPDATE ${c.module} SET total = $1 WHERE id = $2`, [total, c.record_id]); } catch(e) {}
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pricing-conditions/:module/:id/recalculate', auth, async (req, res) => {
  try {
    const allConditions = await pool.query(
      'SELECT * FROM pricing_conditions WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC, id ASC',
      [req.params.module, req.params.id]
    );
    const { breakdown, total } = calculatePricing(allConditions.rows);
    try { await pool.query(`UPDATE ${req.params.module} SET total = $1 WHERE id = $2`, [total, req.params.id]); } catch(e) {}
    res.json({ breakdown, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ BATCHES ============
app.get('/api/batches/:module/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM batches WHERE module_ref = $1 AND record_id = $2 ORDER BY expiry_date ASC NULLS LAST, created_at ASC',
      [req.params.module, req.params.id]
    );
    const now = new Date();
    const batches = [];
    let fifoSuggestion = null;
    for (const b of result.rows) {
      const daysRemaining = b.expiry_date
        ? Math.ceil((new Date(b.expiry_date) - now) / (1000 * 60 * 60 * 24))
        : null;
      let expiryUrgency = 'ok';
      if (daysRemaining !== null) {
        if (daysRemaining <= 0) expiryUrgency = 'expired';
        else if (daysRemaining <= 30) expiryUrgency = 'critical';
        else if (daysRemaining <= 90) expiryUrgency = 'warning';
      }
      if (expiryUrgency === 'expired' && b.quality_status !== 'Blocked') {
        await pool.query('UPDATE batches SET quality_status = $1 WHERE id = $2', ['Blocked', b.id]);
        b.quality_status = 'Blocked';
      }
      if (!fifoSuggestion && b.quality_status === 'Released' && (daysRemaining === null || daysRemaining > 0)) {
        fifoSuggestion = b.id;
      }
      batches.push({ ...b, days_remaining: daysRemaining, expiry_urgency: expiryUrgency });
    }
    res.json({ batches, fifoSuggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batches/:module/:id', auth, async (req, res) => {
  try {
    const { batch_number, material, plant, quantity, manufacturing_date, expiry_date, quality_status } = req.body;
    if (!batch_number) return res.status(400).json({ error: 'Batch number is required' });
    const dupCheck = await pool.query(
      'SELECT id FROM batches WHERE batch_number = $1 AND material = $2 AND plant = $3',
      [batch_number, material || '', plant || '']
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `Batch ${batch_number} already exists for this material/plant combination` });
    }
    let expiryWarning = null;
    if (expiry_date) {
      const daysUntil = Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) expiryWarning = 'This batch is already expired and will be auto-blocked';
      else if (daysUntil <= 30) expiryWarning = 'This batch expires within 30 days';
    }
    const result = await pool.query(
      'INSERT INTO batches (batch_number, material, plant, quantity, manufacturing_date, expiry_date, quality_status, module_ref, record_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [batch_number, material || '', plant || '', quantity || 0, manufacturing_date || null, expiry_date || null, quality_status || 'Released', req.params.module, req.params.id]
    );
    res.status(201).json({ ...result.rows[0], expiryWarning });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/batches/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM batches WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/batches/:id/hold', auth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['block', 'release'].includes(action)) return res.status(400).json({ error: 'Action must be "block" or "release"' });
    const newStatus = action === 'block' ? 'Blocked' : 'Released';
    const result = await pool.query('UPDATE batches SET quality_status = $1 WHERE id = $2 RETURNING *', [newStatus, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Batch not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CONFIG CHAIN ============
app.get('/api/config-chain/:module/:id', auth, async (req, res) => {
  try {
    const { module: mod, id } = req.params;
    const direction = req.query.direction || 'forward';
    const record = await pool.query(`SELECT * FROM ${mod} WHERE id = $1`, [id]);
    if (record.rows.length === 0) return res.json({ chain: [], hasBrokenChain: true });
    const item = record.rows[0];
    const material = item.material || item.name || '';
    let chainModules = ['products', 'bill_of_materials', 'routings', 'work_centers', 'production_orders'];
    if (direction === 'reverse') chainModules = chainModules.reverse();
    const chain = [];
    let hasBrokenChain = false;
    let lastFoundMaterial = material;
    for (const cm of chainModules) {
      try {
        let found = null;
        if (cm === mod) {
          found = { found: true, module: cm, id: item.id, name: item.name || item.title || '', material: item.material || '', status: item.status || '', work_center: item.work_center || '', fields: {} };
          if (item.quantity) found.fields.quantity = item.quantity;
          if (item.created_at) found.fields.created = new Date(item.created_at).toLocaleDateString();
        } else {
          let searchField = 'material';
          let searchValue = lastFoundMaterial;
          if (cm === 'work_centers') {
            const prevRouting = chain.find(n => n.module === 'routings' && n.found);
            if (prevRouting && prevRouting.work_center) {
              searchField = 'name';
              searchValue = prevRouting.work_center;
            }
          }
          if (searchValue) {
            const r = await pool.query(`SELECT * FROM ${cm} WHERE ${searchField} = $1 LIMIT 1`, [searchValue]);
            if (r.rows.length > 0) {
              found = {
                found: true, module: cm, id: r.rows[0].id,
                name: r.rows[0].name || r.rows[0].title || '',
                number: r.rows[0].bom_number || r.rows[0].order_number || '',
                material: r.rows[0].material || '',
                status: r.rows[0].status || '',
                work_center: r.rows[0].work_center || '',
                fields: {},
              };
              if (r.rows[0].quantity) found.fields.quantity = r.rows[0].quantity;
              if (r.rows[0].created_at) found.fields.created = new Date(r.rows[0].created_at).toLocaleDateString();
              if (r.rows[0].material) lastFoundMaterial = r.rows[0].material;
            }
          }
        }
        if (!found) {
          hasBrokenChain = true;
          chain.push({ found: false, module: cm });
        } else {
          chain.push(found);
        }
      } catch (e) {
        hasBrokenChain = true;
        chain.push({ found: false, module: cm });
      }
    }
    res.json({ chain, hasBrokenChain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ APPROVAL STEPS ============
app.get('/api/approval-steps/:module/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM approval_steps WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC',
      [req.params.module, req.params.id]
    );
    const steps = result.rows;
    const total = steps.length;
    const approved = steps.filter(s => s.status === 'Approved').length;
    const rejected = steps.some(s => s.status === 'Rejected');
    const currentStepIdx = steps.findIndex(s => s.status === 'Pending');
    const currentStep = currentStepIdx >= 0 ? currentStepIdx + 1 : (rejected ? -1 : total);
    const now = new Date();
    for (const step of steps) {
      if (step.status === 'Pending') {
        const created = new Date(step.created_at);
        const hoursPending = Math.round((now - created) / (1000 * 60 * 60) * 10) / 10;
        step.hours_pending = hoursPending;
        step.escalation_due = hoursPending >= 48;
        step.hours_until_escalation = Math.max(0, Math.round((48 - hoursPending) * 10) / 10);
        if (hoursPending >= 48 && step.delegate) step.escalated = true;
      }
    }
    let overallStatus = 'Pending';
    if (approved === total && total > 0) overallStatus = 'Approved';
    else if (rejected) overallStatus = 'Rejected';
    else if (approved > 0) overallStatus = 'In Progress';
    res.json({ steps, progress: { total, approved, currentStep }, overallStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/approval-steps/:module/:id', auth, async (req, res) => {
  try {
    const { step_order, approver, delegate, status, comments } = req.body;
    if (!approver) return res.status(400).json({ error: 'Approver is required' });
    const result = await pool.query(
      'INSERT INTO approval_steps (module, record_id, step_order, approver, delegate, status, comments) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.params.module, req.params.id, step_order || 1, approver, delegate || null, status || 'Pending', comments || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/approval-steps/:id', auth, async (req, res) => {
  try {
    const { status, decision_date, comments } = req.body;
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }
    const stepResult = await pool.query('SELECT * FROM approval_steps WHERE id = $1', [req.params.id]);
    if (stepResult.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    const step = stepResult.rows[0];
    if (step.status !== 'Pending') return res.status(400).json({ error: `Cannot change a ${step.status} step` });
    const priorSteps = await pool.query(
      'SELECT * FROM approval_steps WHERE module = $1 AND record_id = $2 AND step_order < $3 ORDER BY step_order ASC',
      [step.module, step.record_id, step.step_order]
    );
    const allPriorApproved = priorSteps.rows.every(s => s.status === 'Approved');
    if (!allPriorApproved) {
      return res.status(400).json({ error: 'All prior steps must be Approved before this step can be decided' });
    }
    const result = await pool.query(
      'UPDATE approval_steps SET status = $1, decision_date = $2, comments = COALESCE($3, comments) WHERE id = $4 RETURNING *',
      [status, decision_date || new Date().toISOString(), comments, req.params.id]
    );
    const allSteps = await pool.query(
      'SELECT * FROM approval_steps WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC',
      [step.module, step.record_id]
    );
    const allApproved = allSteps.rows.every(s => s.status === 'Approved');
    const anyRejected = allSteps.rows.some(s => s.status === 'Rejected');
    try {
      if (allApproved) {
        await pool.query(`UPDATE ${step.module} SET status = 'Approved' WHERE id = $1`, [step.record_id]);
      } else if (anyRejected) {
        await pool.query(`UPDATE ${step.module} SET status = 'Rejected' WHERE id = $1`, [step.record_id]);
      }
    } catch (e) {}
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/approval-steps/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM approval_steps WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/approval-steps/:id/recall', auth, async (req, res) => {
  try {
    const stepResult = await pool.query('SELECT * FROM approval_steps WHERE id = $1', [req.params.id]);
    if (stepResult.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    const step = stepResult.rows[0];
    if (step.status !== 'Pending') return res.status(400).json({ error: 'Can only recall Pending steps' });
    await pool.query('DELETE FROM approval_steps WHERE id = $1', [req.params.id]);
    const remaining = await pool.query(
      'SELECT id FROM approval_steps WHERE module = $1 AND record_id = $2 ORDER BY step_order ASC',
      [step.module, step.record_id]
    );
    for (let i = 0; i < remaining.rows.length; i++) {
      await pool.query('UPDATE approval_steps SET step_order = $1 WHERE id = $2', [i + 1, remaining.rows[i].id]);
    }
    res.json({ message: 'Step recalled and remaining steps re-ordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CROSS-COMPANY LINKS ============
app.get('/api/cross-company/:module/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cross_company_links WHERE (source_module = $1 AND source_id = $2) OR (target_module = $1 AND target_id = $2) ORDER BY created_at ASC',
      [req.params.module, req.params.id]
    );
    const links = [];
    for (const link of result.rows) {
      let targetRecord = null;
      try {
        const tr = await pool.query(`SELECT id, name, title, status FROM ${link.target_module} WHERE id = $1`, [link.target_id]);
        if (tr.rows.length > 0) targetRecord = { name: tr.rows[0].name || tr.rows[0].title || '', status: tr.rows[0].status || '' };
      } catch(e) {}
      links.push({ ...link, targetRecord });
    }
    res.json({ links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cross-company/:module/:id', auth, async (req, res) => {
  try {
    const { source_company, target_company, target_module, target_id, link_type } = req.body;
    if (!target_company || !target_module) return res.status(400).json({ error: 'Target company and module are required' });
    if (target_module === req.params.module && String(target_id) === String(req.params.id) && source_company === target_company) {
      return res.status(400).json({ error: 'Cannot create a cross-company link to the same record' });
    }
    if (target_id) {
      try {
        const targetCheck = await pool.query(`SELECT id FROM ${target_module} WHERE id = $1`, [target_id]);
        if (targetCheck.rows.length === 0) {
          return res.status(400).json({ error: `Target record #${target_id} not found in ${target_module}` });
        }
      } catch(e) {
        return res.status(400).json({ error: `Target module "${target_module}" not found` });
      }
    }
    const result = await pool.query(
      'INSERT INTO cross_company_links (source_company, source_module, source_id, target_company, target_module, target_id, link_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [source_company || '', req.params.module, req.params.id, target_company, target_module, target_id || null, link_type || 'Intercompany', 'Draft']
    );
    if (target_id) {
      await pool.query(
        'INSERT INTO cross_company_links (source_company, source_module, source_id, target_company, target_module, target_id, link_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [target_company, target_module, target_id, source_company || '', req.params.module, req.params.id, link_type || 'Intercompany', 'Draft']
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cross-company/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const linkResult = await pool.query('SELECT * FROM cross_company_links WHERE id = $1', [req.params.id]);
    if (linkResult.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    const link = linkResult.rows[0];
    const validTransitions = VALID_CC_TRANSITIONS[link.status] || [];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${link.status} to ${status}. Valid: ${validTransitions.join(', ') || 'none'}` });
    }
    const result = await pool.query('UPDATE cross_company_links SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    await pool.query(
      'UPDATE cross_company_links SET status = $1 WHERE source_module = $2 AND source_id = $3 AND target_module = $4 AND target_id = $5',
      [status, link.target_module, link.target_id, link.source_module, link.source_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cross-company/:id', auth, async (req, res) => {
  try {
    const linkResult = await pool.query('SELECT * FROM cross_company_links WHERE id = $1', [req.params.id]);
    if (linkResult.rows.length > 0) {
      const link = linkResult.rows[0];
      await pool.query(
        'DELETE FROM cross_company_links WHERE source_module = $1 AND source_id = $2 AND target_module = $3 AND target_id = $4',
        [link.target_module, link.target_id, link.source_module, link.source_id]
      );
    }
    await pool.query('DELETE FROM cross_company_links WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ADVANCED RAG AI FEATURES (15 New Endpoints) ============

// 1. Conversational RAG - Grounded answers from documents/KB with source citations
app.post('/api/ai/conversational-rag', auth, async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    let sources = [];
    let ragContext = '';
    try {
      const similar = await searchSimilar(question, null, 6);
      if (similar.length > 0) {
        sources = similar.map((s, i) => ({
          id: i + 1,
          source_type: s.source_type,
          source_id: s.source_id,
          chunk: s.content_chunk.substring(0, 400),
          similarity: s.similarity,
          metadata: s.metadata
        }));
        ragContext = '\n\nRelevant documents from knowledge base (CITE these by [Source N] when used):\n' +
          sources.map(s => `[Source ${s.id}] (${s.source_type}) ${s.chunk}`).join('\n---\n');
      }
    } catch (e) { /* RAG optional */ }

    const messages = [
      { role: 'system', content: `You are a knowledgeable SAP CRM assistant. Answer questions based on the provided context documents. Always cite your sources using [Source N] notation. If the context doesn't contain enough information, say so.${ragContext}` }
    ];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
      }
    }
    messages.push({ role: 'user', content: question });

    const result = await callAI(messages);
    const answer = result?.choices?.[0]?.message?.content || 'Unable to find an answer in the knowledge base.';
    res.json({ result: answer, sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AI Approval Routing - Suggest approval chains based on historical patterns
app.post('/api/ai/approval-routing', auth, async (req, res) => {
  try {
    const { module, recordType, amount, department } = req.body;

    let approvals = { rows: [] };
    const employees = await pool.query("SELECT first_name, last_name, department, position FROM employees WHERE status = 'Active' ORDER BY department");
    try {
      approvals = await pool.query('SELECT step_name, approver_name, status, module, decided_at FROM approval_steps ORDER BY created_at DESC LIMIT 50');
    } catch (e) { /* approval_steps table may not exist yet */ }

    let ragContext = '';
    try {
      const similar = await searchSimilar(`approval workflow ${module || ''} ${department || ''} routing chain hierarchy`, null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG optional */ }

    const prompt = `You are an approval workflow expert for SAP CRM. Based on historical approval patterns and organizational structure, suggest an optimal approval routing chain.

Document Type: ${recordType || module || 'General'}
Amount/Value: ${amount || 'Not specified'}
Department: ${department || 'Not specified'}

Historical Approval Patterns:
${approvals.rows.map(a => `- ${a.step_name}: ${a.approver_name} (${a.module}, ${a.status})`).join('\n') || 'No history'}

Available Approvers:
${employees.rows.slice(0, 30).map(e => `- ${e.first_name} ${e.last_name} (${e.position}, ${e.department})`).join('\n')}
${ragContext}

Return a JSON object:
{
  "suggested_chain": [
    { "step": 1, "approver": "name", "role": "position", "reason": "why this person" }
  ],
  "estimated_time": "estimated approval duration",
  "notes": "any special considerations",
  "alternative_chain": [
    { "step": 1, "approver": "name", "role": "position", "reason": "alternative option" }
  ]
}
Return ONLY the JSON object.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Predictive Inventory - Forecast stock needs from order/delivery history
app.post('/api/ai/predictive-inventory', auth, async (req, res) => {
  try {
    const [orders, inventory, deliveries, products] = await Promise.all([
      pool.query('SELECT order_number, account_name, total, status, order_date FROM orders ORDER BY order_date DESC LIMIT 50'),
      pool.query('SELECT * FROM inventory LIMIT 50'),
      pool.query('SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 30'),
      pool.query("SELECT name, category, price, status FROM products WHERE status = 'Active' LIMIT 40"),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar('inventory stock forecast demand supply order delivery seasonal pattern', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG optional */ }

    const prompt = `You are a supply chain and inventory planning AI for SAP CRM. Analyze the data and provide predictive inventory forecasts.

Recent Orders (${orders.rows.length}):
${orders.rows.map(o => `- ${o.order_number}: $${o.total} (${o.status}, ${o.order_date})`).join('\n') || 'None'}

Current Inventory (${inventory.rows.length} items):
${inventory.rows.map(i => `- ${i.description || i.material_number || 'Item'}: Qty=${i.quantity || 'N/A'}, Location=${i.storage_location || i.plant || 'N/A'}`).join('\n') || 'None'}

Recent Deliveries (${deliveries.rows.length}):
${deliveries.rows.map(d => `- ${d.delivery_number || 'N/A'}: Status=${d.status || 'N/A'}`).join('\n') || 'None'}

Active Products (${products.rows.length}):
${products.rows.slice(0, 20).map(p => `- ${p.name}: $${p.price} (${p.category})`).join('\n')}
${ragContext}

Provide:
1. **Demand Forecast** - Expected demand for next 30/60/90 days
2. **Reorder Recommendations** - Items that need restocking with suggested quantities
3. **Seasonal Patterns** - Any detected seasonality in ordering
4. **Risk Items** - Products at risk of stockout or overstock
5. **Optimization Suggestions** - How to reduce carrying costs while maintaining service levels

Use specific numbers and data-driven recommendations.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate inventory forecast.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Contract Clause Analysis - RAG over contracts, extract key terms/risks
app.post('/api/ai/contract-clause-analysis', auth, async (req, res) => {
  try {
    const { contractId, contractText } = req.body;

    let contractInfo = {};
    if (contractId) {
      try {
        const c = await pool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        if (c.rows[0]) contractInfo = c.rows[0];
      } catch (e) {}
    }

    let sources = [];
    let ragContext = '';
    try {
      const searchQuery = contractText
        ? contractText.substring(0, 200)
        : `contract ${contractInfo.name || ''} ${contractInfo.account_name || ''} terms clauses obligations risks`;
      const similar = await searchSimilar(searchQuery, null, 5);
      if (similar.length > 0) {
        sources = similar.map((s, i) => ({
          id: i + 1,
          source_type: s.source_type,
          chunk: s.content_chunk.substring(0, 300),
          similarity: s.similarity
        }));
        ragContext = '\n\nRelated contract knowledge and documents:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 400)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a contract analysis AI for SAP CRM. Analyze this contract and extract key terms, risks, and obligations.

Contract Information:
${contractInfo.name ? `Name: ${contractInfo.name}` : ''}
${contractInfo.account_name ? `Account: ${contractInfo.account_name}` : ''}
${contractInfo.value ? `Value: $${contractInfo.value}` : ''}
${contractInfo.start_date ? `Start: ${contractInfo.start_date}` : ''}
${contractInfo.end_date ? `End: ${contractInfo.end_date}` : ''}
${contractInfo.status ? `Status: ${contractInfo.status}` : ''}
${contractText ? `\nContract Text:\n${contractText.substring(0, 3000)}` : ''}
${ragContext}

Provide:
1. **Key Terms Summary** - Main obligations and deliverables
2. **Financial Terms** - Payment terms, penalties, escalation clauses
3. **Risk Assessment** - Identified risks (High/Medium/Low) with explanations
4. **Compliance Flags** - Any regulatory or compliance concerns
5. **Renewal & Termination** - Key dates, auto-renewal clauses, exit conditions
6. **Recommended Actions** - Specific steps before signing/renewing

Format with clear markdown headers and risk severity indicators.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to analyze contract.';
    res.json({ result: content, sources, contractInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Intelligent Matching - Auto-match POs to invoices to GR using embeddings
app.post('/api/ai/intelligent-matching', auth, async (req, res) => {
  try {
    const { documentType, documentId } = req.body;

    let sourceDoc = {};
    let sourceText = '';
    try {
      if (documentType === 'purchase_orders') {
        const r = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [documentId]);
        sourceDoc = r.rows[0] || {};
        sourceText = `Purchase Order: ${sourceDoc.po_number || 'N/A'} Vendor: ${sourceDoc.vendor_name || 'N/A'} Total: $${sourceDoc.total || 0}`;
      } else if (documentType === 'invoices') {
        const r = await pool.query('SELECT * FROM invoices WHERE id = $1', [documentId]);
        sourceDoc = r.rows[0] || {};
        sourceText = `Invoice: ${sourceDoc.invoice_number || 'N/A'} Account: ${sourceDoc.account_name || 'N/A'} Total: $${sourceDoc.total || 0}`;
      } else if (documentType === 'goods_receipts') {
        const r = await pool.query('SELECT * FROM goods_receipts WHERE id = $1', [documentId]);
        sourceDoc = r.rows[0] || {};
        sourceText = `Goods Receipt: ${sourceDoc.gr_number || 'N/A'} Vendor: ${sourceDoc.vendor_name || 'N/A'}`;
      }
    } catch (e) {}

    let matches = [];
    try {
      const similar = await searchSimilar(sourceText || `${documentType} ${documentId}`, null, 10);
      matches = similar.filter(s => s.source_type !== documentType).map(s => ({
        source_type: s.source_type,
        source_id: s.source_id,
        content: s.content_chunk.substring(0, 300),
        similarity: s.similarity
      }));
    } catch (e) {}

    const prompt = `You are an intelligent document matching AI for SAP CRM. Analyze the source document and potential matches for three-way matching (PO - Invoice - Goods Receipt).

Source Document:
${JSON.stringify(sourceDoc, null, 2)}

Potential Matches (by embedding similarity):
${matches.map((m, i) => `${i + 1}. [${m.source_type}] (${(m.similarity * 100).toFixed(1)}% match): ${m.content}`).join('\n')}

Provide:
1. **Best Matches** - Ranked list with confidence scores
2. **Match Reasoning** - Why each match is suggested
3. **Discrepancies** - Amount, date, or quantity mismatches
4. **Unmatched Items** - Documents that couldn't be matched
5. **Recommendations** - Next steps for reconciliation

Format with clear markdown.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to perform matching.';
    res.json({ result: content, sourceDoc, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Natural Language Reporting - NL to SQL, execute, return data + chart
app.post('/api/ai/nl-reporting', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.length < 5) return res.status(400).json({ error: 'Query too short' });

    const tableList = moduleNames.join(', ');

    const sqlPrompt = `You are a SQL expert for SAP CRM PostgreSQL database. Convert this natural language query into a SQL query.

Available tables: ${tableList}

Key table schemas:
- accounts: id, name, industry, website, phone, email, city, country, annual_revenue, employee_count, account_type, status
- contacts: id, first_name, last_name, email, phone, company, job_title, department, city, country, status
- opportunities: id, name, account_name, contact_name, amount, phase, probability, close_date, source, status
- orders: id, order_number, account_name, contact_name, amount, tax, total, status, order_date, delivery_date
- tickets: id, ticket_number, title, contact_name, account_name, priority, category, status, assigned_to
- invoices: id, invoice_number, account_name, contact_name, amount, tax, total, status, due_date
- leads: id, first_name, last_name, email, company, job_title, source, qualification, estimated_value, status
- products: id, name, material_number, category, price, cost, quantity_in_stock, unit, status
- contracts: id, contract_number, name, account_name, type, value, start_date, end_date, status
- projects: id, name, account_name, manager, priority, status, start_date, end_date, budget, actual_cost, progress
- employees: id, first_name, last_name, email, department, position, manager, salary, status

IMPORTANT: There is NO account_id column in any table. Use account_name for account references. The contacts table uses "company" (not account_name). The accounts table uses "name" (not account_name).

User query: "${query}"

Return ONLY a JSON object:
{
  "sql": "SELECT ... (safe read-only query, use LIMIT 100)",
  "chart_type": "bar|line|pie|table",
  "title": "Chart title",
  "x_label": "X axis label",
  "y_label": "Y axis label",
  "interpretation": "What this query answers"
}
IMPORTANT: Only generate SELECT queries. Never UPDATE, DELETE, INSERT, DROP, ALTER, or TRUNCATE.`;

    const sqlResult = await callAI([{ role: 'user', content: sqlPrompt }]);
    const sqlContent = sqlResult?.choices?.[0]?.message?.content || '{}';
    const sqlMatch = sqlContent.match(/\{[\s\S]*\}/);
    if (!sqlMatch) return res.json({ result: 'Could not generate query.', data: [] });

    const parsed = JSON.parse(sqlMatch[0]);
    const { sql, chart_type, title, x_label, y_label, interpretation } = parsed;

    const upperSql = (sql || '').toUpperCase().trim();
    if (!upperSql.startsWith('SELECT') || /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE)\b/.test(upperSql)) {
      return res.json({ result: 'Only SELECT queries are allowed.', data: [] });
    }

    let data = [];
    try {
      const queryResult = await pool.query(sql);
      data = queryResult.rows;
    } catch (e) {
      return res.json({ result: `Query error: ${e.message}`, sql, data: [] });
    }

    let ragContext = '';
    try {
      const similar = await searchSimilar(query, null, 3);
      if (similar.length > 0) {
        ragContext = '\nRelevant context:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 200)}`).join('\n---\n');
      }
    } catch (e) {}

    let analysis = interpretation || '';
    try {
      const analysisPrompt = `Analyze these query results and provide a brief insight (2-3 sentences):
Query: ${query}
Results (${data.length} rows): ${JSON.stringify(data.slice(0, 20))}${ragContext}`;
      const analysisResult = await callAI([{ role: 'user', content: analysisPrompt }]);
      analysis = analysisResult?.choices?.[0]?.message?.content || interpretation || '';
    } catch (e) {}

    res.json({ result: analysis, data, sql, chart_type: chart_type || 'table', title: title || query, x_label, y_label });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. AI Data Quality - Detect missing fields, inconsistencies, stale records
app.post('/api/ai/data-quality', auth, async (req, res) => {
  try {
    const checks = [];
    const qualityChecks = [
      { table: 'contacts', field: 'email', label: 'Contacts missing email' },
      { table: 'contacts', field: 'phone', label: 'Contacts missing phone' },
      { table: 'accounts', field: 'industry', label: 'Accounts missing industry' },
      { table: 'leads', field: 'source', label: 'Leads missing source' },
      { table: 'leads', field: 'estimated_value', label: 'Leads missing est. value' },
      { table: 'opportunities', field: 'close_date', label: 'Opportunities missing close date' },
      { table: 'opportunities', field: 'probability', label: 'Opportunities missing probability' },
      { table: 'tickets', field: 'priority', label: 'Tickets missing priority' },
      { table: 'vendors', field: 'email', label: 'Vendors missing contact email' },
      { table: 'products', field: 'category', label: 'Products missing category' },
    ];

    for (const qc of qualityChecks) {
      try {
        const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${qc.table} WHERE ${qc.field} IS NULL OR TRIM(${qc.field}::text) = ''`);
        const count = parseInt(r.rows[0].cnt);
        if (count > 0) {
          checks.push({ table: qc.table, field: qc.field, label: qc.label, count, severity: count > 10 ? 'high' : count > 3 ? 'medium' : 'low' });
        }
      } catch (e) { /* table/field may not exist */ }
    }

    try {
      const stale = await pool.query("SELECT COUNT(*) as cnt FROM opportunities WHERE status = 'Open' AND updated_at < NOW() - INTERVAL '60 days'");
      const cnt = parseInt(stale.rows[0].cnt);
      if (cnt > 0) checks.push({ table: 'opportunities', field: 'updated_at', label: 'Stale opportunities (60+ days)', count: cnt, severity: 'high' });
    } catch (e) {}

    try {
      const stale = await pool.query("SELECT COUNT(*) as cnt FROM leads WHERE status NOT IN ('Converted', 'Lost', 'Disqualified') AND updated_at < NOW() - INTERVAL '30 days'");
      const cnt = parseInt(stale.rows[0].cnt);
      if (cnt > 0) checks.push({ table: 'leads', field: 'updated_at', label: 'Stale leads (30+ days)', count: cnt, severity: 'medium' });
    } catch (e) {}

    try {
      const dupes = await pool.query("SELECT email, COUNT(*) as cnt FROM contacts WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING COUNT(*) > 1");
      if (dupes.rows.length > 0) checks.push({ table: 'contacts', field: 'email', label: 'Duplicate contact emails', count: dupes.rows.length, severity: 'high' });
    } catch (e) {}

    let ragContext = '';
    try {
      const similar = await searchSimilar('data quality missing fields stale records duplicates cleanup best practice', null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) {}

    const totalIssues = checks.reduce((s, c) => s + c.count, 0);
    const prompt = `You are a data quality analyst for SAP CRM. Analyze these data quality issues and provide recommendations.

Data Quality Issues Found:
${checks.map(c => `- [${c.severity.toUpperCase()}] ${c.label}: ${c.count} records (${c.table}.${c.field})`).join('\n') || 'No issues found!'}

Total Issues: ${totalIssues}
${ragContext}

Provide:
1. **Quality Score** (0-100) based on severity and volume of issues
2. **Priority Actions** - Top 5 fixes ranked by business impact
3. **Quick Wins** - Issues fixable with bulk updates
4. **Root Causes** - Why these issues likely occurred
5. **Prevention Plan** - Validation rules and processes to prevent recurrence

Be specific with table names, field names, and record counts.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to analyze data quality.';
    res.json({ result: content, checks, totalIssues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Vendor Risk Scoring - Analyze vendor performance for risk assessment
app.post('/api/ai/vendor-risk', auth, async (req, res) => {
  try {
    const [vendors, pos, receipts] = await Promise.all([
      pool.query('SELECT * FROM vendors ORDER BY name LIMIT 30'),
      pool.query('SELECT vendor_name, po_number, total, status, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 50'),
      pool.query('SELECT * FROM goods_receipts ORDER BY created_at DESC LIMIT 30'),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar('vendor risk assessment performance rating delivery quality compliance', 'vendors', 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a vendor risk assessment AI for SAP CRM. Analyze vendor performance data and provide risk scores.

Vendors (${vendors.rows.length}):
${vendors.rows.map(v => `- ${v.name}: Category=${v.category || 'N/A'}, Rating=${v.rating || 'N/A'}, Status=${v.status || 'N/A'}`).join('\n') || 'None'}

Recent Purchase Orders (${pos.rows.length}):
${pos.rows.map(p => `- ${p.po_number}: Vendor=${p.vendor_name || 'N/A'}, $${p.total || 0}, Status=${p.status}`).join('\n') || 'None'}

Recent Goods Receipts (${receipts.rows.length}):
${receipts.rows.map(g => `- ${g.gr_number || 'N/A'}: Status=${g.status || 'N/A'}`).join('\n') || 'None'}
${ragContext}

Return a JSON object:
{
  "vendors": [
    {
      "name": "vendor name",
      "risk_score": 0-100,
      "risk_level": "low|medium|high|critical",
      "factors": ["risk factor 1", "risk factor 2"],
      "recommendation": "what to do"
    }
  ],
  "overall_assessment": "brief overview",
  "top_risks": ["biggest risk 1", "risk 2", "risk 3"]
}
Return ONLY the JSON object.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Multi-doc RAG Q&A - Ask questions across multiple uploaded PDFs
app.post('/api/ai/multi-doc-qa', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    let sources = [];
    let ragContext = '';
    try {
      const similar = await searchSimilar(question, 'document', 8);
      if (similar.length > 0) {
        sources = similar.map((s, i) => ({
          id: i + 1,
          source_id: s.source_id,
          chunk: s.content_chunk.substring(0, 500),
          similarity: s.similarity,
          metadata: s.metadata
        }));
        ragContext = '\n\nRelevant document excerpts:\n' +
          sources.map(s => `[Doc ${s.id}] (${s.metadata?.title || 'Untitled'}) ${s.chunk}`).join('\n---\n');
      }
    } catch (e) {}

    if (sources.length === 0) {
      return res.json({ result: 'No documents found in the knowledge base. Please upload documents first using the Document Store.', sources: [] });
    }

    const prompt = `You are a document analysis AI. Answer the following question using ONLY the provided document excerpts. Cite specific documents using [Doc N] notation.
${ragContext}

Question: ${question}

If the documents don't contain enough information to answer, say so clearly. Always cite which document(s) you're referencing.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to answer from documents.';
    res.json({ result: content, sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. AI Change Impact Analysis - Predict downstream effects of changes
app.post('/api/ai/change-impact', auth, async (req, res) => {
  try {
    const { changeType, module, description, affectedRecords } = req.body;
    if (!changeType && !description) return res.status(400).json({ error: 'Change description required' });

    let moduleCount = '';
    try {
      if (module && moduleNames.includes(module)) {
        const count = await pool.query(`SELECT COUNT(*) as cnt FROM ${module}`);
        moduleCount = `\nModule ${module}: ${count.rows[0].cnt} records`;
      }
    } catch (e) {}

    const [accounts, opps, tickets, contracts] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM accounts'),
      pool.query("SELECT COUNT(*) as cnt FROM opportunities WHERE status = 'Open'"),
      pool.query("SELECT COUNT(*) as cnt FROM tickets WHERE status NOT IN ('Resolved','Closed')"),
      pool.query("SELECT COUNT(*) as cnt FROM contracts WHERE status = 'Active'"),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar(`change impact ${changeType || ''} ${module || ''} ${description || ''} downstream dependencies`, null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a change impact analysis AI for SAP CRM. Predict the downstream effects of the proposed change.

Proposed Change:
- Type: ${changeType || 'Configuration/Data Change'}
- Module: ${module || 'Cross-module'}
- Description: ${description || 'Not specified'}
- Affected Records: ${affectedRecords || 'Not specified'}

Current System State:
- ${accounts.rows[0].cnt} accounts
- ${opps.rows[0].cnt} open opportunities
- ${tickets.rows[0].cnt} open tickets
- ${contracts.rows[0].cnt} active contracts${moduleCount}
${ragContext}

Provide:
1. **Impact Summary** - Overall risk level (Low/Medium/High/Critical)
2. **Directly Affected** - Modules and records directly impacted
3. **Downstream Effects** - Cascading impacts on related modules
4. **Data Integrity Risks** - Potential data consistency issues
5. **User Impact** - Which users/roles will be affected
6. **Rollback Plan** - How to reverse the change if needed
7. **Recommended Approach** - Step-by-step safe implementation plan
8. **Testing Checklist** - What to verify after the change

Be specific about module names, record counts, and relationships.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to analyze change impact.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Email-to-Record - Parse incoming emails into CRM records
app.post('/api/ai/email-to-record', auth, async (req, res) => {
  try {
    const { emailText, preferredModule } = req.body;
    if (!emailText) return res.status(400).json({ error: 'Email text required' });

    let ragContext = '';
    try {
      const similar = await searchSimilar(emailText.substring(0, 200), null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 200)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are an email parsing AI for SAP CRM. Parse this email and extract structured data to create CRM records.

Email Text:
${emailText.substring(0, 2000)}
${ragContext}
${preferredModule ? `Preferred module: ${preferredModule}` : ''}

Analyze the email and return a JSON object:
{
  "suggested_module": "tickets|orders|activities|leads|contacts",
  "confidence": "high|medium|low",
  "extracted_fields": {
    "title": "subject/title",
    "description": "full description",
    "priority": "High|Medium|Low",
    "status": "suggested status",
    "contact_name": "sender or mentioned contact",
    "account_name": "company if mentioned",
    "email": "sender email",
    "category": "category if applicable",
    "amount": null,
    "due_date": null
  },
  "additional_actions": ["follow-up needed", "assign to team X"],
  "summary": "1-2 sentence summary"
}
Return ONLY the JSON object.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. AI Pricing Optimizer - Suggest optimal pricing from historical win rates
app.post('/api/ai/pricing-optimizer', auth, async (req, res) => {
  try {
    const { productName, accountName } = req.body;
    const [products, wonOpps, lostOpps, orders] = await Promise.all([
      pool.query("SELECT name, price, category, status FROM products WHERE status = 'Active' LIMIT 30"),
      pool.query("SELECT name, amount, account_name FROM opportunities WHERE status = 'Won' ORDER BY updated_at DESC LIMIT 20"),
      pool.query("SELECT name, amount, account_name FROM opportunities WHERE status = 'Lost' ORDER BY updated_at DESC LIMIT 20"),
      pool.query('SELECT order_number, account_name, total, status FROM orders ORDER BY created_at DESC LIMIT 30'),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar(`pricing optimization discount win rate ${productName || ''} ${accountName || ''} competitive price`, 'products', 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a pricing optimization AI for SAP CRM. Analyze historical win/loss data and suggest optimal pricing.

${productName ? `Product Focus: ${productName}` : ''}
${accountName ? `Account Focus: ${accountName}` : ''}

Active Products:
${products.rows.map(p => `- ${p.name}: $${p.price} (${p.category})`).join('\n')}

Won Deals (${wonOpps.rows.length}):
${wonOpps.rows.map(o => `- ${o.name}: $${o.amount} (${o.account_name})`).join('\n') || 'None'}

Lost Deals (${lostOpps.rows.length}):
${lostOpps.rows.map(o => `- ${o.name}: $${o.amount} (${o.account_name})`).join('\n') || 'None'}

Recent Orders:
${orders.rows.slice(0, 15).map(o => `- ${o.order_number}: $${o.total} (${o.account_name}, ${o.status})`).join('\n') || 'None'}
${ragContext}

Provide:
1. **Win Rate Analysis** - Win rate by price range/discount level
2. **Optimal Price Points** - Recommended prices for key products
3. **Discount Strategy** - Maximum discounts that maintain profitability
4. **Account-Specific Pricing** - Recommendations for different segments
5. **Competitive Positioning** - How to price against competitors
6. **Revenue Impact** - Expected revenue change from pricing adjustments

Use specific numbers, percentages, and dollar amounts.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate pricing recommendations.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Batch Demand Forecasting - Predict batch consumption for FIFO/FEFO
app.post('/api/ai/batch-demand-forecast', auth, async (req, res) => {
  try {
    const [batches, orders, inventory] = await Promise.all([
      pool.query('SELECT * FROM batches ORDER BY created_at DESC LIMIT 40'),
      pool.query('SELECT order_number, total, status, order_date FROM orders ORDER BY order_date DESC LIMIT 40'),
      pool.query('SELECT * FROM inventory LIMIT 30'),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar('batch demand forecast FIFO FEFO expiry consumption stock rotation inventory optimization', null, 4);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant context from knowledge base:\n' +
          similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a batch management and demand forecasting AI for SAP CRM. Analyze batch data and predict consumption patterns.

Batches (${batches.rows.length}):
${batches.rows.map(b => `- ${b.batch_number || 'N/A'}: ${b.material || 'N/A'}, Qty=${b.quantity || 'N/A'}, Expiry=${b.expiry_date || 'N/A'}, Status=${b.quality_status || b.status || 'N/A'}`).join('\n') || 'None'}

Recent Orders (${orders.rows.length}):
${orders.rows.map(o => `- ${o.order_number}: $${o.total} (${o.status}, ${o.order_date})`).join('\n') || 'None'}

Inventory (${inventory.rows.length}):
${inventory.rows.map(i => `- ${i.description || i.material_number || 'Item'}: Qty=${i.quantity || 'N/A'}`).join('\n') || 'None'}
${ragContext}

Provide:
1. **Consumption Forecast** - Predicted usage rates for next 30/60/90 days
2. **FIFO/FEFO Strategy** - Batch priority recommendations based on expiry
3. **Expiring Batches** - Batches at risk of expiring before consumption
4. **Reorder Points** - When to reorder based on consumption velocity
5. **Waste Reduction** - Strategies to minimize batch waste
6. **Optimization Plan** - Recommended batch management improvements

Use specific batch numbers, quantities, and dates.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'Unable to generate batch forecast.';
    res.json({ result: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Multi-language Support - Translate AI outputs to user's preferred language
app.post('/api/ai/translate', auth, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const prompt = `Translate the following text to ${targetLanguage || 'German'}. Maintain all formatting (markdown headers, bullet points, bold text, etc.). Only return the translated text, nothing else.

Text to translate:
${text}`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const translated = result?.choices?.[0]?.message?.content || 'Translation failed.';
    res.json({ result: translated, language: targetLanguage || 'German' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. RAG with Citations - Show exact source document/chunk backing each answer
app.post('/api/ai/rag-citations', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    let sources = [];
    let ragContext = '';
    try {
      const similar = await searchSimilar(question, null, 8);
      if (similar.length > 0) {
        sources = similar.map((s, i) => ({
          id: i + 1,
          source_type: s.source_type,
          source_id: s.source_id,
          chunk: s.content_chunk,
          similarity: s.similarity,
          metadata: s.metadata
        }));
        ragContext = '\n\nKnowledge Base Sources (ALWAYS cite using [Source N]):\n' +
          sources.map(s => `[Source ${s.id}] (${s.source_type}${s.metadata?.title ? ': ' + s.metadata.title : ''})\n${s.chunk.substring(0, 500)}`).join('\n---\n');
      }
    } catch (e) {}

    const prompt = `You are a precise, citation-aware AI for SAP CRM. Answer the question using ONLY the provided sources. Every claim MUST have a citation [Source N].
${ragContext}

Question: ${question}

Rules:
1. ONLY use information from the provided sources
2. EVERY factual claim must cite its source as [Source N]
3. If sources don't contain the answer, say "Not found in available sources"
4. After your answer, include a "## Sources Used" section listing which sources you cited

Provide a clear, well-structured answer with inline citations.`;

    const result = await callAI([{ role: 'user', content: prompt }]);
    const content = result?.choices?.[0]?.message?.content || 'No answer found in available sources.';
    res.json({ result: content, sources: sources.map(s => ({ ...s, chunk: s.chunk.substring(0, 400) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ NATURAL LANGUAGE QUERY (NLQ) ============
// Whitelist of tables the NLQ endpoint is permitted to query
const NLQ_ALLOWED_TABLES = [
  'accounts', 'contacts', 'leads', 'opportunities', 'quotes', 'orders', 'contracts',
  'deliveries', 'billing_documents', 'tickets', 'knowledge_base', 'work_orders',
  'campaigns', 'email_templates', 'products', 'invoices', 'payments', 'expense_reports',
  'general_ledger', 'accounts_payable', 'accounts_receivable', 'cost_centers',
  'profit_centers', 'purchase_orders', 'purchase_requisitions', 'goods_receipts',
  'inventory', 'vendors', 'bill_of_materials', 'production_orders', 'equipment',
  'employees', 'departments', 'performance_reviews', 'leave_requests', 'training_courses',
  'travel_requests', 'demand_plans', 'supply_plans', 'projects', 'tasks', 'audit_logs',
  'competitors', 'forecasts', 'goals', 'documents',
];

const NLQ_TABLE_SCHEMA = NLQ_ALLOWED_TABLES.map(t => `- ${t}`).join('\n');

app.post('/api/nlq', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query field is required' });
    }

    // Step 1: Ask AI to convert natural language to SQL
    const systemPrompt = `You are a PostgreSQL SQL generator for an SAP CRM system.
Convert the user's natural language request into a single parameterized SQL SELECT query.

Available tables:
${NLQ_TABLE_SCHEMA}

Rules:
1. Output ONLY valid SQL — no explanation, no markdown, no code fences.
2. Only SELECT statements are allowed. Never use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, or any other DDL/DML.
3. Use $1, $2, ... placeholders for any literal values that belong in a WHERE clause.
4. After the SQL on a new line starting with "PARAMS:", list the parameter values as a JSON array (e.g. PARAMS: ["overdue","2024-01-01"]).
5. If no parameters are needed, write PARAMS: [].
6. Limit results to 100 rows maximum (add LIMIT 100 unless a lower limit is requested).
7. Only reference tables from the available tables list above.`;

    const aiResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'SAP CRM AI Assistant',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query.trim() },
        ],
        max_tokens: 1024,
      }),
    });

    const aiData = await aiResponse.json();
    const rawAiText = aiData?.choices?.[0]?.message?.content || '';

    // Parse SQL and PARAMS from AI output
    const lines = rawAiText.trim().split('\n');
    const paramsLineIdx = lines.findIndex(l => l.trim().startsWith('PARAMS:'));
    let generatedSQL = '';
    let params = [];

    if (paramsLineIdx !== -1) {
      generatedSQL = lines.slice(0, paramsLineIdx).join('\n').trim();
      const paramsStr = lines[paramsLineIdx].replace(/^PARAMS:\s*/i, '').trim();
      try {
        params = JSON.parse(paramsStr);
      } catch {
        params = [];
      }
    } else {
      generatedSQL = rawAiText.trim();
    }

    // Step 2: Validate — only allow SELECT statements
    const sqlNormalized = generatedSQL.replace(/\s+/g, ' ').trim().toUpperCase();
    const forbiddenPatterns = [/\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bCREATE\b/, /\bALTER\b/, /\bTRUNCATE\b/, /\bGRANT\b/, /\bREVOKE\b/];
    for (const pat of forbiddenPatterns) {
      if (pat.test(sqlNormalized)) {
        return res.status(400).json({ error: 'Generated SQL contains a forbidden operation. Only SELECT queries are allowed.', generated_sql: generatedSQL });
      }
    }
    if (!sqlNormalized.startsWith('SELECT')) {
      return res.status(400).json({ error: 'Generated SQL must be a SELECT statement.', generated_sql: generatedSQL });
    }

    // Step 3: Execute the query
    const result = await pool.query(generatedSQL, params);

    res.json({
      query,
      generated_sql: generatedSQL,
      params,
      row_count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ AI STREAMING (SSE) ============
app.post('/api/ai/stream', auth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message field is required' });
    }

    // Gather same live context as the copilot endpoint
    const [contacts, accounts, opps, tickets] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM contacts'),
      pool.query('SELECT COUNT(*) as c FROM accounts'),
      pool.query("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM opportunities WHERE status = 'Open'"),
      pool.query("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('Resolved','Closed')"),
    ]);

    let ragContext = '';
    try {
      const similar = await searchSimilar(message, null, 3);
      if (similar.length > 0) {
        ragContext = '\n\nRelevant knowledge base context:\n' + similar.map(s => `[${s.source_type}] ${s.content_chunk.substring(0, 300)}`).join('\n---\n');
      }
    } catch (e) { /* RAG is optional */ }

    const systemContent = truncateContext(`You are SAP CRM Copilot, an AI assistant built into SAP CRM. You have access to the following live data:
- ${contacts.rows[0].c} contacts in the system
- ${accounts.rows[0].c} accounts being managed
- ${opps.rows[0].c} open opportunities worth $${opps.rows[0].total}
- ${tickets.rows[0].c} open service tickets
${ragContext}

You help users with CRM tasks, sales strategy, customer service, data analysis, and business operations. Be helpful, specific, and professional.`);

    const messages = [{ role: 'system', content: systemContent }];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: truncateContext(h.content) });
      }
    }
    messages.push({ role: 'user', content: truncateContext(message.trim()) });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const streamResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'SAP CRM AI Assistant',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        messages,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const errText = await streamResponse.text();
      res.write(`data: ${JSON.stringify({ error: `OpenRouter error: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of streamResponse.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') {
            res.write('data: [DONE]\n\n');
          }
          continue;
        }
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed?.choices?.[0]?.delta?.content;
            if (token) {
              res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed?.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        } catch { /* ignore */ }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================================
// AI RESULTS — paginated browse of all AI invocations (audit / observability)
// ============================================================================
app.get('/api/ai/results', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;

    const filters = [];
    const params = [];
    if (req.query.feature) { params.push(req.query.feature); filters.push(`feature = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); filters.push(`status = $${params.length}`); }
    if (req.query.userId) { params.push(parseInt(req.query.userId, 10)); filters.push(`user_id = $${params.length}`); }
    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS c FROM ai_results ${whereSql}`;
    const countResult = await pool.query(countSql, params);
    const total = countResult.rows[0].c;

    params.push(pageSize, offset);
    const dataSql = `SELECT id, feature, user_id, object_type, object_id, model, tokens_used, duration_ms, status, error_message, created_at, output FROM ai_results ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const data = await pool.query(dataSql, params);

    res.json({
      data: data.rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ai/results/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ai_results WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// HYBRID SEARCH (BM25 full-text + vector cosine) with re-rank
// Body: { query, sourceType?, limit?, alpha? }
//   alpha (0..1) = vector weight; (1-alpha) = BM25 weight. Default 0.6.
// ============================================================================
app.post('/api/rag/hybrid-search', auth, async (req, res) => {
  const started = Date.now();
  const { query, sourceType, limit = 10, alpha = 0.6 } = req.body || {};
  if (!query || String(query).trim().length < 2) {
    return res.status(400).json({ error: 'query required (min 2 chars)' });
  }
  try {
    // Vector hits
    const vecHits = await searchSimilar(query, sourceType || null, Math.min(50, limit * 4));

    // BM25 / ts_rank hits over documents.content (always source_type='document').
    // For embeddings rows that aren't documents we approximate via content_chunk full-text.
    const bm25 = await pool.query(
      `SELECT id, source_type, source_id, content_chunk, metadata,
              ts_rank_cd(to_tsvector('english', coalesce(content_chunk,'')), plainto_tsquery('english', $1)) AS rank
       FROM embeddings
       WHERE ($2::text IS NULL OR source_type = $2)
         AND to_tsvector('english', coalesce(content_chunk,'')) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $3`,
      [query, sourceType || null, Math.min(50, limit * 4)]
    );

    // Normalize scores 0..1
    const maxVec = Math.max(...vecHits.map((r) => Number(r.similarity || 0)), 1e-9);
    const maxBm = Math.max(...bm25.rows.map((r) => Number(r.rank || 0)), 1e-9);

    const merged = new Map();
    for (const r of vecHits) {
      const key = `${r.source_type}:${r.source_id}:${r.id}`;
      const score = (Number(r.similarity || 0) / maxVec) * Number(alpha);
      merged.set(key, { ...r, vectorScore: r.similarity, hybrid: score });
    }
    for (const r of bm25.rows) {
      const key = `${r.source_type}:${r.source_id}:${r.id}`;
      const bm = (Number(r.rank || 0) / maxBm) * (1 - Number(alpha));
      const existing = merged.get(key);
      if (existing) {
        existing.bm25 = r.rank;
        existing.hybrid += bm;
      } else {
        merged.set(key, { ...r, bm25: r.rank, hybrid: bm });
      }
    }

    const results = Array.from(merged.values())
      .sort((a, b) => b.hybrid - a.hybrid)
      .slice(0, limit);

    await recordAIResult({
      feature: 'hybrid-search',
      userId: req.user?.id,
      input: { query, sourceType, limit, alpha },
      output: { count: results.length },
      durationMs: Date.now() - started,
    });

    res.json({ results, alpha, vectorHits: vecHits.length, bm25Hits: bm25.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// AI APPROVAL ROUTING RECOMMENDER
// Given a document/transaction context, recommend the next approver(s) based
// on past approval-chain history.
// Body: { module, recordId, amount?, region? }
// ============================================================================
app.post('/api/ai/recommend-approver', auth, async (req, res) => {
  const started = Date.now();
  const { module: mod, recordId, amount, region } = req.body || {};
  if (!mod || !recordId) {
    return res.status(400).json({ error: 'module and recordId required' });
  }
  try {
    let history = [];
    try {
      const r = await pool.query(
        `SELECT * FROM approval_chain WHERE module = $1 ORDER BY created_at DESC LIMIT 200`,
        [mod]
      );
      history = r.rows;
    } catch (e) { /* table may not exist */ }

    const employees = await pool.query(
      `SELECT id, full_name, email, position, department FROM employees ORDER BY id LIMIT 200`
    );

    const prompt = `You are a workflow routing analyst. Recommend the best 1-3 approvers for this transaction based on history.
Return ONLY JSON: { "recommendations": [{ "employeeId": 0, "name": "...", "rationale": "...", "confidence": 0.0 }], "summary": "..." }

Module: ${mod}
Record: ${recordId}
Amount: ${amount ?? 'n/a'}
Region: ${region ?? 'n/a'}

Recent approval history (sample):
${JSON.stringify(history.slice(0, 30), null, 2)}

Available approvers:
${JSON.stringify(employees.rows.slice(0, 50), null, 2)}`;

    const ai = await callAI([{ role: 'user', content: prompt }], { temperature: 0.2, maxTokens: 1024 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = parseAIJson(content); } catch { parsed = { raw: content }; }

    await recordAIResult({
      feature: 'recommend-approver',
      userId: req.user?.id,
      objectType: mod,
      objectId: String(recordId),
      input: { mod, recordId, amount, region, historyCount: history.length },
      output: parsed,
      durationMs: Date.now() - started,
    });

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MULTI-TENANT — per-tenant AI key store (lite). The tenant_api_keys table
// holds an encrypted-at-rest reference per tenant. Production should use
// KMS / Vault — this is a dev-quality stub.
// ============================================================================
app.post('/api/admin/tenant-keys', auth, async (req, res) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ error: 'admin only' });
  const { tenantId, openrouterApiKey, model } = req.body || {};
  if (!tenantId || !openrouterApiKey) {
    return res.status(400).json({ error: 'tenantId and openrouterApiKey required' });
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_api_keys (
        tenant_id VARCHAR(100) PRIMARY KEY,
        openrouter_api_key TEXT NOT NULL,
        model VARCHAR(200),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO tenant_api_keys (tenant_id, openrouter_api_key, model, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET openrouter_api_key = EXCLUDED.openrouter_api_key, model = EXCLUDED.model, updated_at = NOW()`,
      [tenantId, openrouterApiKey, model || null]
    );
    res.json({ message: 'tenant key stored', tenantId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/tenant-keys', auth, async (req, res) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ error: 'admin only' });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_api_keys (
        tenant_id VARCHAR(100) PRIMARY KEY,
        openrouter_api_key TEXT NOT NULL,
        model VARCHAR(200),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const r = await pool.query('SELECT tenant_id, model, updated_at FROM tenant_api_keys ORDER BY tenant_id');
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CLOSED-LOOP ANOMALY EXPLAINER → TICKET
// Reuses /api/dashboard/anomalies output to auto-create tickets with linked
// evidence (related records) and route via partner-function rules.
// Body: { anomalies: [{ description, severity?, relatedModule?, relatedId? }] }
// ============================================================================
app.post('/api/ai/anomaly-to-ticket', auth, async (req, res) => {
  const started = Date.now();
  const { anomalies } = req.body || {};
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return res.status(400).json({ error: 'anomalies array required' });
  }
  const created = [];
  try {
    for (const a of anomalies.slice(0, 20)) {
      try {
        const insertSql = `INSERT INTO tickets (title, description, status, priority, created_at, updated_at)
          VALUES ($1, $2, 'Open', $3, NOW(), NOW()) RETURNING *`;
        const result = await pool.query(insertSql, [
          `[Anomaly] ${a.description?.slice(0, 80) || 'Detected anomaly'}`,
          JSON.stringify({ ...a, source: 'ai-anomaly', evidence: { module: a.relatedModule, id: a.relatedId } }),
          a.severity === 'high' ? 'High' : a.severity === 'critical' ? 'Critical' : 'Medium',
        ]);
        created.push(result.rows[0]);
      } catch (e) {
        // schema variation tolerance — skip if columns differ
        console.warn('anomaly-to-ticket insert skipped:', e.message);
      }
    }

    await recordAIResult({
      feature: 'anomaly-to-ticket',
      userId: req.user?.id,
      input: { count: anomalies.length },
      output: { ticketsCreated: created.length, ticketIds: created.map((t) => t.id) },
      durationMs: Date.now() - started,
    });

    res.json({ ticketsCreated: created.length, tickets: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// VOICE-DRIVEN SAP — placeholder for Whisper STT → AI tool-call → CRUD.
// Accepts raw transcript; LLM produces a tool plan for the 77-module CRUD.
// Body: { transcript, currentModule? }
// ============================================================================
app.post('/api/ai/voice-action', auth, async (req, res) => {
  const started = Date.now();
  const { transcript, currentModule } = req.body || {};
  if (!transcript) return res.status(400).json({ error: 'transcript required' });
  try {
    const prompt = `You are a SAP CRM voice agent. Translate the following spoken command into a JSON action plan.
Return ONLY JSON: { "intent": "create|update|search|delete|noop", "module": "string", "filters": {}, "data": {}, "confirmation": "1-sentence summary asking the user to confirm" }

Current module: ${currentModule || 'unspecified'}
Transcript: "${transcript}"`;

    const ai = await callAI([{ role: 'user', content: prompt }], { temperature: 0.1, maxTokens: 768 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    let plan;
    try { plan = parseAIJson(content); } catch { plan = { intent: 'noop', confirmation: 'Could not parse plan.' }; }

    await recordAIResult({
      feature: 'voice-action',
      userId: req.user?.id,
      input: { transcript: transcript.slice(0, 500), currentModule },
      output: plan,
      durationMs: Date.now() - started,
    });

    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Apply pass 5 — additive backlog endpoints (SAP connectors, workflow,
// consolidation, pricing rules, document flow, where-used, AI Studio).
//
// Required env vars (documented):
//   OPENROUTER_API_KEY — required by every AI endpoint here.
//   SAP_ODATA_BASE_URL — for /sap-odata-proxy (NEEDS-CREDS).
//   SAP_BAPI_GATEWAY_URL — for /sap-bapi-call (NEEDS-CREDS).
//   SAP_IDOC_DROP_DIR — for /sap-idoc-process (NEEDS-CREDS).
//
// PRODUCT-DECISION (defaults documented inline):
//   - Approval workflow: stores in a new `approval_workflows` table
//     (CREATE TABLE IF NOT EXISTS). States: draft, pending, approved, rejected.
//   - Cross-company consolidation: server returns aggregated totals across
//     all rows of the requested table grouped by `company_code` if present;
//     if the column is missing, returns the LLM narrative only.
//   - Pricing condition rule engine: stored in `pricing_conditions` table
//     (CREATE TABLE IF NOT EXISTS). Rule expressions are evaluated as
//     opaque strings — LLM produces a recommendation, no code-eval.
//   - SAP-conforming entity mapping: returns an LLM-generated mapping plan
//     between this app's tables and SAP's standard entity model.
// ============================================================================

let _sapBacklogTablesEnsured = false;
async function ensureSapBacklogTables() {
  if (_sapBacklogTablesEnsured) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS approval_workflows (
       id SERIAL PRIMARY KEY,
       entity_type TEXT NOT NULL,
       entity_id TEXT NOT NULL,
       state TEXT NOT NULL DEFAULT 'draft',
       requested_by INTEGER,
       approver_id INTEGER,
       history JSONB NOT NULL DEFAULT '[]'::jsonb,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS pricing_condition_rules (
       id SERIAL PRIMARY KEY,
       condition_type TEXT NOT NULL,
       expression TEXT NOT NULL,
       priority INTEGER NOT NULL DEFAULT 0,
       active BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ];
  for (const s of stmts) {
    try { await pool.query(s); } catch (_) {}
  }
  _sapBacklogTablesEnsured = true;
}

function sapRequireKey(res, env) {
  if (!process.env[env]) {
    res.status(503).json({ error: `${env} not configured`, missing: env });
    return false;
  }
  return true;
}

// POST /api/sap/odata-proxy — NEEDS-CREDS: SAP_ODATA_BASE_URL.
// Additive only: produces an LLM plan for an OData call; never makes outbound HTTP.
app.post('/api/sap/odata-proxy', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    if (!sapRequireKey(res, 'SAP_ODATA_BASE_URL')) return;
    const { entity, query, filter } = req.body || {};
    if (!entity) return res.status(400).json({ error: 'entity required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP OData planner. Build a GET URL for entity=${entity}, query=${JSON.stringify(query||{})}, filter=${JSON.stringify(filter||{})}.
Base: ${process.env.SAP_ODATA_BASE_URL}
Return ONLY JSON: { "method": "GET", "url": "...", "headers": { "Accept": "application/json" }, "rationale": "..." }`
    }], { temperature: 0.2, maxTokens: 600 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ simulated: true, plan: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/bapi-call — NEEDS-CREDS: SAP_BAPI_GATEWAY_URL.
app.post('/api/sap/bapi-call', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    if (!sapRequireKey(res, 'SAP_BAPI_GATEWAY_URL')) return;
    const { bapiName, parameters = {} } = req.body || {};
    if (!bapiName) return res.status(400).json({ error: 'bapiName required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP BAPI/RFC planner. Plan a call to BAPI ${bapiName} with params ${JSON.stringify(parameters)}.
Gateway: ${process.env.SAP_BAPI_GATEWAY_URL}
Return ONLY JSON: { "bapi": "${bapiName}", "input": {...}, "expectedTables": ["..."], "rationale": "..." }`
    }], { temperature: 0.2, maxTokens: 600 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ simulated: true, plan: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/idoc-process — NEEDS-CREDS: SAP_IDOC_DROP_DIR.
app.post('/api/sap/idoc-process', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    if (!sapRequireKey(res, 'SAP_IDOC_DROP_DIR')) return;
    const { idocPayload } = req.body || {};
    if (!idocPayload) return res.status(400).json({ error: 'idocPayload required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP IDoc parser. Summarize and validate this IDoc payload.
DROP_DIR: ${process.env.SAP_IDOC_DROP_DIR}
PAYLOAD: ${typeof idocPayload === 'string' ? idocPayload.slice(0, 4000) : JSON.stringify(idocPayload).slice(0, 4000)}
Return ONLY JSON: { "messageType": "...", "segments": [...], "errors": [...], "rationale": "..." }`
    }], { temperature: 0.1, maxTokens: 800 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ simulated: true, parsed: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/approval-workflow — create or transition an approval.
// Body: { entity_type, entity_id, action: 'create'|'transition', target_state? }
app.post('/api/sap/approval-workflow', auth, async (req, res) => {
  try {
    await ensureSapBacklogTables();
    const { entity_type, entity_id, action = 'create', target_state, approver_id } = req.body || {};
    if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
    if (action === 'create') {
      const requestedBy = req.user?.id || null;
      const requestedByText = String(requestedBy ?? '');
      const r = await pool.query(
        `INSERT INTO approval_workflows (entity_type, entity_id, state, requested_by, approver_id, history)
         VALUES ($1::text, $2::text, 'pending'::text, $3::integer, $4::integer,
           jsonb_build_array(jsonb_build_object('state', 'pending'::text, 'at', NOW(), 'by', $5::text)))
         RETURNING *`,
        [entity_type, entity_id, requestedBy, approver_id || null, requestedByText]
      );
      return res.json({ workflow: r.rows[0] });
    }
    if (action === 'transition') {
      const valid = ['draft', 'pending', 'approved', 'rejected'];
      if (!valid.includes(target_state)) return res.status(400).json({ error: 'invalid target_state' });
      const r = await pool.query(
        `UPDATE approval_workflows
         SET state = $1,
             history = history || jsonb_build_array(jsonb_build_object('state', $1::text, 'at', NOW(), 'by', $2::text)),
             updated_at = NOW()
         WHERE entity_type = $3 AND entity_id = $4
         RETURNING *`,
        [target_state, String(req.user?.id || ''), entity_type, entity_id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'workflow not found' });
      return res.json({ workflow: r.rows[0] });
    }
    res.status(400).json({ error: 'action must be create|transition' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/cross-company-consolidation
// Body: { table: string, metric: string }
// PRODUCT-DECISION: SUM by company_code if column exists.
app.post('/api/sap/cross-company-consolidation', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    const { table, metric = 'amount' } = req.body || {};
    if (!table) return res.status(400).json({ error: 'table required' });
    // Defensive: only allow safe identifiers.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(metric)) {
      return res.status(400).json({ error: 'invalid identifier' });
    }
    let totals = [];
    try {
      const r = await pool.query(
        `SELECT company_code, SUM(${metric})::numeric AS total
         FROM ${table}
         GROUP BY company_code ORDER BY total DESC LIMIT 100`
      );
      totals = r.rows;
    } catch (_) { /* column or table missing */ }
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP cross-company consolidation analyst.
TABLE: ${table} | METRIC: ${metric}
TOTALS: ${JSON.stringify(totals)}
Return ONLY JSON: { "consolidatedTotal": 0, "byCompany": [...], "intercompanyEliminationsNeeded": [...], "narrative": "..." }`
    }], { temperature: 0.3, maxTokens: 800 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ totals, ai_narrative: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/pricing-conditions — register a pricing rule (LLM advises).
app.post('/api/sap/pricing-conditions', auth, async (req, res) => {
  try {
    await ensureSapBacklogTables();
    const { condition_type, expression, priority = 0 } = req.body || {};
    if (!condition_type || !expression) return res.status(400).json({ error: 'condition_type and expression required' });
    const r = await pool.query(
      `INSERT INTO pricing_condition_rules (condition_type, expression, priority)
       VALUES ($1::text, $2::text, $3::integer) RETURNING *`,
      [condition_type, expression, parseInt(priority, 10) || 0]
    );
    let aiAdvice = null;
    if (process.env.OPENROUTER_API_KEY) {
      const ai = await callAI([{
        role: 'user',
        content: `Review this SAP pricing condition rule:
TYPE: ${condition_type}
EXPRESSION: ${expression}
Return ONLY JSON: { "summary": "...", "risks": [...], "interactions": [...] }`
      }], { temperature: 0.3, maxTokens: 500 });
      aiAdvice = parseAIJson(ai?.choices?.[0]?.message?.content || '{}');
    }
    res.json({ rule: r.rows[0], ai_advice: aiAdvice });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/document-flow — narrate document flow for a doc.
app.post('/api/sap/document-flow', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    const { document_type, document_id } = req.body || {};
    if (!document_type || !document_id) return res.status(400).json({ error: 'document_type and document_id required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP document-flow narrator.
DOCUMENT: ${document_type} #${document_id}
Return ONLY JSON: { "preceding": [...], "current": "${document_type}", "following": [...], "flow_diagram": "ASCII", "rationale": "..." }`
    }], { temperature: 0.3, maxTokens: 700 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ flow: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/where-used — analyze where a master-data record is used.
app.post('/api/sap/where-used', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    const { entity_type, entity_id } = req.body || {};
    if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP where-used analyzer.
ENTITY: ${entity_type} #${entity_id}
Return ONLY JSON: { "tables": [...], "transactions": [...], "rationale": "..." }`
    }], { temperature: 0.3, maxTokens: 600 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ usage: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sap/entity-mapping — LLM proposes mapping app tables → SAP entities.
app.post('/api/sap/entity-mapping', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    const { app_tables = [] } = req.body || {};
    const ai = await callAI([{
      role: 'user',
      content: `You are an SAP entity-model mapper.
APP TABLES: ${JSON.stringify(app_tables).slice(0, 2000)}
Return ONLY JSON: { "mappings": [{ "app_table": "...", "sap_entity": "MARA|VBAK|...", "fields": {} }], "rationale": "..." }`
    }], { temperature: 0.3, maxTokens: 1200 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ mapping: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ai/studio-prompt-design — AI Studio prompt design surface.
app.post('/api/ai/studio-prompt-design', auth, async (req, res) => {
  try {
    if (!sapRequireKey(res, 'OPENROUTER_API_KEY')) return;
    const { goal, fewShotExamples = [], constraints } = req.body || {};
    if (!goal) return res.status(400).json({ error: 'goal required' });
    const ai = await callAI([{
      role: 'user',
      content: `You are an AI prompt-design coach.
GOAL: ${goal}
FEW-SHOT: ${JSON.stringify(fewShotExamples).slice(0, 2000)}
CONSTRAINTS: ${constraints || 'none'}
Return ONLY JSON: { "systemPrompt": "...", "userTemplate": "...", "rationale": "..." }`
    }], { temperature: 0.5, maxTokens: 1200 });
    const content = ai?.choices?.[0]?.message?.content || '{}';
    res.json({ design: parseAIJson(content) || content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api/sap-extras', require('./routes/aiExtras')); // Custom Feature Suggestions (batch 11)
app.use('/api', require('./routes/gap-features')); // === Batch 11 Gaps & Frontend Mounts ===

app.listen(PORT, () => {
  console.log(`SAP CRM API Server running on port ${PORT}`);
});

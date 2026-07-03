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
    CREATE TABLE IF NOT EXISTS sap_stock_balances (
      id SERIAL PRIMARY KEY,
      material_number TEXT NOT NULL,
      material_description TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      storage_location TEXT DEFAULT '0001',
      batch TEXT DEFAULT '',
      stock_type TEXT DEFAULT 'unrestricted',
      quantity NUMERIC(15,3) DEFAULT 0,
      unit TEXT DEFAULT 'EA',
      moving_average_price NUMERIC(15,2) DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(material_number, plant, storage_location, batch, stock_type)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_material_documents (
      id SERIAL PRIMARY KEY,
      document_number TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      material_number TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      storage_location TEXT DEFAULT '0001',
      target_storage_location TEXT,
      batch TEXT DEFAULT '',
      quantity NUMERIC(15,3) NOT NULL,
      unit TEXT DEFAULT 'EA',
      reason TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_stock_reservations (
      id SERIAL PRIMARY KEY,
      reservation_number TEXT NOT NULL UNIQUE,
      material_number TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      storage_location TEXT DEFAULT '0001',
      required_quantity NUMERIC(15,3) NOT NULL,
      issued_quantity NUMERIC(15,3) DEFAULT 0,
      requirement_date DATE DEFAULT CURRENT_DATE,
      cost_center TEXT,
      status TEXT DEFAULT 'open',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_cycle_counts (
      id SERIAL PRIMARY KEY,
      count_document TEXT NOT NULL UNIQUE,
      material_number TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      storage_location TEXT DEFAULT '0001',
      book_quantity NUMERIC(15,3) DEFAULT 0,
      counted_quantity NUMERIC(15,3) DEFAULT 0,
      difference_quantity NUMERIC(15,3) DEFAULT 0,
      status TEXT DEFAULT 'counted',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
}

async function seedDefaults() {
  const stocks = [
    ['FG-1000', 'Smart Controller Assembly', '1000', '0001', 'BATCH-A', 'unrestricted', 250, 'EA', 555.24],
    ['COMP-BOARD', 'Controller PCB', '1000', '0001', '', 'unrestricted', 900, 'EA', 145],
    ['COMP-CASE', 'Aluminum enclosure', '1000', '0002', '', 'quality', 120, 'EA', 42],
    ['COMP-SENSOR', 'Temperature sensor', '1000', '0001', '', 'unrestricted', 1800, 'EA', 18],
    ['COMP-HARNESS', 'Cable harness', '1000', '0003', '', 'blocked', 35, 'EA', 22],
  ];
  for (const stock of stocks) {
    await pool.query(
      `INSERT INTO sap_stock_balances
       (material_number, material_description, plant, storage_location, batch, stock_type, quantity, unit, moving_average_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (material_number, plant, storage_location, batch, stock_type) DO NOTHING`,
      stock
    );
  }
}

function num(value) {
  return Number(value || 0);
}

function matDocNumber() {
  return `MAT-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
}

async function findStock({ materialNumber, plant = '1000', storageLocation = '0001', batch = '', stockType = 'unrestricted' }) {
  const result = await pool.query(
    `SELECT * FROM sap_stock_balances
     WHERE material_number = $1 AND plant = $2 AND storage_location = $3 AND batch = $4 AND stock_type = $5`,
    [materialNumber, plant, storageLocation, batch || '', stockType]
  );
  return result.rows[0] || null;
}

async function upsertStock({ materialNumber, materialDescription, plant, storageLocation, batch, stockType, quantityDelta, unit = 'EA', price = 0 }) {
  const result = await pool.query(
    `INSERT INTO sap_stock_balances
     (material_number, material_description, plant, storage_location, batch, stock_type, quantity, unit, moving_average_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (material_number, plant, storage_location, batch, stock_type)
     DO UPDATE SET quantity = sap_stock_balances.quantity + EXCLUDED.quantity,
       material_description = EXCLUDED.material_description,
       moving_average_price = CASE WHEN EXCLUDED.moving_average_price > 0 THEN EXCLUDED.moving_average_price ELSE sap_stock_balances.moving_average_price END,
       updated_at = NOW()
     RETURNING *`,
    [materialNumber, materialDescription || materialNumber, plant, storageLocation, batch || '', stockType, quantityDelta, unit, price]
  );
  return result.rows[0];
}

async function postMovement({ movementType, materialNumber, plant = '1000', storageLocation = '0001', targetStorageLocation, batch = '', quantity, unit = 'EA', reason, createdBy }) {
  const qty = num(quantity);
  if (!movementType || !materialNumber || qty <= 0) {
    const err = new Error('movementType, materialNumber, and positive quantity required');
    err.status = 400;
    throw err;
  }
  const current = await findStock({ materialNumber, plant, storageLocation, batch, stockType: 'unrestricted' });
  const description = current?.material_description || materialNumber;
  const price = current?.moving_average_price || 0;
  if (['201', '261', '601', '311'].includes(movementType) && num(current?.quantity) < qty) {
    const err = new Error('Insufficient unrestricted stock');
    err.status = 409;
    throw err;
  }
  if (movementType === '101') {
    await upsertStock({ materialNumber, materialDescription: description, plant, storageLocation, batch, stockType: 'unrestricted', quantityDelta: qty, unit, price });
  } else if (['201', '261', '601'].includes(movementType)) {
    await upsertStock({ materialNumber, materialDescription: description, plant, storageLocation, batch, stockType: 'unrestricted', quantityDelta: -qty, unit, price });
  } else if (movementType === '311') {
    if (!targetStorageLocation) {
      const err = new Error('targetStorageLocation required for transfer posting');
      err.status = 400;
      throw err;
    }
    await upsertStock({ materialNumber, materialDescription: description, plant, storageLocation, batch, stockType: 'unrestricted', quantityDelta: -qty, unit, price });
    await upsertStock({ materialNumber, materialDescription: description, plant, storageLocation: targetStorageLocation, batch, stockType: 'unrestricted', quantityDelta: qty, unit, price });
  } else if (movementType === '321') {
    const quality = await findStock({ materialNumber, plant, storageLocation, batch, stockType: 'quality' });
    if (num(quality?.quantity) < qty) {
      const err = new Error('Insufficient quality inspection stock');
      err.status = 409;
      throw err;
    }
    await upsertStock({ materialNumber, materialDescription: quality.material_description, plant, storageLocation, batch, stockType: 'quality', quantityDelta: -qty, unit, price: quality.moving_average_price });
    await upsertStock({ materialNumber, materialDescription: quality.material_description, plant, storageLocation, batch, stockType: 'unrestricted', quantityDelta: qty, unit, price: quality.moving_average_price });
  } else {
    const err = new Error('Unsupported movement type');
    err.status = 400;
    throw err;
  }
  const doc = await pool.query(
    `INSERT INTO sap_material_documents
     (document_number, movement_type, material_number, plant, storage_location, target_storage_location, batch, quantity, unit, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [matDocNumber(), movementType, materialNumber, plant, storageLocation, targetStorageLocation || null, batch || '', qty, unit, reason || '', createdBy || 'system']
  );
  return doc.rows[0];
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [stock, docs, reservations, counts] = await Promise.all([
      pool.query('SELECT * FROM sap_stock_balances ORDER BY material_number, plant, storage_location, stock_type'),
      pool.query('SELECT * FROM sap_material_documents ORDER BY created_at DESC LIMIT 30'),
      pool.query('SELECT * FROM sap_stock_reservations ORDER BY requirement_date ASC LIMIT 30'),
      pool.query('SELECT * FROM sap_cycle_counts ORDER BY created_at DESC LIMIT 30'),
    ]);
    const stockValue = stock.rows.reduce((sum, row) => sum + num(row.quantity) * num(row.moving_average_price), 0);
    res.json({
      summary: {
        stockItems: stock.rows.length,
        stockValue,
        materialDocuments: docs.rows.length,
        openReservations: reservations.rows.filter((r) => r.status === 'open').length,
        cycleCounts: counts.rows.length,
      },
      stock: stock.rows,
      materialDocuments: docs.rows,
      reservations: reservations.rows,
      cycleCounts: counts.rows,
      capabilities: [
        'Stock by plant, storage location, batch, and stock type',
        'Goods receipt, issue, transfer, and quality release movements',
        'Material document audit trail',
        'Stock reservations',
        'Cycle count variance capture',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/movement', auth, async (req, res) => {
  try {
    await ensureTables();
    const document = await postMovement({ ...req.body, createdBy: req.user?.email || 'system' });
    res.json({ document });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/reservations', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber, plant = '1000', storageLocation = '0001', requiredQuantity, requirementDate, costCenter } = req.body || {};
    if (!materialNumber || !requiredQuantity) return res.status(400).json({ error: 'materialNumber and requiredQuantity required' });
    const reservation = `RES-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO sap_stock_reservations
       (reservation_number, material_number, plant, storage_location, required_quantity, requirement_date, cost_center, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8) RETURNING *`,
      [reservation, materialNumber, plant, storageLocation, requiredQuantity, requirementDate || null, costCenter || null, req.user?.email || 'system']
    );
    res.json({ reservation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cycle-count', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber, plant = '1000', storageLocation = '0001', batch = '', countedQuantity } = req.body || {};
    if (!materialNumber || countedQuantity == null) return res.status(400).json({ error: 'materialNumber and countedQuantity required' });
    const stock = await findStock({ materialNumber, plant, storageLocation, batch, stockType: 'unrestricted' });
    const book = num(stock?.quantity);
    const counted = num(countedQuantity);
    const result = await pool.query(
      `INSERT INTO sap_cycle_counts
       (count_document, material_number, plant, storage_location, book_quantity, counted_quantity, difference_quantity, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [`CC-${Date.now().toString().slice(-8)}`, materialNumber, plant, storageLocation, book, counted, counted - book, req.user?.email || 'system']
    );
    res.json({ cycleCount: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

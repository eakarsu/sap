const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_work_centers (
      id SERIAL PRIMARY KEY,
      work_center TEXT NOT NULL UNIQUE,
      plant TEXT DEFAULT '1000',
      description TEXT NOT NULL,
      capacity_hours_per_day NUMERIC(10,2) DEFAULT 8,
      hourly_rate NUMERIC(12,2) DEFAULT 75,
      queue_days NUMERIC(10,2) DEFAULT 0,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_boms (
      id SERIAL PRIMARY KEY,
      material_number TEXT NOT NULL UNIQUE,
      material_description TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      base_quantity NUMERIC(12,3) DEFAULT 1,
      status TEXT DEFAULT 'released',
      valid_from DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_bom_items (
      id SERIAL PRIMARY KEY,
      bom_id INTEGER REFERENCES sap_boms(id) ON DELETE CASCADE,
      component_material TEXT NOT NULL,
      component_description TEXT NOT NULL,
      quantity NUMERIC(12,3) NOT NULL,
      unit TEXT DEFAULT 'EA',
      scrap_percent NUMERIC(8,3) DEFAULT 0,
      unit_cost NUMERIC(12,2) DEFAULT 0,
      procurement_type TEXT DEFAULT 'buy',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_routings (
      id SERIAL PRIMARY KEY,
      material_number TEXT NOT NULL,
      plant TEXT DEFAULT '1000',
      routing_group TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'released',
      lot_size NUMERIC(12,3) DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_routing_operations (
      id SERIAL PRIMARY KEY,
      routing_id INTEGER REFERENCES sap_routings(id) ON DELETE CASCADE,
      operation_number INTEGER NOT NULL,
      work_center TEXT NOT NULL,
      description TEXT NOT NULL,
      setup_hours NUMERIC(10,3) DEFAULT 0,
      machine_hours NUMERIC(10,3) DEFAULT 0,
      labor_hours NUMERIC(10,3) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_cost_rollups (
      id SERIAL PRIMARY KEY,
      material_number TEXT NOT NULL,
      lot_size NUMERIC(12,3) DEFAULT 1,
      material_cost NUMERIC(15,2) DEFAULT 0,
      labor_cost NUMERIC(15,2) DEFAULT 0,
      machine_cost NUMERIC(15,2) DEFAULT 0,
      overhead_cost NUMERIC(15,2) DEFAULT 0,
      total_cost NUMERIC(15,2) DEFAULT 0,
      details JSONB DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedDefaults();
  ensured = true;
}

async function seedDefaults() {
  const centers = [
    ['WC-ASSY', '1000', 'Final Assembly Line', 16, 85, 1],
    ['WC-MACH', '1000', 'CNC Machining Cell', 14, 120, 2],
    ['WC-TEST', '1000', 'Quality Test Station', 10, 95, 0.5],
    ['WC-PACK', '1000', 'Packaging Line', 12, 60, 0.25],
  ];
  for (const wc of centers) {
    await pool.query(
      `INSERT INTO sap_work_centers (work_center, plant, description, capacity_hours_per_day, hourly_rate, queue_days)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (work_center) DO NOTHING`,
      wc
    );
  }

  const bom = await pool.query(
    `INSERT INTO sap_boms (material_number, material_description, plant, base_quantity)
     VALUES ('FG-1000','Smart Controller Assembly','1000',1)
     ON CONFLICT (material_number) DO UPDATE SET material_description = EXCLUDED.material_description
     RETURNING id`
  );
  const bomId = bom.rows[0].id;
  const items = [
    ['COMP-BOARD', 'Controller PCB', 1, 'EA', 2, 145, 'buy'],
    ['COMP-CASE', 'Aluminum enclosure', 1, 'EA', 1, 42, 'buy'],
    ['COMP-SENSOR', 'Temperature sensor', 2, 'EA', 3, 18, 'buy'],
    ['COMP-HARNESS', 'Cable harness', 1, 'EA', 1, 22, 'buy'],
  ];
  for (const item of items) {
    await pool.query(
      `INSERT INTO sap_bom_items (bom_id, component_material, component_description, quantity, unit, scrap_percent, unit_cost, procurement_type)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8
       WHERE NOT EXISTS (SELECT 1 FROM sap_bom_items WHERE bom_id = $1 AND component_material = $2)`,
      [bomId, ...item]
    );
  }

  const routing = await pool.query(
    `INSERT INTO sap_routings (material_number, plant, routing_group, lot_size)
     VALUES ('FG-1000','1000','RT-FG-1000',1)
     ON CONFLICT (routing_group) DO UPDATE SET material_number = EXCLUDED.material_number
     RETURNING id`
  );
  const routingId = routing.rows[0].id;
  const ops = [
    [10, 'WC-MACH', 'Machine enclosure interfaces', 0.25, 0.6, 0.2],
    [20, 'WC-ASSY', 'Assemble PCB, sensors, and harness', 0.1, 0.2, 0.85],
    [30, 'WC-TEST', 'Functional and safety test', 0.05, 0.3, 0.35],
    [40, 'WC-PACK', 'Pack finished unit', 0.02, 0.05, 0.15],
  ];
  for (const op of ops) {
    await pool.query(
      `INSERT INTO sap_routing_operations (routing_id, operation_number, work_center, description, setup_hours, machine_hours, labor_hours)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (SELECT 1 FROM sap_routing_operations WHERE routing_id = $1 AND operation_number = $2)`,
      [routingId, ...op]
    );
  }
}

function num(value) {
  return Number(value || 0);
}

async function getBom(materialNumber) {
  const bom = await pool.query('SELECT * FROM sap_boms WHERE material_number = $1', [materialNumber]);
  if (!bom.rows[0]) return null;
  const items = await pool.query('SELECT * FROM sap_bom_items WHERE bom_id = $1 ORDER BY id', [bom.rows[0].id]);
  return { ...bom.rows[0], items: items.rows };
}

async function getRouting(materialNumber) {
  const routing = await pool.query('SELECT * FROM sap_routings WHERE material_number = $1 ORDER BY id LIMIT 1', [materialNumber]);
  if (!routing.rows[0]) return null;
  const operations = await pool.query(
    `SELECT o.*, wc.description AS work_center_description, wc.hourly_rate, wc.capacity_hours_per_day, wc.queue_days
     FROM sap_routing_operations o
     LEFT JOIN sap_work_centers wc ON wc.work_center = o.work_center
     WHERE o.routing_id = $1
     ORDER BY o.operation_number`,
    [routing.rows[0].id]
  );
  return { ...routing.rows[0], operations: operations.rows };
}

async function calculateRollup(materialNumber, lotSize = 1) {
  const bom = await getBom(materialNumber);
  const routing = await getRouting(materialNumber);
  if (!bom) {
    const err = new Error('BOM not found');
    err.status = 404;
    throw err;
  }
  const lot = num(lotSize) || 1;
  const materialLines = bom.items.map((item) => {
    const requiredQty = (num(item.quantity) * lot) * (1 + num(item.scrap_percent) / 100);
    const extendedCost = requiredQty * num(item.unit_cost);
    return { ...item, requiredQty, extendedCost };
  });
  const materialCost = materialLines.reduce((sum, item) => sum + item.extendedCost, 0);
  const operations = routing?.operations || [];
  const laborCost = operations.reduce((sum, op) => sum + (num(op.labor_hours) * num(op.hourly_rate) * lot), 0);
  const machineCost = operations.reduce((sum, op) => sum + (num(op.machine_hours) * num(op.hourly_rate) * lot), 0);
  const overheadCost = (laborCost + machineCost) * 0.18;
  const totalCost = materialCost + laborCost + machineCost + overheadCost;
  return {
    materialNumber,
    lotSize: lot,
    materialCost,
    laborCost,
    machineCost,
    overheadCost,
    totalCost,
    materialLines,
    operations,
  };
}

router.get('/overview', auth, async (req, res) => {
  try {
    await ensureTables();
    const [workCenters, boms, routings, rollups] = await Promise.all([
      pool.query('SELECT * FROM sap_work_centers ORDER BY work_center'),
      pool.query('SELECT * FROM sap_boms ORDER BY material_number'),
      pool.query('SELECT * FROM sap_routings ORDER BY material_number'),
      pool.query('SELECT * FROM sap_cost_rollups ORDER BY created_at DESC LIMIT 20'),
    ]);
    const defaultRollup = await calculateRollup('FG-1000', 10);
    res.json({
      summary: {
        workCenters: workCenters.rows.length,
        boms: boms.rows.length,
        routings: routings.rows.length,
        lastRollups: rollups.rows.length,
        defaultLotCost: Number(defaultRollup.totalCost.toFixed(2)),
      },
      workCenters: workCenters.rows,
      boms: boms.rows,
      routings: routings.rows,
      rollups: rollups.rows,
      defaultRollup,
      capabilities: [
        'BOM item maintenance and explosion',
        'Routing operation and work-center capacity model',
        'Standard cost rollup with material, labor, machine, and overhead',
        'Lot-size costing and scrap handling',
        'Capacity load estimate by work center',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bom/:materialNumber/explosion', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber } = req.params;
    const lotSize = num(req.query.lotSize) || 1;
    const bom = await getBom(materialNumber);
    if (!bom) return res.status(404).json({ error: 'BOM not found' });
    const items = bom.items.map((item) => ({
      ...item,
      required_quantity: num(item.quantity) * lotSize * (1 + num(item.scrap_percent) / 100),
      extended_cost: num(item.quantity) * lotSize * (1 + num(item.scrap_percent) / 100) * num(item.unit_cost),
    }));
    res.json({ bom, lotSize, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cost-rollup', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber = 'FG-1000', lotSize = 1 } = req.body || {};
    const rollup = await calculateRollup(materialNumber, lotSize);
    const result = await pool.query(
      `INSERT INTO sap_cost_rollups
       (material_number, lot_size, material_cost, labor_cost, machine_cost, overhead_cost, total_cost, details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        materialNumber,
        rollup.lotSize,
        rollup.materialCost,
        rollup.laborCost,
        rollup.machineCost,
        rollup.overheadCost,
        rollup.totalCost,
        JSON.stringify(rollup),
        req.user?.email || 'system',
      ]
    );
    res.json({ rollup, saved: result.rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/capacity-check', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber = 'FG-1000', orderQuantity = 100, dueDays = 5 } = req.body || {};
    const routing = await getRouting(materialNumber);
    if (!routing) return res.status(404).json({ error: 'Routing not found' });
    const qty = num(orderQuantity) || 1;
    const days = num(dueDays) || 1;
    const loads = routing.operations.map((op) => {
      const requiredHours = (num(op.setup_hours) + num(op.machine_hours) + num(op.labor_hours)) * qty;
      const availableHours = num(op.capacity_hours_per_day) * days;
      const utilization = availableHours ? (requiredHours / availableHours) * 100 : 0;
      return {
        operation: op.operation_number,
        workCenter: op.work_center,
        description: op.description,
        requiredHours,
        availableHours,
        utilization,
        status: utilization > 100 ? 'overloaded' : utilization > 85 ? 'tight' : 'available',
      };
    });
    res.json({
      materialNumber,
      orderQuantity: qty,
      dueDays: days,
      loads,
      bottlenecks: loads.filter((load) => load.status !== 'available'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bom-items', auth, async (req, res) => {
  try {
    await ensureTables();
    const { materialNumber = 'FG-1000', component_material, component_description, quantity, unit = 'EA', scrap_percent = 0, unit_cost = 0, procurement_type = 'buy' } = req.body || {};
    if (!component_material || !component_description || !quantity) return res.status(400).json({ error: 'component_material, component_description, and quantity required' });
    const bom = await getBom(materialNumber);
    if (!bom) return res.status(404).json({ error: 'BOM not found' });
    const result = await pool.query(
      `INSERT INTO sap_bom_items (bom_id, component_material, component_description, quantity, unit, scrap_percent, unit_cost, procurement_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [bom.id, component_material, component_description, quantity, unit, scrap_percent, unit_cost, procurement_type]
    );
    res.json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

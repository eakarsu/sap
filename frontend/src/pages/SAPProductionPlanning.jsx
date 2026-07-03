import { useEffect, useState } from 'react';
import { FiActivity, FiBox, FiCheckCircle, FiCpu, FiLayers, FiPlus, FiRefreshCw, FiTool } from 'react-icons/fi';
import {
  addSapBomItem,
  explodeSapBom,
  fetchSapProductionOverview,
  runSapCapacityCheck,
  runSapCostRollup,
} from '../api';

function Card({ children, style }) {
  return <div style={{ background:'#fff', border:'1px solid #E8EBF0', borderRadius:8, padding:16, ...style }}>{children}</div>;
}

function Metric({ label, value, icon: Icon }) {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:8, background:'#E8F4FD', color:'#0070F2', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={20} />
        </div>
        <div>
          <div style={{ fontSize:25, color:'#1D2D3E', fontWeight:800 }}>{value}</div>
          <div style={{ fontSize:12, color:'#6A767D', fontWeight:800, textTransform:'uppercase' }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Badge({ value }) {
  const v = String(value || '').toLowerCase();
  const colors = v === 'overloaded' ? ['#FDEDED', '#BB0000'] : v === 'tight' ? ['#FFF4E5', '#E76500'] : v === 'released' || v === 'available' ? ['#E6F4EA', '#1E7E34'] : ['#E8F4FD', '#0070F2'];
  return <span style={{ padding:'4px 9px', borderRadius:12, background:colors[0], color:colors[1], fontSize:11, fontWeight:800, textTransform:'capitalize', whiteSpace:'nowrap' }}>{String(value || 'n/a')}</span>;
}

const money = (value) => Number(value || 0).toLocaleString(undefined, { style:'currency', currency:'EUR', maximumFractionDigits:0 });
const number = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits:2 });

export default function SAPProductionPlanning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [materialNumber, setMaterialNumber] = useState('FG-1000');
  const [lotSize, setLotSize] = useState(10);
  const [bomExplosion, setBomExplosion] = useState(null);
  const [costRollup, setCostRollup] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [capacityForm, setCapacityForm] = useState({ materialNumber: 'FG-1000', orderQuantity: 100, dueDays: 5 });
  const [itemForm, setItemForm] = useState({
    materialNumber: 'FG-1000',
    component_material: 'COMP-LABEL',
    component_description: 'Compliance label',
    quantity: 1,
    unit: 'EA',
    scrap_percent: 0,
    unit_cost: 3,
    procurement_type: 'buy',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchSapProductionOverview();
      setData(res);
      setCostRollup(res?.defaultRollup || null);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runBom = async () => {
    setBusy('bom');
    setMessage('');
    try {
      setBomExplosion(await explodeSapBom(materialNumber, lotSize));
      setMessage('BOM explosion completed.');
    } catch {
      setMessage('Unable to explode BOM.');
    }
    setBusy('');
  };

  const runCost = async () => {
    setBusy('cost');
    setMessage('');
    try {
      const res = await runSapCostRollup({ materialNumber, lotSize: Number(lotSize) });
      setCostRollup(res?.rollup || null);
      setMessage('Cost rollup calculated and saved.');
      await load();
    } catch {
      setMessage('Unable to calculate cost rollup.');
    }
    setBusy('');
  };

  const runCapacity = async () => {
    setBusy('capacity');
    setMessage('');
    try {
      setCapacity(await runSapCapacityCheck({
        materialNumber: capacityForm.materialNumber,
        orderQuantity: Number(capacityForm.orderQuantity),
        dueDays: Number(capacityForm.dueDays),
      }));
      setMessage('Capacity check completed.');
    } catch {
      setMessage('Unable to run capacity check.');
    }
    setBusy('');
  };

  const addItem = async () => {
    setBusy('item');
    setMessage('');
    try {
      await addSapBomItem({
        ...itemForm,
        quantity: Number(itemForm.quantity),
        scrap_percent: Number(itemForm.scrap_percent),
        unit_cost: Number(itemForm.unit_cost),
      });
      setMessage('BOM item added.');
      await load();
    } catch {
      setMessage('Unable to add BOM item.');
    }
    setBusy('');
  };

  if (loading) return <div style={styles.page}><div style={styles.empty}>Loading SAP production planning...</div></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Production Planning</h1>
          <p style={styles.subtitle}>BOM explosion, routing operations, work-center capacity, and standard cost rollup.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}><FiRefreshCw size={15} /> Refresh</button>
      </div>

      <div style={styles.metrics}>
        <Metric label="Work Centers" value={data?.summary?.workCenters ?? 0} icon={FiTool} />
        <Metric label="BOMs" value={data?.summary?.boms ?? 0} icon={FiLayers} />
        <Metric label="Routings" value={data?.summary?.routings ?? 0} icon={FiActivity} />
        <Metric label="Lot Cost" value={money(data?.summary?.defaultLotCost)} icon={FiCpu} />
      </div>

      {message && <div style={styles.message}><FiCheckCircle size={14} /> {message}</div>}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Planning Run</h2>
            <div style={styles.runBar}>
              <input style={styles.input} value={materialNumber} onChange={(e) => setMaterialNumber(e.target.value)} placeholder="Material" />
              <input style={styles.input} type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="Lot size" />
              <button onClick={runBom} disabled={busy === 'bom'} style={styles.secondaryBtn}><FiLayers size={14} /> Explode BOM</button>
              <button onClick={runCost} disabled={busy === 'cost'} style={styles.primaryBtn}><FiCpu size={14} /> Cost Rollup</button>
            </div>
          </Card>

          {costRollup && (
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h2 style={styles.panelTitle}>Standard Cost Rollup</h2>
                <Badge value={costRollup.materialNumber} />
              </div>
              <div style={styles.costGrid}>
                <Metric label="Material" value={money(costRollup.materialCost)} icon={FiBox} />
                <Metric label="Labor" value={money(costRollup.laborCost)} icon={FiTool} />
                <Metric label="Machine" value={money(costRollup.machineCost)} icon={FiActivity} />
                <Metric label="Overhead" value={money(costRollup.overheadCost)} icon={FiCpu} />
                <Metric label="Total Cost" value={money(costRollup.totalCost)} icon={FiCheckCircle} />
              </div>
            </Card>
          )}

          {bomExplosion && (
            <Card>
              <h2 style={styles.panelTitle}>BOM Explosion</h2>
              <div style={styles.table}>
                <div style={styles.th}>Component</div>
                <div style={styles.th}>Required Qty</div>
                <div style={styles.th}>Scrap</div>
                <div style={styles.th}>Cost</div>
                {(bomExplosion.items || []).map((item) => (
                  <div key={item.id} style={styles.tr}>
                    <div style={styles.td}><strong>{item.component_material}</strong><br /><span>{item.component_description}</span></div>
                    <div style={styles.td}>{number(item.required_quantity)} {item.unit}</div>
                    <div style={styles.td}>{number(item.scrap_percent)}%</div>
                    <div style={styles.td}>{money(item.extended_cost)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 style={styles.panelTitle}>Routing and Work Centers</h2>
            <div style={styles.workCenterGrid}>
              {(data?.workCenters || []).map((wc) => (
                <div key={wc.id} style={styles.wcCard}>
                  <div style={styles.rowTitle}>{wc.work_center}</div>
                  <div style={styles.rowSub}>{wc.description}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                    <Badge value={`${number(wc.capacity_hours_per_day)}h/day`} />
                    <Badge value={`${money(wc.hourly_rate)}/h`} />
                    <Badge value={`${number(wc.queue_days)} queue days`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Capacity Check</h2>
            <div style={styles.form}>
              <input style={styles.input} value={capacityForm.materialNumber} onChange={(e) => setCapacityForm({ ...capacityForm, materialNumber: e.target.value })} />
              <input style={styles.input} type="number" value={capacityForm.orderQuantity} onChange={(e) => setCapacityForm({ ...capacityForm, orderQuantity: e.target.value })} />
              <input style={styles.input} type="number" value={capacityForm.dueDays} onChange={(e) => setCapacityForm({ ...capacityForm, dueDays: e.target.value })} />
              <button onClick={runCapacity} disabled={busy === 'capacity'} style={styles.primaryBtn}><FiActivity size={14} /> Check Capacity</button>
            </div>
            {capacity && (
              <div style={{ display:'grid', gap:8, marginTop:12 }}>
                {(capacity.loads || []).map((load) => (
                  <div key={load.operation} style={styles.loadRow}>
                    <div>
                      <div style={styles.rowTitle}>{load.workCenter} · Op {load.operation}</div>
                      <div style={styles.rowSub}>{load.description}</div>
                      <div style={{ fontSize:12, color:'#354A5F' }}>{number(load.requiredHours)}h required / {number(load.availableHours)}h available</div>
                    </div>
                    <Badge value={load.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Add BOM Item</h2>
            <div style={styles.form}>
              <input style={styles.input} value={itemForm.materialNumber} onChange={(e) => setItemForm({ ...itemForm, materialNumber: e.target.value })} placeholder="Header material" />
              <input style={styles.input} value={itemForm.component_material} onChange={(e) => setItemForm({ ...itemForm, component_material: e.target.value })} placeholder="Component material" />
              <input style={styles.input} value={itemForm.component_description} onChange={(e) => setItemForm({ ...itemForm, component_description: e.target.value })} placeholder="Description" />
              <div style={styles.formGrid}>
                <input style={styles.input} type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} placeholder="Qty" />
                <input style={styles.input} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="Unit" />
              </div>
              <div style={styles.formGrid}>
                <input style={styles.input} type="number" value={itemForm.scrap_percent} onChange={(e) => setItemForm({ ...itemForm, scrap_percent: e.target.value })} placeholder="Scrap %" />
                <input style={styles.input} type="number" value={itemForm.unit_cost} onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })} placeholder="Unit cost" />
              </div>
              <button onClick={addItem} disabled={busy === 'item'} style={styles.primaryBtn}><FiPlus size={14} /> Add Item</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Coverage</h2>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
              {(data?.capabilities || []).map((item) => <span key={item} style={styles.capability}>{item}</span>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding:'24px 32px', maxWidth:1500, margin:'0 auto' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, marginBottom:18 },
  title: { margin:0, fontSize:24, fontWeight:800, color:'#1D2D3E' },
  subtitle: { margin:'4px 0 0', color:'#6A767D', fontSize:13 },
  metrics: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:16 },
  layout: { display:'grid', gridTemplateColumns:'minmax(0, 1fr) 390px', gap:16, alignItems:'start' },
  refreshBtn: { display:'flex', alignItems:'center', gap:7, padding:'9px 13px', border:'1px solid #D1D9E0', background:'#fff', color:'#354A5F', borderRadius:8, fontWeight:800, cursor:'pointer' },
  message: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', marginBottom:14, background:'#E6F4EA', border:'1px solid #CDECCB', color:'#1E7E34', borderRadius:8, fontSize:13, fontWeight:800 },
  panelTitle: { margin:0, fontSize:16, color:'#1D2D3E' },
  runBar: { display:'grid', gridTemplateColumns:'1fr 120px auto auto', gap:8, marginTop:12 },
  input: { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', fontFamily:'inherit' },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' },
  secondaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'1px solid #B8D8F8', borderRadius:8, background:'#EFF6FF', color:'#0070F2', fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' },
  costGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 },
  table: { display:'grid', gridTemplateColumns:'1.4fr 0.8fr 0.5fr 0.7fr', border:'1px solid #E8EBF0', borderRadius:8, overflow:'hidden', marginTop:12 },
  th: { padding:'10px 12px', background:'#FAFBFC', color:'#6A767D', fontSize:11, fontWeight:800, textTransform:'uppercase', borderBottom:'1px solid #E8EBF0' },
  tr: { display:'contents' },
  td: { padding:'10px 12px', borderBottom:'1px solid #F0F2F5', color:'#354A5F', fontSize:13 },
  workCenterGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10, marginTop:12 },
  wcCard: { padding:12, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  rowTitle: { fontSize:13, color:'#1D2D3E', fontWeight:800 },
  rowSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  form: { display:'grid', gap:9, marginTop:12 },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  loadRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, padding:10, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  capability: { padding:'7px 10px', borderRadius:6, background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', fontSize:12, fontWeight:800 },
  empty: { padding:40, textAlign:'center', color:'#6A767D' },
};

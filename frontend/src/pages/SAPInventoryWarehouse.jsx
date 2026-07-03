import { useEffect, useState } from 'react';
import { FiArchive, FiCheckCircle, FiClipboard, FiDollarSign, FiPackage, FiRefreshCw, FiSave, FiShuffle } from 'react-icons/fi';
import {
  createSapCycleCount,
  createSapReservation,
  fetchSapInventoryOverview,
  postSapGoodsMovement,
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
  const colors = v === 'blocked' ? ['#FDEDED', '#BB0000'] : v === 'quality' ? ['#FFF4E5', '#E76500'] : v === 'open' || v === 'unrestricted' ? ['#E6F4EA', '#1E7E34'] : ['#E8F4FD', '#0070F2'];
  return <span style={{ padding:'4px 9px', borderRadius:12, background:colors[0], color:colors[1], fontSize:11, fontWeight:800, textTransform:'capitalize', whiteSpace:'nowrap' }}>{String(value || 'n/a')}</span>;
}

const money = (value) => Number(value || 0).toLocaleString(undefined, { style:'currency', currency:'EUR', maximumFractionDigits:0 });
const num = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits:2 });

export default function SAPInventoryWarehouse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [movement, setMovement] = useState({
    movementType: '101',
    materialNumber: 'FG-1000',
    plant: '1000',
    storageLocation: '0001',
    targetStorageLocation: '0002',
    batch: 'BATCH-A',
    quantity: 5,
    unit: 'EA',
    reason: 'Manual goods movement',
  });
  const [reservation, setReservation] = useState({
    materialNumber: 'COMP-BOARD',
    plant: '1000',
    storageLocation: '0001',
    requiredQuantity: 25,
    costCenter: 'CC-1000',
  });
  const [cycleCount, setCycleCount] = useState({
    materialNumber: 'FG-1000',
    plant: '1000',
    storageLocation: '0001',
    batch: 'BATCH-A',
    countedQuantity: 250,
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchSapInventoryOverview());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const postMovement = async () => {
    setBusy('movement');
    setMessage('');
    try {
      const res = await postSapGoodsMovement({ ...movement, quantity: Number(movement.quantity) });
      setMessage(`Material document ${res?.document?.document_number || ''} posted.`);
      await load();
    } catch {
      setMessage('Unable to post goods movement. Check stock and movement type.');
    }
    setBusy('');
  };

  const saveReservation = async () => {
    setBusy('reservation');
    setMessage('');
    try {
      const res = await createSapReservation({ ...reservation, requiredQuantity: Number(reservation.requiredQuantity) });
      setMessage(`Reservation ${res?.reservation?.reservation_number || ''} created.`);
      await load();
    } catch {
      setMessage('Unable to create reservation.');
    }
    setBusy('');
  };

  const saveCount = async () => {
    setBusy('count');
    setMessage('');
    try {
      const res = await createSapCycleCount({ ...cycleCount, countedQuantity: Number(cycleCount.countedQuantity) });
      setMessage(`Cycle count ${res?.cycleCount?.count_document || ''} saved.`);
      await load();
    } catch {
      setMessage('Unable to save cycle count.');
    }
    setBusy('');
  };

  if (loading) return <div style={styles.page}><div style={styles.empty}>Loading SAP inventory...</div></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Inventory & Warehouse</h1>
          <p style={styles.subtitle}>Stock balances, goods movements, reservations, cycle counts, and material document history.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}><FiRefreshCw size={15} /> Refresh</button>
      </div>

      <div style={styles.metrics}>
        <Metric label="Stock Items" value={data?.summary?.stockItems ?? 0} icon={FiPackage} />
        <Metric label="Stock Value" value={money(data?.summary?.stockValue)} icon={FiDollarSign} />
        <Metric label="Material Docs" value={data?.summary?.materialDocuments ?? 0} icon={FiClipboard} />
        <Metric label="Open Reservations" value={data?.summary?.openReservations ?? 0} icon={FiArchive} />
        <Metric label="Cycle Counts" value={data?.summary?.cycleCounts ?? 0} icon={FiCheckCircle} />
      </div>

      {message && <div style={styles.message}><FiCheckCircle size={14} /> {message}</div>}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Stock Overview</h2>
            <div style={styles.table}>
              <div style={styles.th}>Material</div>
              <div style={styles.th}>Location</div>
              <div style={styles.th}>Stock Type</div>
              <div style={styles.th}>Quantity</div>
              <div style={styles.th}>Value</div>
              {(data?.stock || []).map((row) => (
                <div key={row.id} style={styles.tr}>
                  <div style={styles.td}><strong>{row.material_number}</strong><br /><span>{row.material_description}</span></div>
                  <div style={styles.td}>{row.plant} / {row.storage_location}<br /><span>{row.batch || 'No batch'}</span></div>
                  <div style={styles.td}><Badge value={row.stock_type} /></div>
                  <div style={styles.td}>{num(row.quantity)} {row.unit}</div>
                  <div style={styles.td}>{money(Number(row.quantity) * Number(row.moving_average_price))}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Material Documents</h2>
            <div style={styles.list}>
              {(data?.materialDocuments || []).map((doc) => (
                <div key={doc.id} style={styles.row}>
                  <div>
                    <div style={styles.rowTitle}>{doc.document_number} · Movement {doc.movement_type}</div>
                    <div style={styles.rowSub}>{doc.material_number} · {doc.plant}/{doc.storage_location}{doc.target_storage_location ? ` → ${doc.target_storage_location}` : ''}</div>
                    <div style={{ fontSize:12, color:'#354A5F', marginTop:4 }}>{doc.reason}</div>
                  </div>
                  <div style={{ textAlign:'right', fontWeight:800 }}>{num(doc.quantity)} {doc.unit}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Reservations & Cycle Counts</h2>
            <div style={styles.split}>
              <div>
                {(data?.reservations || []).map((res) => (
                  <div key={res.id} style={styles.smallRow}>
                    <div>
                      <div style={styles.rowTitle}>{res.reservation_number}</div>
                      <div style={styles.rowSub}>{res.material_number} · {num(res.required_quantity)} required</div>
                    </div>
                    <Badge value={res.status} />
                  </div>
                ))}
              </div>
              <div>
                {(data?.cycleCounts || []).map((count) => (
                  <div key={count.id} style={styles.smallRow}>
                    <div>
                      <div style={styles.rowTitle}>{count.count_document}</div>
                      <div style={styles.rowSub}>{count.material_number} · Diff {num(count.difference_quantity)}</div>
                    </div>
                    <Badge value={count.status} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Post Goods Movement</h2>
            <div style={styles.form}>
              <select style={styles.input} value={movement.movementType} onChange={(e) => setMovement({ ...movement, movementType: e.target.value })}>
                <option value="101">101 Goods Receipt</option>
                <option value="201">201 Goods Issue to Cost Center</option>
                <option value="261">261 Goods Issue to Order</option>
                <option value="311">311 Transfer Posting</option>
                <option value="321">321 Quality to Unrestricted</option>
                <option value="601">601 Goods Issue Delivery</option>
              </select>
              <input style={styles.input} value={movement.materialNumber} onChange={(e) => setMovement({ ...movement, materialNumber: e.target.value })} />
              <div style={styles.formGrid}>
                <input style={styles.input} value={movement.plant} onChange={(e) => setMovement({ ...movement, plant: e.target.value })} />
                <input style={styles.input} value={movement.storageLocation} onChange={(e) => setMovement({ ...movement, storageLocation: e.target.value })} />
              </div>
              <input style={styles.input} value={movement.targetStorageLocation} onChange={(e) => setMovement({ ...movement, targetStorageLocation: e.target.value })} placeholder="Target storage location" />
              <input style={styles.input} value={movement.batch} onChange={(e) => setMovement({ ...movement, batch: e.target.value })} placeholder="Batch" />
              <div style={styles.formGrid}>
                <input style={styles.input} type="number" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} />
                <input style={styles.input} value={movement.unit} onChange={(e) => setMovement({ ...movement, unit: e.target.value })} />
              </div>
              <input style={styles.input} value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} />
              <button onClick={postMovement} disabled={busy === 'movement'} style={styles.primaryBtn}><FiShuffle size={14} /> Post Movement</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Create Reservation</h2>
            <div style={styles.form}>
              <input style={styles.input} value={reservation.materialNumber} onChange={(e) => setReservation({ ...reservation, materialNumber: e.target.value })} />
              <div style={styles.formGrid}>
                <input style={styles.input} value={reservation.plant} onChange={(e) => setReservation({ ...reservation, plant: e.target.value })} />
                <input style={styles.input} value={reservation.storageLocation} onChange={(e) => setReservation({ ...reservation, storageLocation: e.target.value })} />
              </div>
              <input style={styles.input} type="number" value={reservation.requiredQuantity} onChange={(e) => setReservation({ ...reservation, requiredQuantity: e.target.value })} />
              <input style={styles.input} value={reservation.costCenter} onChange={(e) => setReservation({ ...reservation, costCenter: e.target.value })} />
              <button onClick={saveReservation} disabled={busy === 'reservation'} style={styles.primaryBtn}><FiSave size={14} /> Save Reservation</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Cycle Count</h2>
            <div style={styles.form}>
              <input style={styles.input} value={cycleCount.materialNumber} onChange={(e) => setCycleCount({ ...cycleCount, materialNumber: e.target.value })} />
              <div style={styles.formGrid}>
                <input style={styles.input} value={cycleCount.plant} onChange={(e) => setCycleCount({ ...cycleCount, plant: e.target.value })} />
                <input style={styles.input} value={cycleCount.storageLocation} onChange={(e) => setCycleCount({ ...cycleCount, storageLocation: e.target.value })} />
              </div>
              <input style={styles.input} value={cycleCount.batch} onChange={(e) => setCycleCount({ ...cycleCount, batch: e.target.value })} />
              <input style={styles.input} type="number" value={cycleCount.countedQuantity} onChange={(e) => setCycleCount({ ...cycleCount, countedQuantity: e.target.value })} />
              <button onClick={saveCount} disabled={busy === 'count'} style={styles.primaryBtn}><FiCheckCircle size={14} /> Save Count</button>
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
  metrics: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:16 },
  layout: { display:'grid', gridTemplateColumns:'minmax(0, 1fr) 390px', gap:16, alignItems:'start' },
  refreshBtn: { display:'flex', alignItems:'center', gap:7, padding:'9px 13px', border:'1px solid #D1D9E0', background:'#fff', color:'#354A5F', borderRadius:8, fontWeight:800, cursor:'pointer' },
  message: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', marginBottom:14, background:'#E6F4EA', border:'1px solid #CDECCB', color:'#1E7E34', borderRadius:8, fontSize:13, fontWeight:800 },
  panelTitle: { margin:0, fontSize:16, color:'#1D2D3E' },
  table: { display:'grid', gridTemplateColumns:'1.3fr 0.9fr 0.7fr 0.7fr 0.8fr', border:'1px solid #E8EBF0', borderRadius:8, overflow:'hidden', marginTop:12 },
  th: { padding:'10px 12px', background:'#FAFBFC', color:'#6A767D', fontSize:11, fontWeight:800, textTransform:'uppercase', borderBottom:'1px solid #E8EBF0' },
  tr: { display:'contents' },
  td: { padding:'10px 12px', borderBottom:'1px solid #F0F2F5', color:'#354A5F', fontSize:13 },
  list: { display:'grid', gap:8, marginTop:12 },
  row: { display:'flex', justifyContent:'space-between', gap:12, padding:10, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  rowTitle: { fontSize:13, color:'#1D2D3E', fontWeight:800 },
  rowSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  split: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 },
  smallRow: { display:'flex', justifyContent:'space-between', gap:8, padding:9, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC', marginBottom:8 },
  form: { display:'grid', gap:9, marginTop:12 },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  input: { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', fontFamily:'inherit' },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer' },
  capability: { padding:'7px 10px', borderRadius:6, background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', fontSize:12, fontWeight:800 },
  empty: { padding:40, textAlign:'center', color:'#6A767D' },
};

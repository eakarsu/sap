import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCreditCard, FiFileText, FiPercent, FiPlus, FiRefreshCw, FiSave, FiShoppingCart } from 'react-icons/fi';
import {
  fetchSapSdOverview,
  saveSapConditionRecord,
  saveSapTaxRule,
  simulateSapBilling,
  simulateSapPricing,
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
  return <span style={{ padding:'4px 9px', borderRadius:12, background:'#E8F4FD', color:'#0070F2', fontSize:11, fontWeight:800, whiteSpace:'nowrap' }}>{String(value || 'n/a')}</span>;
}

const money = (value) => Number(value || 0).toLocaleString(undefined, { style:'currency', currency:'EUR', maximumFractionDigits:2 });
const num = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits:2 });

export default function SAPSalesDistribution() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [pricing, setPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    materialNumber: 'FG-1000',
    quantity: 10,
    customerGroup: 'VIP',
    countryCode: 'DE',
  });
  const [billingForm, setBillingForm] = useState({
    sourceDocument: 'SO-SIM-1000',
    customerName: 'Acme Corporation',
    materialNumber: 'FG-1000',
    quantity: 10,
    customerGroup: 'VIP',
    countryCode: 'DE',
  });
  const [conditionForm, setConditionForm] = useState({
    condition_type: 'K005',
    procedure_key: 'ZPRC01',
    material_number: 'FG-1000',
    customer_group: '*',
    rate_type: 'percent',
    rate_value: -2,
    scale_from_qty: 100,
  });
  const [taxForm, setTaxForm] = useState({
    country_code: 'CA',
    tax_code: 'C1',
    description: 'Canada GST/HST estimate',
    rate_percent: 13,
    e_document_required: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchSapSdOverview();
      setData(res);
      setPricing(res?.sample || null);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runPricing = async () => {
    setBusy('pricing');
    setMessage('');
    try {
      const res = await simulateSapPricing({ ...pricingForm, quantity: Number(pricingForm.quantity) });
      setPricing(res?.pricing || null);
      setMessage('Pricing simulation completed.');
    } catch {
      setMessage('Unable to simulate pricing.');
    }
    setBusy('');
  };

  const runBilling = async () => {
    setBusy('billing');
    setMessage('');
    try {
      const res = await simulateSapBilling({ ...billingForm, quantity: Number(billingForm.quantity) });
      setPricing(res?.pricing || null);
      setMessage(`Billing simulation saved for ${res?.billing?.source_document || billingForm.sourceDocument}.`);
      await load();
    } catch {
      setMessage('Unable to simulate billing.');
    }
    setBusy('');
  };

  const saveCondition = async () => {
    setBusy('condition');
    setMessage('');
    try {
      await saveSapConditionRecord({
        ...conditionForm,
        rate_value: Number(conditionForm.rate_value),
        scale_from_qty: Number(conditionForm.scale_from_qty),
      });
      setMessage('Condition record saved.');
      await load();
    } catch {
      setMessage('Unable to save condition record.');
    }
    setBusy('');
  };

  const saveTax = async () => {
    setBusy('tax');
    setMessage('');
    try {
      await saveSapTaxRule({ ...taxForm, rate_percent: Number(taxForm.rate_percent) });
      setMessage('Tax rule saved.');
      await load();
    } catch {
      setMessage('Unable to save tax rule.');
    }
    setBusy('');
  };

  if (loading) return <div style={styles.page}><div style={styles.empty}>Loading SAP SD pricing...</div></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP SD Pricing & Billing</h1>
          <p style={styles.subtitle}>Pricing procedures, condition records, tax determination, copy control, and billing simulation.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}><FiRefreshCw size={15} /> Refresh</button>
      </div>

      <div style={styles.metrics}>
        <Metric label="Procedures" value={data?.summary?.procedures ?? 0} icon={FiShoppingCart} />
        <Metric label="Conditions" value={data?.summary?.conditionRecords ?? 0} icon={FiPercent} />
        <Metric label="Tax Rules" value={data?.summary?.taxRules ?? 0} icon={FiCreditCard} />
        <Metric label="Copy Control" value={data?.summary?.copyControlRules ?? 0} icon={FiFileText} />
        <Metric label="Sample Gross" value={money(data?.summary?.sampleGrossValue)} icon={FiCheckCircle} />
      </div>

      {message && <div style={styles.message}><FiCheckCircle size={14} /> {message}</div>}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Pricing Simulation</h2>
            <div style={styles.runBar}>
              <input style={styles.input} value={pricingForm.materialNumber} onChange={(e) => setPricingForm({ ...pricingForm, materialNumber: e.target.value })} placeholder="Material" />
              <input style={styles.input} type="number" value={pricingForm.quantity} onChange={(e) => setPricingForm({ ...pricingForm, quantity: e.target.value })} placeholder="Qty" />
              <input style={styles.input} value={pricingForm.customerGroup} onChange={(e) => setPricingForm({ ...pricingForm, customerGroup: e.target.value })} placeholder="Customer group" />
              <input style={styles.input} value={pricingForm.countryCode} onChange={(e) => setPricingForm({ ...pricingForm, countryCode: e.target.value })} placeholder="Country" />
              <button onClick={runPricing} disabled={busy === 'pricing'} style={styles.primaryBtn}><FiPercent size={14} /> Price</button>
            </div>
          </Card>

          {pricing && (
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h2 style={styles.panelTitle}>Pricing Result</h2>
                <Badge value={`${pricing.materialNumber} · ${num(pricing.quantity)} EA`} />
              </div>
              <div style={styles.priceGrid}>
                <Metric label="Base" value={money(pricing.baseValue)} icon={FiShoppingCart} />
                <Metric label="Discount" value={money(pricing.discountValue)} icon={FiPercent} />
                <Metric label="Surcharge" value={money(pricing.surchargeValue)} icon={FiPlus} />
                <Metric label="Tax" value={money(pricing.taxValue)} icon={FiCreditCard} />
                <Metric label="Gross" value={money(pricing.grossValue)} icon={FiCheckCircle} />
              </div>
              <div style={styles.table}>
                <div style={styles.th}>Condition</div>
                <div style={styles.th}>Rate</div>
                <div style={styles.th}>Scale</div>
                <div style={styles.th}>Value</div>
                {(pricing.conditions || []).map((condition) => (
                  <div key={condition.id} style={styles.tr}>
                    <div style={styles.td}><strong>{condition.condition_type}</strong><br /><span>{condition.customer_group}</span></div>
                    <div style={styles.td}>{condition.rate_type === 'percent' ? `${num(condition.rate_value)}%` : money(condition.rate_value)}</div>
                    <div style={styles.td}>{num(condition.scale_from_qty)}</div>
                    <div style={styles.td}>{money(condition.value)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 style={styles.panelTitle}>Copy Control</h2>
            <div style={styles.copyGrid}>
              {(data?.copyRules || []).map((rule) => (
                <div key={rule.id} style={styles.copyCard}>
                  <div style={styles.rowTitle}>{rule.source_document} → {rule.target_document}</div>
                  <div style={styles.rowSub}>{rule.item_category} · {rule.quantity_rule} · {rule.billing_relevance}</div>
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <Badge value={rule.copy_pricing ? 'copy pricing' : 'redetermine pricing'} />
                    <Badge value={rule.copy_texts ? 'copy texts' : 'no texts'} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Billing Simulation History</h2>
            <div style={styles.historyList}>
              {(data?.simulations || []).map((simulation) => (
                <div key={simulation.id} style={styles.historyRow}>
                  <div>
                    <div style={styles.rowTitle}>{simulation.source_document} · {simulation.customer_name}</div>
                    <div style={styles.rowSub}>{simulation.material_number} · Qty {num(simulation.quantity)} · {new Date(simulation.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign:'right', fontWeight:800, color:'#1D2D3E' }}>{money(simulation.gross_value)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Create Billing Simulation</h2>
            <div style={styles.form}>
              <input style={styles.input} value={billingForm.sourceDocument} onChange={(e) => setBillingForm({ ...billingForm, sourceDocument: e.target.value })} placeholder="Source document" />
              <input style={styles.input} value={billingForm.customerName} onChange={(e) => setBillingForm({ ...billingForm, customerName: e.target.value })} placeholder="Customer" />
              <input style={styles.input} value={billingForm.materialNumber} onChange={(e) => setBillingForm({ ...billingForm, materialNumber: e.target.value })} placeholder="Material" />
              <input style={styles.input} type="number" value={billingForm.quantity} onChange={(e) => setBillingForm({ ...billingForm, quantity: e.target.value })} placeholder="Quantity" />
              <div style={styles.formGrid}>
                <input style={styles.input} value={billingForm.customerGroup} onChange={(e) => setBillingForm({ ...billingForm, customerGroup: e.target.value })} placeholder="Group" />
                <input style={styles.input} value={billingForm.countryCode} onChange={(e) => setBillingForm({ ...billingForm, countryCode: e.target.value })} placeholder="Country" />
              </div>
              <button onClick={runBilling} disabled={busy === 'billing'} style={styles.primaryBtn}><FiFileText size={14} /> Simulate Billing</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Add Condition Record</h2>
            <div style={styles.form}>
              <div style={styles.formGrid}>
                <input style={styles.input} value={conditionForm.condition_type} onChange={(e) => setConditionForm({ ...conditionForm, condition_type: e.target.value })} />
                <input style={styles.input} value={conditionForm.procedure_key} onChange={(e) => setConditionForm({ ...conditionForm, procedure_key: e.target.value })} />
              </div>
              <input style={styles.input} value={conditionForm.material_number} onChange={(e) => setConditionForm({ ...conditionForm, material_number: e.target.value })} />
              <input style={styles.input} value={conditionForm.customer_group} onChange={(e) => setConditionForm({ ...conditionForm, customer_group: e.target.value })} />
              <select style={styles.input} value={conditionForm.rate_type} onChange={(e) => setConditionForm({ ...conditionForm, rate_type: e.target.value })}>
                <option value="amount">Amount</option>
                <option value="percent">Percent</option>
              </select>
              <div style={styles.formGrid}>
                <input style={styles.input} type="number" value={conditionForm.rate_value} onChange={(e) => setConditionForm({ ...conditionForm, rate_value: e.target.value })} />
                <input style={styles.input} type="number" value={conditionForm.scale_from_qty} onChange={(e) => setConditionForm({ ...conditionForm, scale_from_qty: e.target.value })} />
              </div>
              <button onClick={saveCondition} disabled={busy === 'condition'} style={styles.primaryBtn}><FiSave size={14} /> Save Condition</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Tax Rule</h2>
            <div style={styles.form}>
              <div style={styles.formGrid}>
                <input style={styles.input} value={taxForm.country_code} onChange={(e) => setTaxForm({ ...taxForm, country_code: e.target.value })} />
                <input style={styles.input} value={taxForm.tax_code} onChange={(e) => setTaxForm({ ...taxForm, tax_code: e.target.value })} />
              </div>
              <input style={styles.input} value={taxForm.description} onChange={(e) => setTaxForm({ ...taxForm, description: e.target.value })} />
              <input style={styles.input} type="number" value={taxForm.rate_percent} onChange={(e) => setTaxForm({ ...taxForm, rate_percent: e.target.value })} />
              <label style={styles.checkbox}><input type="checkbox" checked={taxForm.e_document_required} onChange={(e) => setTaxForm({ ...taxForm, e_document_required: e.target.checked })} /> E-document required</label>
              <button onClick={saveTax} disabled={busy === 'tax'} style={styles.primaryBtn}><FiSave size={14} /> Save Tax Rule</button>
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
  runBar: { display:'grid', gridTemplateColumns:'1fr 90px 130px 80px auto', gap:8, marginTop:12 },
  input: { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', fontFamily:'inherit' },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' },
  priceGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(145px, 1fr))', gap:10, marginBottom:12 },
  table: { display:'grid', gridTemplateColumns:'1fr 0.7fr 0.5fr 0.7fr', border:'1px solid #E8EBF0', borderRadius:8, overflow:'hidden' },
  th: { padding:'10px 12px', background:'#FAFBFC', color:'#6A767D', fontSize:11, fontWeight:800, textTransform:'uppercase', borderBottom:'1px solid #E8EBF0' },
  tr: { display:'contents' },
  td: { padding:'10px 12px', borderBottom:'1px solid #F0F2F5', color:'#354A5F', fontSize:13 },
  copyGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10, marginTop:12 },
  copyCard: { padding:12, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  rowTitle: { fontSize:13, color:'#1D2D3E', fontWeight:800 },
  rowSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  historyList: { display:'grid', gap:8, marginTop:12 },
  historyRow: { display:'flex', justifyContent:'space-between', gap:12, padding:10, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  form: { display:'grid', gap:9, marginTop:12 },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  checkbox: { display:'flex', gap:8, alignItems:'center', color:'#354A5F', fontSize:13, fontWeight:700 },
  capability: { padding:'7px 10px', borderRadius:6, background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', fontSize:12, fontWeight:800 },
  empty: { padding:40, textAlign:'center', color:'#6A767D' },
};

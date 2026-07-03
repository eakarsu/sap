import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCheckCircle, FiDollarSign, FiFileText, FiLock, FiRefreshCw, FiSave, FiUnlock } from 'react-icons/fi';
import {
  fetchSapFinanceOverview,
  postSapJournal,
  saveSapGlAccount,
  updateSapFiscalPeriod,
} from '../api';

function Card({ children, style }) {
  return <div style={{ background:'#fff', border:'1px solid #E8EBF0', borderRadius:8, padding:16, ...style }}>{children}</div>;
}

function Badge({ value }) {
  const v = String(value || '').toLowerCase();
  const colors = v === 'open' || v === 'balanced' ? ['#E6F4EA', '#1E7E34'] : v === 'closed' ? ['#F0F2F5', '#6A767D'] : v === 'unbalanced' ? ['#FDEDED', '#BB0000'] : ['#E8F4FD', '#0070F2'];
  return <span style={{ padding:'4px 9px', borderRadius:12, background:colors[0], color:colors[1], fontSize:11, fontWeight:800, textTransform:'capitalize', whiteSpace:'nowrap' }}>{String(value || 'unknown')}</span>;
}

function Metric({ label, value, icon: Icon }) {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'#E8F4FD', color:'#0070F2' }}>
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

const money = (value) => Number(value || 0).toLocaleString(undefined, { style:'currency', currency:'EUR', maximumFractionDigits:0 });

export default function SAPFinanceLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [journal, setJournal] = useState({
    companyCode: '1000',
    fiscalYear: new Date().getFullYear(),
    period: new Date().getMonth() + 1,
    documentType: 'SA',
    debitAccount: '610000',
    creditAccount: '200000',
    amount: 10000,
    text: 'Manual accrual posting',
  });
  const [account, setAccount] = useState({
    account_number: '700000',
    account_name: 'Custom Operating Expense',
    account_type: 'Expense',
    financial_statement_item: 'Income Statement',
    normal_balance: 'debit',
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchSapFinanceOverview());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const trialTotal = useMemo(() => {
    const rows = data?.trialBalance || [];
    return rows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  }, [data]);

  const submitJournal = async () => {
    setBusy('journal');
    setMessage('');
    try {
      await postSapJournal({
        companyCode: journal.companyCode,
        fiscalYear: Number(journal.fiscalYear),
        period: Number(journal.period),
        documentType: journal.documentType,
        lines: [
          { glAccount: journal.debitAccount, debit: Number(journal.amount), credit: 0, text: journal.text },
          { glAccount: journal.creditAccount, debit: 0, credit: Number(journal.amount), text: journal.text },
        ],
      });
      setMessage('Balanced journal posted to the universal journal.');
      await load();
    } catch (err) {
      setMessage('Unable to post journal. Check balance and fiscal period status.');
    }
    setBusy('');
  };

  const submitAccount = async () => {
    setBusy('account');
    setMessage('');
    try {
      await saveSapGlAccount(account);
      setMessage('GL account saved.');
      await load();
    } catch {
      setMessage('Unable to save GL account.');
    }
    setBusy('');
  };

  const togglePeriod = async (period) => {
    setBusy(`period-${period.id}`);
    setMessage('');
    const next = period.status === 'open' ? 'closed' : 'open';
    try {
      await updateSapFiscalPeriod(period.id, { status: next, close_step: next === 'closed' ? 'closed' : 'operational' });
      setMessage(`Fiscal period ${period.period}/${period.fiscal_year} ${next}.`);
      await load();
    } catch {
      setMessage('Unable to update fiscal period.');
    }
    setBusy('');
  };

  if (loading) return <div style={styles.page}><div style={styles.empty}>Loading SAP finance ledger...</div></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Finance Ledger</h1>
          <p style={styles.subtitle}>Universal journal, GL accounts, manual postings, fiscal periods, and trial balance.</p>
        </div>
        <button onClick={load} style={styles.refreshBtn}><FiRefreshCw size={15} /> Refresh</button>
      </div>

      <div style={styles.metrics}>
        <Metric label="GL Accounts" value={data?.summary?.accounts ?? 0} icon={FiBookOpen} />
        <Metric label="Journal Lines" value={data?.summary?.journalLines ?? 0} icon={FiFileText} />
        <Metric label="Open Periods" value={data?.summary?.openPeriods ?? 0} icon={FiUnlock} />
        <Metric label="Debit" value={money(data?.summary?.totalDebit)} icon={FiDollarSign} />
        <Metric label="Credit" value={money(data?.summary?.totalCredit)} icon={FiDollarSign} />
      </div>

      {message && <div style={styles.message}><FiCheckCircle size={14} /> {message}</div>}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={styles.panelTitle}>Trial Balance</h2>
              <Badge value={Math.abs(trialTotal) < 0.001 ? 'balanced' : 'unbalanced'} />
            </div>
            <div style={styles.table}>
              <div style={styles.th}>GL Account</div>
              <div style={styles.th}>Debit</div>
              <div style={styles.th}>Credit</div>
              <div style={styles.th}>Balance</div>
              {(data?.trialBalance || []).map((row) => (
                <div key={row.gl_account} style={styles.tr}>
                  <div style={styles.td}><strong>{row.gl_account}</strong></div>
                  <div style={styles.td}>{money(row.debit)}</div>
                  <div style={styles.td}>{money(row.credit)}</div>
                  <div style={styles.td}>{money(row.balance)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Universal Journal Lines</h2>
            <div style={styles.journalList}>
              {(data?.journalLines || []).slice(0, 30).map((line) => (
                <div key={line.id} style={styles.journalRow}>
                  <div>
                    <div style={styles.rowTitle}>{line.document_number} · Line {line.line_item}</div>
                    <div style={styles.rowSub}>{line.gl_account} · {line.document_type} · Period {line.period}/{line.fiscal_year}</div>
                    <div style={{ fontSize:12, color:'#354A5F', marginTop:4 }}>{line.text}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ color:'#1E7E34', fontWeight:800 }}>{money(line.debit)}</div>
                    <div style={{ color:'#BB0000', fontWeight:800 }}>{money(line.credit)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Post Manual Journal</h2>
            <div style={styles.form}>
              <div style={styles.formGrid}>
                <input style={styles.input} value={journal.companyCode} onChange={(e) => setJournal({ ...journal, companyCode: e.target.value })} placeholder="Company code" />
                <input style={styles.input} type="number" value={journal.period} onChange={(e) => setJournal({ ...journal, period: e.target.value })} placeholder="Period" />
              </div>
              <div style={styles.formGrid}>
                <input style={styles.input} value={journal.debitAccount} onChange={(e) => setJournal({ ...journal, debitAccount: e.target.value })} placeholder="Debit account" />
                <input style={styles.input} value={journal.creditAccount} onChange={(e) => setJournal({ ...journal, creditAccount: e.target.value })} placeholder="Credit account" />
              </div>
              <input style={styles.input} type="number" value={journal.amount} onChange={(e) => setJournal({ ...journal, amount: e.target.value })} placeholder="Amount" />
              <input style={styles.input} value={journal.text} onChange={(e) => setJournal({ ...journal, text: e.target.value })} placeholder="Text" />
              <button onClick={submitJournal} disabled={busy === 'journal'} style={styles.primaryBtn}><FiSave size={14} /> {busy === 'journal' ? 'Posting...' : 'Post Journal'}</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Fiscal Period Control</h2>
            <div style={styles.periodList}>
              {(data?.periods || []).slice(0, 12).map((period) => (
                <div key={period.id} style={styles.periodRow}>
                  <div>
                    <div style={styles.rowTitle}>{period.company_code} · {period.period}/{period.fiscal_year}</div>
                    <div style={styles.rowSub}>{period.close_step}</div>
                  </div>
                  <button onClick={() => togglePeriod(period)} disabled={busy === `period-${period.id}`} style={period.status === 'open' ? styles.closeBtn : styles.openBtn}>
                    {period.status === 'open' ? <FiLock size={13} /> : <FiUnlock size={13} />}
                    {period.status === 'open' ? 'Close' : 'Open'}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Maintain GL Account</h2>
            <div style={styles.form}>
              <input style={styles.input} value={account.account_number} onChange={(e) => setAccount({ ...account, account_number: e.target.value })} placeholder="Account number" />
              <input style={styles.input} value={account.account_name} onChange={(e) => setAccount({ ...account, account_name: e.target.value })} placeholder="Account name" />
              <select style={styles.input} value={account.account_type} onChange={(e) => setAccount({ ...account, account_type: e.target.value })}>
                <option>Asset</option>
                <option>Liability</option>
                <option>Equity</option>
                <option>Revenue</option>
                <option>Expense</option>
              </select>
              <input style={styles.input} value={account.financial_statement_item} onChange={(e) => setAccount({ ...account, financial_statement_item: e.target.value })} />
              <select style={styles.input} value={account.normal_balance} onChange={(e) => setAccount({ ...account, normal_balance: e.target.value })}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
              <button onClick={submitAccount} disabled={busy === 'account'} style={styles.primaryBtn}><FiSave size={14} /> {busy === 'account' ? 'Saving...' : 'Save Account'}</button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Coverage</h2>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
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
  table: { display:'grid', gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr', border:'1px solid #E8EBF0', borderRadius:8, overflow:'hidden' },
  th: { padding:'10px 12px', background:'#FAFBFC', color:'#6A767D', fontSize:11, fontWeight:800, textTransform:'uppercase', borderBottom:'1px solid #E8EBF0' },
  tr: { display:'contents' },
  td: { padding:'10px 12px', borderBottom:'1px solid #F0F2F5', color:'#354A5F', fontSize:13 },
  journalList: { display:'grid', gap:8, marginTop:12 },
  journalRow: { display:'flex', justifyContent:'space-between', gap:12, padding:12, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  rowTitle: { fontSize:13, color:'#1D2D3E', fontWeight:800 },
  rowSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  form: { display:'grid', gap:9, marginTop:12 },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  input: { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', fontFamily:'inherit' },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer' },
  periodList: { display:'grid', gap:8, marginTop:12 },
  periodRow: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:10, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  closeBtn: { display:'flex', alignItems:'center', gap:6, padding:'7px 10px', border:'1px solid #FFE0B2', borderRadius:7, background:'#FFF8F0', color:'#E76500', fontWeight:800, cursor:'pointer' },
  openBtn: { display:'flex', alignItems:'center', gap:6, padding:'7px 10px', border:'1px solid #CDECCB', borderRadius:7, background:'#E6F4EA', color:'#1E7E34', fontWeight:800, cursor:'pointer' },
  capability: { padding:'7px 10px', borderRadius:6, background:'#F8F5FF', border:'1px solid #E8DEF8', color:'#6B2FA0', fontSize:12, fontWeight:800 },
  empty: { padding:40, textAlign:'center', color:'#6A767D' },
};

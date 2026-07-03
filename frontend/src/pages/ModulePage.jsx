import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modules, sidebarGroups } from '../modules';
import { fetchAll, createItem, fetchOne, updateItem, deleteItem, callAI, classifyTicket } from '../api';
import { FiSearch, FiX, FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiSave, FiCpu, FiAlertCircle, FiMail, FiCopy, FiTag, FiShield, FiCheckCircle, FiList, FiGitBranch, FiUsers } from 'react-icons/fi';
import ModuleCharts from './ModuleCharts';
import WorkflowActions from './WorkflowActions';
import RelatedRecords from './RelatedRecords';
import DocumentFlow from './DocumentFlow';
import WhereUsed from './WhereUsed';
import ChangeHistory from './ChangeHistory';
import OrgAssignment from './OrgAssignment';
import PartnerFunctions from './PartnerFunctions';
import PricingConditions from './PricingConditions';
import BatchInfo from './BatchInfo';
import ConfigLinks from './ConfigLinks';
import ApprovalChain from './ApprovalChain';
import CrossCompany from './CrossCompany';

function RelationDropdown({ field, value, onChange, inputStyle }) {
  const [options, setOptions] = useState([]);
  const [inputVal, setInputVal] = useState(value || '');
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const debRef = useRef(null);

  useEffect(() => { setInputVal(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = (q) => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setLoading(true);
      fetchAll(field.relation.module, q).then((res) => {
        const rows = Array.isArray(res) ? res : res?.data || [];
        setOptions(rows.slice(0, 10));
        setShowDrop(true);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 300);
  };

  const buildLabel = (row) => {
    const r = field.relation;
    if (r.labelField2) return `${row[r.labelField] || ''} ${row[r.labelField2] || ''}`.trim();
    return row[r.labelField] || '';
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); onChange(e.target.value); doSearch(e.target.value); }}
        onFocus={() => doSearch(inputVal)}
        style={inputStyle}
        placeholder={`Search ${field.label}...`}
      />
      {showDrop && options.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', borderRadius:6, boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:100, marginTop:2, maxHeight:200, overflowY:'auto', border:'1px solid #E8EBF0' }}>
          {options.map((row) => {
            const label = buildLabel(row);
            return (
              <div key={row.id} style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid #f0f2f5', color:'#354A5F' }}
                onMouseEnter={(e) => e.currentTarget.style.background='#f5f8ff'}
                onMouseLeave={(e) => e.currentTarget.style.background='#fff'}
                onClick={() => { setInputVal(label); onChange(label); setShowDrop(false); }}>
                {label}
                {row.email && <span style={{ marginLeft:8, fontSize:11, color:'#A0AAB4' }}>{row.email}</span>}
              </div>
            );
          })}
        </div>
      )}
      {loading && <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'#A0AAB4' }}>...</div>}
    </div>
  );
}

function getBadgeClass(val) {
  if (!val) return 'badge-default';
  const v = String(val).toLowerCase();
  if (['active', 'paid', 'won', 'completed', 'hot', 'approved', 'published', 'achieved', 'delivered'].includes(v))
    return 'badge-success';
  if (['in progress', 'warm', 'pending', 'open', 'in process', 'scheduled', 'contacted', 'submitted', 'planning', 'qualified'].includes(v))
    return 'badge-info';
  if (['new', 'draft', 'medium', 'normal', 'not started', 'unread'].includes(v))
    return 'badge-default';
  if (['high', 'overdue', 'critical', 'very high', 'escalated', 'at risk', 'urgent', 'warning'].includes(v))
    return 'badge-warning';
  if (['inactive', 'lost', 'cancelled', 'cold', 'rejected', 'failed', 'terminated', 'missed', 'discontinued', 'disqualified', 'expired', 'error'].includes(v))
    return 'badge-danger';
  return 'badge-default';
}

const badgeStyles = {
  base: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  },
  'badge-success': { background: '#E6F4EA', color: '#1E7E34' },
  'badge-info': { background: '#E8F4FD', color: '#0070F2' },
  'badge-default': { background: '#F0F2F5', color: '#6A767D' },
  'badge-warning': { background: '#FFF4E5', color: '#E76500' },
  'badge-danger': { background: '#FDEDED', color: '#BB0000' },
};

const currencyFields = ['amount', 'revenue', 'salary', 'price', 'cost', 'budget', 'total', 'value',
  'annual_revenue', 'estimated_value', 'actual_cost', 'expected_revenue', 'target_revenue',
  'actual_revenue', 'target_amount', 'best_case', 'committed', 'pipeline', 'closed',
  'total_amount', 'net_amount', 'gross_amount', 'discount', 'tax'];

function getFieldFormat(key) {
  if (currencyFields.some((f) => key.includes(f))) return 'currency';
  return null;
}

function getRecordTitle(item, config) {
  if (item.name) return item.name;
  if (item.title) return item.title;
  if (item.subject) return item.subject;
  if (item.first_name || item.last_name) return `${item.first_name || ''} ${item.last_name || ''}`.trim();
  if (item.invoice_number) return item.invoice_number;
  if (item.order_number) return item.order_number;
  if (item.ticket_number) return item.ticket_number;
  if (item.contract_number) return item.contract_number;
  if (item.quote_number) return item.quote_number;
  if (item.work_order_number) return item.work_order_number;
  if (item.payment_number) return item.payment_number;
  if (item.report_number) return item.report_number;
  return config.name + ' Record';
}

function formatValue(val, format) {
  if (val == null || val === '') return '--';
  if (format === 'currency') {
    return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (format === 'percent') {
    return Number(val).toFixed(0) + '%';
  }
  if (format === 'date') {
    return new Date(val).toLocaleDateString();
  }
  if (format === 'datetime') {
    return new Date(val).toLocaleString();
  }
  if (format === 'number') {
    return Number(val).toLocaleString();
  }
  return String(val);
}

function titleizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeAiContent(content) {
  if (content == null) return '';
  if (typeof content !== 'string') return content;
  const cleaned = content
    .replace(/```(?:json|markdown)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (/^[\[{]/.test(cleaned)) {
    try {
      return JSON.parse(cleaned);
    } catch {
      return cleaned;
    }
  }
  return cleaned;
}

function renderStructuredAi(value, depth = 0) {
  if (value == null || value === '') return <span style={{ color:'#6A767D' }}>Not provided</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color:'#6A767D' }}>No items found.</span>;
    return (
      <div style={{ display:'grid', gap:8 }}>
        {value.map((item, idx) => (
          <div key={idx} style={{ padding:'10px 12px', background:'#fff', border:'1px solid #E8EBF0', borderRadius:6 }}>
            {typeof item === 'object' && item !== null ? renderStructuredAi(item, depth + 1) : (
              <div style={{ fontSize:13, color:'#354A5F', lineHeight:1.55 }}>{String(item)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display:'grid', gap: depth ? 6 : 10 }}>
      {Object.entries(value).map(([key, val]) => (
        <div key={key} style={{ display:'grid', gap:4 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6A767D', textTransform:'uppercase', letterSpacing:'0.3px' }}>
            {titleizeKey(key)}
          </div>
          <div style={{ fontSize:13, color:'#1D2D3E', lineHeight:1.55 }}>
            {renderStructuredAi(val, depth + 1)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfessionalAiOutput({ content }) {
  const normalized = normalizeAiContent(content);
  if (typeof normalized !== 'string') {
    return <div>{renderStructuredAi(normalized)}</div>;
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <div style={{ display:'grid', gap:8 }}>
      {lines.map((line, idx) => {
        const heading = line.match(/^#{1,4}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*:?\s*$/);
        if (heading) {
          return (
            <div key={idx} style={{ fontSize:14, fontWeight:700, color:'#1D2D3E', marginTop: idx ? 6 : 0 }}>
              {heading[1]}
            </div>
          );
        }
        const bullet = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
        if (bullet) {
          return (
            <div key={idx} style={{ display:'flex', gap:8, fontSize:13, color:'#354A5F', lineHeight:1.55 }}>
              <span style={{ color:'#0070F2', fontWeight:700 }}>•</span>
              <span>{bullet[1].replace(/\*\*/g, '')}</span>
            </div>
          );
        }
        const keyVal = line.match(/^([A-Za-z][A-Za-z0-9 _/-]{2,40}):\s*(.+)$/);
        if (keyVal) {
          return (
            <div key={idx} style={{ padding:'9px 11px', background:'#fff', border:'1px solid #E8EBF0', borderRadius:6 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6A767D', textTransform:'uppercase', letterSpacing:'0.3px' }}>{keyVal[1]}</div>
              <div style={{ fontSize:13, color:'#1D2D3E', lineHeight:1.55, marginTop:3 }}>{keyVal[2].replace(/\*\*/g, '')}</div>
            </div>
          );
        }
        return (
          <div key={idx} style={{ fontSize:13, color:'#354A5F', lineHeight:1.6 }}>
            {line.replace(/\*\*/g, '')}
          </div>
        );
      })}
    </div>
  );
}

function getSamplePrompts(moduleKey) {
  const samples = {
    accounts: [
      { label: 'Tech Enterprise', prompt: 'Acme Technologies, a Technology enterprise in San Francisco CA, USA. Website acmetech.com, phone 415-555-0100, email info@acmetech.com, 123 Market St. Annual revenue $50,000,000, 1200 employees, Enterprise account type, Active status. Strategic partner for cloud solutions.' },
      { label: 'Retail SMB', prompt: 'GreenLeaf Retail, Retail industry, SMB account in New York NY, USA. Phone 212-555-0200, email contact@greenleaf.com, 456 Broadway. Revenue $5,000,000, 50 employees, Mid-Market type, Prospect status. New lead from trade show.' },
      { label: 'Manufacturing Key Acct', prompt: 'Schmidt Manufacturing GmbH, Manufacturing/Automotive, Key Account in Munich, Bavaria, Germany. Website schmidt-mfg.de, phone +49-89-555-0300, email sales@schmidt-mfg.de, Industriestr 78. Revenue $120,000,000, 3500 employees, Strategic type, Active. Long-term automotive parts supplier.' },
    ],
    contacts: [
      { label: 'VP of Sales', prompt: 'John Rivera, email j.rivera@acmecorp.com, phone 312-555-0101, mobile 312-555-0102. VP of Sales at Acme Corp, Sales department. Address 200 Michigan Ave, Chicago, USA. Status Active. Met at SaaS Connect conference, key decision maker for enterprise deal.' },
      { label: 'IT Director', prompt: 'Sarah Chen, email s.chen@globaltech.io, phone 650-555-0201, mobile 650-555-0202. IT Director at Global Tech, Information Technology department. 500 Tech Blvd, San Jose, USA. Active. Interested in cloud migration and SAP S/4HANA.' },
      { label: 'CFO Healthcare', prompt: 'Marcus Weber, email m.weber@medihealth.com, phone 617-555-0301, mobile 617-555-0302. CFO at MediHealth Inc, Finance department. 80 Beacon St, Boston, USA. Active. Budget holder for ERP modernization project.' },
    ],
    opportunities: [
      { label: 'Cloud ERP Deal', prompt: 'Cloud ERP Migration - Acme Corp. Account: Acme Corp, Contact: John Rivera. Amount $500,000, Develop phase, 65% probability, close date 2026-06-30. Source: Trade Show. Competitor: Oracle. Status Open. Full S/4HANA migration with analytics and integration suite.' },
      { label: 'Support Renewal', prompt: 'Support Contract Renewal - GlobalTech. Account: Global Tech, Contact: Sarah Chen. Amount $180,000, Negotiate phase, 85% probability, close date 2026-03-31. Source: Existing Customer. Competitor: ServiceNow. Open. 3-year premium support with SLA upgrade.' },
      { label: 'Analytics Upsell', prompt: 'Analytics Module Upsell - Schmidt Mfg. Account: Schmidt Manufacturing, Contact: Marcus Weber. Amount $120,000, Qualify phase, 40% probability, close date 2026-09-15. Source: Partner Referral. Competitor: Microsoft. Open. SAP Analytics Cloud add-on for manufacturing KPIs.' },
    ],
    leads: [
      { label: 'Hot Inbound Lead', prompt: 'Emily Watson, email e.watson@fintechpay.com, phone 415-555-0401. Marketing Manager at FintechPay, Source: Website, Qualification: Hot, estimated value $75,000. Status: New. Downloaded S/4HANA whitepaper and pricing guide, visited product pages 12 times.' },
      { label: 'Webinar Attendee', prompt: 'Robert Chang, email r.chang@swiftlogistics.com, phone 713-555-0501. CEO at Swift Logistics, Source: Webinar, Qualification: Warm, estimated value $200,000. Status: Contacted. Attended our supply chain webinar, asked about SAP TM integration.' },
      { label: 'Demo Request', prompt: 'Diana Patel, email d.patel@megamart.com, phone 214-555-0601. Operations Director at MegaMart Retail, Source: Referral, Qualification: Hot, estimated value $150,000. Status: Qualified. Requested live demo for warehouse management module, referred by partner.' },
    ],
    invoices: [
      { label: 'Monthly Service', prompt: 'Invoice INV-2026-0042 for Acme Corp, contact John Rivera. Net amount $15,000, tax $1,350, gross $16,350. Status Pending, due date 2026-03-25, payment terms Net 30. Monthly cloud ERP hosting and support services for February 2026.' },
      { label: 'Project Milestone', prompt: 'Invoice INV-2026-0078 for Global Tech, contact Sarah Chen. Net amount $45,000, tax $4,050, gross $49,050. Status Draft, due date 2026-04-30, payment terms Net 60. Final milestone payment for Q4 consulting and implementation project.' },
      { label: 'License Fee', prompt: 'Invoice INV-2026-0103 for Schmidt Manufacturing, contact Marcus Weber. Net amount $10,000, tax $900, gross $10,900. Status Pending, due date 2026-03-15, payment terms Net 15. Recurring monthly license fee for 500 SAP users at $20/user.' },
    ],
    tickets: [
      { label: 'Critical SSO Issue', prompt: 'Ticket TK-4521, title: SSO Login Failure Affecting Multiple Users. Contact: Sarah Chen, Account: Global Tech. Priority: Very High, Category: Security, Status: New, Assigned to: Alex Kim. Description: Since 8 AM today approximately 200 users unable to authenticate via SAML SSO, receiving 503 errors. Impacting all departments. Resolution: pending investigation.' },
      { label: 'Feature Request', prompt: 'Ticket TK-4522, title: Bulk Data Export Feature Request. Contact: John Rivera, Account: Acme Corp. Priority: Medium, Category: Feature Request, Status: In Process, Assigned to: Maria Lopez. Description: Enterprise client needs ability to export more than 10,000 records at once in CSV and Excel formats from sales reports module. Resolution: Feature under review for Q2 release.' },
      { label: 'Billing Issue', prompt: 'Ticket TK-4523, title: Invoice Amount Mismatch in Billing Portal. Contact: Marcus Weber, Account: Schmidt Manufacturing. Priority: High, Category: Billing, Status: Escalated, Assigned to: James Park. Description: Customer reports $2,300 discrepancy between contracted rate and invoiced amount on last 3 monthly invoices. Resolution: Investigating pricing rule configuration.' },
    ],
    employees: [
      { label: 'Senior Developer', prompt: 'Lisa Nguyen, email l.nguyen@company.com, phone 408-555-0701. Engineering department, Senior Full Stack Developer, manager David Thompson. Hire date 2021-03-15, salary $145,000, office San Jose HQ. Status Active. Skills: JavaScript, React, Node.js, SAP CAP, ABAP, HANA SQL.' },
      { label: 'Sales Rep', prompt: 'Michael Brooks, email m.brooks@company.com, phone 206-555-0801. Sales department, Regional Sales Representative, manager Karen White. Hire date 2026-03-01, salary $85,000, office Seattle. Status Active. Skills: B2B Sales, CRM, Negotiation, SAP Sales Cloud, Account Management.' },
      { label: 'Marketing Coordinator', prompt: 'Jessica Torres, email j.torres@company.com, phone 303-555-0901. Marketing department, Marketing Coordinator, manager Amy Foster. Hire date 2024-08-20, salary $65,000, office Denver (Remote). Status Active. Skills: Content Marketing, Social Media, HubSpot, SAP Marketing Cloud, Analytics.' },
    ],
    purchase_orders: [
      { label: 'Office Supplies', prompt: 'PO-2026-00310, vendor Staples Business Supply. Material: Office supplies and furniture, quantity 50 units, unit price $100, total $5,000, currency USD. Delivery date 2026-03-01, plant US-East, storage location Building A - Floor 2. Status Created. Quarterly office restocking for Q1.' },
      { label: 'Server Hardware', prompt: 'PO-2026-00311, vendor Dell Technologies. Material: PowerEdge R750 Server, quantity 3 units, unit price $40,000, total $120,000, currency USD. Delivery date 2026-04-15, plant US-West Data Center, storage location Server Room DC-3. Status Approved. Infrastructure upgrade for SAP HANA expansion.' },
      { label: 'Software Licenses', prompt: 'PO-2026-00312, vendor SAP SE. Material: SAP S/4HANA Enterprise License, quantity 50 seats, unit price $700, total $35,000, currency EUR. Delivery date 2026-03-31, plant HQ-Munich, storage location N/A. Status Ordered. Annual software license renewal with premium support.' },
    ],
  };
  const defaults = [
    { label: 'Enterprise Client', prompt: `New ${moduleKey.replace(/_/g, ' ')} record with all fields filled for a major enterprise client, including complete contact details, financials, status, and notes` },
    { label: 'High Priority', prompt: `High priority ${moduleKey.replace(/_/g, ' ')} entry due this month, fill all fields with realistic sample data including addresses, amounts, dates, and descriptions` },
    { label: 'Test Record', prompt: `Sample ${moduleKey.replace(/_/g, ' ')} record for testing with every field populated using realistic business data` },
  ];
  return samples[moduleKey] || defaults;
}

function getModuleGroupLabel(moduleKey) {
  return sidebarGroups.find((group) => group.items.includes(moduleKey))?.label || '';
}

function getModuleContext(moduleKey) {
  const group = getModuleGroupLabel(moduleKey).toLowerCase();
  const key = String(moduleKey || '').toLowerCase();
  if (group.includes('fi') || group.includes('controlling') || group.includes('treasury') || group.includes('finance') || group.includes('fscm') || key.includes('invoice') || key.includes('payment') || key.includes('ledger') || key.includes('accounting')) return 'finance';
  if (group.includes('sd') || group.includes('sales') || group.includes('cx') || key.includes('quote') || key.includes('order') || key.includes('billing') || key.includes('delivery') || key.includes('customer')) return 'sales';
  if (group.includes('mm') || group.includes('warehouse') || group.includes('ewm') || group.includes('supplier') || key.includes('inventory') || key.includes('material') || key.includes('purchase') || key.includes('goods') || key.includes('stock') || key.includes('vendor')) return 'inventory';
  if (group.includes('pp') || group.includes('manufacturing') || key.includes('production') || key.includes('bom') || key.includes('routing') || key.includes('work_center') || key.includes('mrp')) return 'production';
  if (group.includes('service') || key.includes('ticket') || key.includes('work_order') || key.includes('sla') || key.includes('case')) return 'service';
  if (group.includes('hcm') || group.includes('successfactors') || group.includes('payroll') || key.includes('employee') || key.includes('leave') || key.includes('training') || key.includes('recruit')) return 'hr';
  if (group.includes('grc') || group.includes('basis') || group.includes('identity') || key.includes('access') || key.includes('control') || key.includes('audit') || key.includes('risk')) return 'security';
  if (group.includes('quality') || key.includes('quality') || key.includes('inspection')) return 'quality';
  if (group.includes('pm') || key.includes('maintenance') || key.includes('equipment')) return 'maintenance';
  if (group.includes('project') || key.includes('project') || key.includes('wbs')) return 'project';
  return 'general';
}

export default function ModulePage() {
  const { moduleKey } = useParams();
  const navigate = useNavigate();
  const config = modules[moduleKey];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [detailSaving, setDetailSaving] = useState(false);
  // AI Fill state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  // Duplicate detection state
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  // Record popup AI action state
  const [aiPanel, setAiPanel] = useState(null);
  const [aiActionLoading, setAiActionLoading] = useState('');
  // Email Draft state
  const [emailDraft, setEmailDraft] = useState('');
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  // Ticket classify state
  const [classifyResult, setClassifyResult] = useState(null);
  const [classifyLoading, setClassifyLoading] = useState(false);

  const handleTicketClassify = async () => {
    if (!selectedItem) return;
    setClassifyLoading(true);
    setClassifyResult(null);
    try {
      const res = await classifyTicket(selectedItem.title, selectedItem.description);
      setClassifyResult(res?.result);
    } catch (e) {
      setClassifyResult({ error: 'Failed to classify ticket' });
    }
    setClassifyLoading(false);
  };

  const loadData = useCallback((q = '') => {
    setLoading(true);
    fetchAll(moduleKey, q).then((res) => {
      setItems(Array.isArray(res) ? res : res?.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [moduleKey]);

  useEffect(() => {
    setSearch('');
    setShowForm(false);
    setSelectedItem(null);
    setEditing(false);
    setEditData({});
    setAiPanel(null);
    setAiActionLoading('');
    setEmailDraft('');
    setClassifyResult(null);
    loadData();
  }, [moduleKey, loadData]);

  const handleSearch = (val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadData(val), 300);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createItem(moduleKey, formData);
      setShowForm(false);
      setFormData({});
      loadData(search);
    } catch (err) {
      // handle silently
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = async (item) => {
    setDetailLoading(true);
    setSelectedItem(item);
    setEditing(false);
    try {
      const res = await fetchOne(moduleKey, item.id);
      const record = res?.data || res;
      setSelectedItem(record);
      setEditData(record || {});
    } catch {
      // keep the item we already have
      setEditData(item);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAiFill = async (promptOverride) => {
    const prompt = promptOverride || aiPrompt;
    if (!prompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await callAI('generate-record', { module: moduleKey, description: prompt, fields: config.fields });
      if (res?.result) setFormData(prev => ({ ...prev, ...res.result }));
    } catch {}
    setAiGenerating(false);
  };

  const checkDuplicates = async (data) => {
    setDuplicateChecking(true);
    try {
      const res = await callAI('check-duplicates', { module: moduleKey, data });
      setDuplicates(res?.duplicates || []);
    } catch { setDuplicates([]); }
    setDuplicateChecking(false);
  };

  const handleDupBlur = (field, val) => {
    const dupFields = ['name', 'first_name', 'last_name', 'email', 'company', 'account_name'];
    if (dupFields.includes(field) && val && val.trim()) {
      checkDuplicates({ ...formData, [field]: val });
    }
  };

  const handleAiSummary = async () => {
    setAiActionLoading('summary');
    setAiPanel(null);
    try {
      const res = await callAI('record-summary', { module: moduleKey, record: selectedItem, fields: config.fields });
      setAiPanel({ title: 'AI Summary', tone: 'purple', content: res?.result || 'Unable to generate summary.' });
    } catch {
      setAiPanel({ title: 'AI Summary', tone: 'red', content: 'Error generating summary.' });
    }
    setAiActionLoading('');
  };

  const handleRecordAiAction = async (action, title, purposeInstructions, purposeSections) => {
    setAiActionLoading(action);
    setAiPanel(null);
    try {
      const res = await callAI('record-action', {
        module: moduleKey,
        record: selectedItem,
        fields: config.fields,
        action,
        purposeTitle: title,
        purposeInstructions,
        purposeSections,
      });
      setAiPanel({ title, tone: 'purple', content: res?.result || `Unable to generate ${title.toLowerCase()}.` });
    } catch {
      setAiPanel({ title, tone: 'red', content: `Error generating ${title.toLowerCase()}.` });
    }
    setAiActionLoading('');
  };

  const handlePopupDuplicateCheck = async () => {
    setAiActionLoading('duplicates');
    setAiPanel(null);
    try {
      const res = await callAI('check-duplicates', { module: moduleKey, data: selectedItem });
      const found = res?.duplicates || [];
      setAiPanel({
        title: 'Duplicate Check',
        tone: found.length ? 'orange' : 'green',
        content: found.length
          ? { summary: `${found.length} possible duplicate record${found.length === 1 ? '' : 's'} found. Review the matches before creating or updating related data.`, possibleDuplicates: found }
          : 'No likely duplicates were found from the key identity fields on this record.',
      });
    } catch {
      setAiPanel({ title: 'Duplicate Check', tone: 'red', content: 'Error checking duplicates.' });
    }
    setAiActionLoading('');
  };

  const handleApprovalRoute = async () => {
    setAiActionLoading('approval-route');
    setAiPanel(null);
    try {
      const amount = selectedItem.amount || selectedItem.total || selectedItem.value || selectedItem.net_amount || selectedItem.gross_amount;
      const region = selectedItem.region || selectedItem.country || selectedItem.sales_region || selectedItem.plant;
      const res = await callAI('recommend-approver', { module: moduleKey, recordId: selectedItem.id, amount, region });
      setAiPanel({
        title: 'Approval Route',
        tone: 'blue',
        content: res?.result || res?.recommendations || res || 'Unable to recommend an approval route.',
      });
    } catch {
      setAiPanel({ title: 'Approval Route', tone: 'red', content: 'Error recommending approval route.' });
    }
    setAiActionLoading('');
  };

  const handleEmailDraft = async () => {
    setEmailDraftLoading(true);
    try {
      const res = await callAI('draft-email', { module: moduleKey, record: selectedItem });
      setEmailDraft(res?.result || 'Unable to generate email.');
    } catch { setEmailDraft('Error generating email.'); }
    setEmailDraftLoading(false);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setEditing(false);
    setEditData({});
    setAiPanel(null);
    setAiActionLoading('');
    setEmailDraft('');
    setClassifyResult(null);
  };

  const handleDetailSave = async () => {
    setDetailSaving(true);
    try {
      const res = await updateItem(moduleKey, selectedItem.id, editData);
      const updated = res?.data || res;
      setSelectedItem(updated);
      setEditData(updated);
      setEditing(false);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      // handle silently
    } finally {
      setDetailSaving(false);
    }
  };

  const handleDetailDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteItem(moduleKey, selectedItem.id);
      setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
      closeDetail();
    } catch {
      // handle silently
    }
  };

  if (!config) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#354A5F' }}>Module not found</h2>
        <p style={{ color: '#6A767D' }}>The module "{moduleKey}" does not exist.</p>
      </div>
    );
  }

  const Icon = config.icon;
  const singular = config.name.endsWith('s')
    ? config.name.slice(0, -1)
    : config.name.endsWith('ies')
    ? config.name.slice(0, -3) + 'y'
    : config.name;

  const buildAiAction = (action, label, icon, purposeInstructions, purposeSections) => ({
    key: action,
    label,
    icon,
    onClick: () => handleRecordAiAction(action, label, purposeInstructions, purposeSections),
  });
  const summaryAction = { key: 'summary', label: 'Summary', icon: FiCpu, onClick: handleAiSummary };
  const emailAction = { key: 'draft-email', label: 'Email', icon: FiMail, onClick: handleEmailDraft };
  const duplicateAction = { key: 'duplicates', label: 'Duplicates', icon: FiSearch, onClick: handlePopupDuplicateCheck };
  const approvalAction = { key: 'approval-route', label: 'Approval Route', icon: FiUsers, onClick: handleApprovalRoute };
  const context = getModuleContext(moduleKey);
  const contextualAiActions = {
    sales: [
      summaryAction,
      buildAiAction('process-fit', 'Pricing Review', FiRefreshCw, 'Review SD pricing, discounts, tax, copy-control, billing readiness, and margin exposure for this sales record.', 'Pricing Findings, Billing Readiness, Margin or Credit Concerns, Recommended Corrections'),
      buildAiAction('risk-review', 'Credit Risk', FiShield, 'Assess customer credit, delivery, collection, and commercial risk for this sales or customer-facing record.', 'Credit Risk, Delivery or Billing Blocks, Collection Exposure, Mitigation Plan'),
      buildAiAction('next-actions', 'Billing Readiness', FiCheckCircle, 'Recommend the next SD actions needed to move this record toward delivery, billing, or revenue recognition.', 'Next SD Actions, Required Owner, Blocking Data, Timing'),
      buildAiAction('change-impact', 'Revenue Impact', FiGitBranch, 'Explain revenue, billing, delivery, customer, and downstream finance impacts if this record changes.', 'Revenue Impact, Downstream Documents, Customer Impact, Controls to Check'),
      approvalAction,
      emailAction,
    ],
    finance: [
      summaryAction,
      buildAiAction('change-impact', 'Posting Impact', FiGitBranch, 'Analyze FI/CO posting, ledger, account, tax, reconciliation, and reporting impacts for this financial record.', 'Posting Impact, Ledger or Account Risk, Reconciliation Needs, Reporting Impact'),
      buildAiAction('risk-review', 'Reconciliation Risk', FiShield, 'Identify reconciliation, payment, open-item, period-close, and audit risks for this finance record.', 'Risk Level, Reconciliation Issues, Close or Audit Concerns, Mitigation Plan'),
      buildAiAction('data-quality', 'Period Close Check', FiList, 'Check whether this record is complete and consistent enough for period close, statutory reporting, and audit review.', 'Completeness, Close Blockers, Audit Evidence, Data Fixes'),
      approvalAction,
      emailAction,
    ],
    inventory: [
      summaryAction,
      buildAiAction('change-impact', 'Stock Impact', FiGitBranch, 'Analyze stock, batch, plant, storage-location, reservation, MRP, and warehouse impacts for this material or procurement record.', 'Stock Impact, MRP or Reservation Impact, Warehouse Touchpoints, Controls to Check'),
      buildAiAction('process-fit', 'Availability Check', FiRefreshCw, 'Assess availability, ATP-like confirmation, shortage, goods movement, and transfer-posting considerations for this record.', 'Availability, Shortage Risk, Movement Proposal, Warehouse Action'),
      buildAiAction('next-actions', 'Movement Proposal', FiCheckCircle, 'Recommend appropriate MM/EWM next actions such as goods receipt, issue, transfer, release from quality, or reservation follow-up.', 'Recommended Movement, Required Owner, Preconditions, Timing'),
      buildAiAction('data-quality', 'Batch/Data Check', FiList, 'Validate plant, storage location, batch, stock type, quantity, vendor, and material fields for operational execution.', 'Missing Fields, Inconsistent Values, Execution Risks, Data Fixes'),
      approvalAction,
    ],
    production: [
      summaryAction,
      buildAiAction('change-impact', 'BOM Impact', FiGitBranch, 'Explain BOM, routing, component, work-center, production-order, and cost rollup impact for this production record.', 'BOM or Routing Impact, Component Risk, Cost Impact, Change Controls'),
      buildAiAction('process-fit', 'Capacity Check', FiRefreshCw, 'Assess work-center capacity, routing feasibility, queue risk, and schedule pressure for this production record.', 'Capacity Findings, Bottlenecks, Schedule Risk, Recommended Actions'),
      buildAiAction('next-actions', 'Cost Rollup', FiCheckCircle, 'Recommend production planning and costing next steps, including MRP, standard cost, variance, and release actions.', 'Planning Actions, Costing Actions, Owner, Timing'),
      buildAiAction('risk-review', 'Quality Risk', FiShield, 'Identify quality, scrap, component shortage, production variance, and release risks for this production record.', 'Quality Risk, Material Risk, Variance Exposure, Mitigation Plan'),
      approvalAction,
    ],
    service: [
      summaryAction,
      buildAiAction('risk-review', 'SLA Risk', FiShield, 'Assess SLA, escalation, customer impact, response time, and service-delivery risk for this support/service record.', 'SLA Risk, Customer Impact, Escalation Need, Mitigation Plan'),
      buildAiAction('next-actions', 'Resolution Plan', FiCheckCircle, 'Recommend a practical service resolution plan with owner, priority, communication, and closure steps.', 'Resolution Steps, Owner, Customer Communication, Closure Criteria'),
      buildAiAction('change-impact', 'Customer Impact', FiGitBranch, 'Analyze customer, contract, SLA, billing, and operational impacts if this service record changes.', 'Customer Impact, Contract or SLA Impact, Operational Impact, Follow-up Controls'),
      buildAiAction('data-quality', 'Case Data Check', FiList, 'Check case fields, categorization, priority, assignment, SLA, and resolution data quality.', 'Missing Data, Classification Issues, SLA Data Gaps, Corrections'),
      emailAction,
    ],
    hr: [
      summaryAction,
      buildAiAction('risk-review', 'Compliance Risk', FiShield, 'Assess HR, payroll, privacy, policy, training, leave, and employee-relations compliance risk for this record.', 'Compliance Risk, Policy Issues, Privacy Concerns, Mitigation Plan'),
      buildAiAction('change-impact', 'Employee Impact', FiGitBranch, 'Explain employee, manager, payroll, benefits, time, and organizational impacts if this HR record changes.', 'Employee Impact, Payroll or Benefits Impact, Manager Actions, Controls to Check'),
      approvalAction,
      buildAiAction('data-quality', 'HR Data Check', FiList, 'Validate employee, effective date, manager, compensation, leave, training, and status data quality.', 'Missing Fields, Effective-Dated Issues, Compliance Gaps, Data Fixes'),
      emailAction,
    ],
    security: [
      summaryAction,
      buildAiAction('risk-review', 'SoD / Access Risk', FiShield, 'Assess segregation-of-duties, privileged access, authorization, audit, and compliance risk for this security/control record.', 'Access Risk, SoD Conflicts, Privileged Exposure, Mitigation Plan'),
      buildAiAction('data-quality', 'Control Gaps', FiList, 'Evaluate control design, evidence, ownership, frequency, remediation, and audit-readiness gaps.', 'Control Completeness, Evidence Gaps, Ownership Issues, Remediation'),
      buildAiAction('change-impact', 'Audit Impact', FiGitBranch, 'Explain audit, compliance, role, process, and downstream access impacts if this record changes.', 'Audit Impact, Compliance Impact, Role or Process Impact, Required Evidence'),
      buildAiAction('next-actions', 'Remediation Plan', FiCheckCircle, 'Recommend remediation actions for access, control, audit, and compliance findings.', 'Remediation Steps, Owner, Due Date, Verification'),
      approvalAction,
    ],
    quality: [
      summaryAction,
      buildAiAction('risk-review', 'Inspection Risk', FiShield, 'Assess inspection, defect, supplier quality, batch release, and customer quality risk for this record.', 'Inspection Risk, Defect Exposure, Containment, Mitigation Plan'),
      buildAiAction('next-actions', 'Corrective Actions', FiCheckCircle, 'Recommend containment, root-cause, corrective, preventive, and release actions.', 'Containment, Root Cause, Corrective Actions, Release Decision'),
      buildAiAction('change-impact', 'Process Impact', FiGitBranch, 'Explain production, supplier, customer, inventory, and compliance impacts of this quality record.', 'Process Impact, Supplier or Customer Impact, Inventory Impact, Controls'),
      buildAiAction('data-quality', 'Quality Data Check', FiList, 'Check inspection lot, defect, batch, material, supplier, and disposition data quality.', 'Data Completeness, Classification Gaps, Disposition Issues, Corrections'),
    ],
    maintenance: [
      summaryAction,
      buildAiAction('risk-review', 'Asset Risk', FiShield, 'Assess equipment, downtime, safety, maintenance backlog, spare parts, and reliability risk.', 'Asset Risk, Downtime Exposure, Safety Concerns, Mitigation Plan'),
      buildAiAction('next-actions', 'Work Plan', FiCheckCircle, 'Recommend maintenance planning steps including labor, parts, scheduling, permits, and closeout.', 'Work Steps, Required Parts, Schedule, Closeout Criteria'),
      buildAiAction('change-impact', 'Downtime Impact', FiGitBranch, 'Explain operational, production, safety, and financial impact if this maintenance record changes.', 'Downtime Impact, Production Impact, Safety Impact, Controls'),
      buildAiAction('process-fit', 'Parts Readiness', FiRefreshCw, 'Assess spare-parts readiness, reservations, procurement need, and execution feasibility.', 'Parts Status, Procurement Need, Execution Readiness, Recommendations'),
    ],
    project: [
      summaryAction,
      buildAiAction('risk-review', 'Budget/Schedule Risk', FiShield, 'Assess budget, schedule, scope, resource, milestone, and stakeholder risk for this project record.', 'Risk Level, Budget Exposure, Schedule Exposure, Mitigation Plan'),
      buildAiAction('next-actions', 'Milestone Actions', FiCheckCircle, 'Recommend milestone, resource, dependency, and governance next steps.', 'Milestone Actions, Owner, Dependencies, Timing'),
      buildAiAction('change-impact', 'Resource Impact', FiGitBranch, 'Explain resource, cost, schedule, WBS, network, and reporting impact if this project record changes.', 'Resource Impact, Cost or Schedule Impact, Reporting Impact, Controls'),
      approvalAction,
      emailAction,
    ],
    general: [
      summaryAction,
      buildAiAction('risk-review', 'Risk Review', FiShield, 'Identify business, operational, financial, compliance, and data risks for this record.', 'Risk Level, Key Risks, Control Gaps, Mitigation Plan'),
      buildAiAction('next-actions', 'Next Actions', FiCheckCircle, 'Recommend practical next steps for this record in its current process context.', 'Recommended Actions, Owner, Timing, Business Rationale'),
      buildAiAction('data-quality', 'Data Quality', FiList, 'Evaluate missing, weak, inconsistent, stale, or suspicious field values and propose corrections.', 'Completeness, Quality Issues, Suggested Corrections, Validation Rules'),
      duplicateAction,
      buildAiAction('change-impact', 'Impact', FiGitBranch, 'Explain downstream process, reporting, compliance, master-data, and integration impacts if this record changes.', 'Impacted Processes, Dependent Records, Testing Needed, Rollback Considerations'),
      emailAction,
    ],
  };
  const recordAiActions = contextualAiActions[context] || contextualAiActions.general;
  const contextLabel = {
    sales: 'Sales / SD',
    finance: 'Finance / FI-CO',
    inventory: 'Inventory / MM-EWM',
    production: 'Production / PP',
    service: 'Service / CS',
    hr: 'HR / HCM',
    security: 'Security / GRC',
    quality: 'Quality / QM',
    maintenance: 'Maintenance / PM',
    project: 'Project / PS',
    general: 'General',
  }[context] || 'General';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{ ...styles.headerIcon, background: config.color + '14', color: config.color }}>
            <Icon size={26} />
          </div>
          <div>
            <h1 style={styles.title}>{config.name}</h1>
            <p style={styles.subtitle}>
              {items.length} records &middot; {config.description}
            </p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => loadData(search)} style={styles.refreshBtn} title="Refresh">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={() => { setFormData({}); setShowForm(true); setAiPrompt(''); setDuplicates([]); }} style={styles.primaryBtn}>
            <FiPlus size={16} style={{ marginRight: 6 }} />
            New {singular}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.searchWrap}>
        <FiSearch size={16} style={styles.searchIcon} />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={`Search ${config.name.toLowerCase()}...`}
          style={styles.searchInput}
        />
        {search && (
          <button onClick={() => { setSearch(''); loadData(''); }} style={styles.clearBtn}>
            <FiX size={14} />
          </button>
        )}
      </div>

      {/* Charts */}
      <ModuleCharts config={config} items={items} />

      {/* Data Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loaderWrap}>
            <div style={styles.spinner} />
          </div>
        ) : items.length === 0 ? (
          <div style={styles.emptyState}>
            <Icon size={40} style={{ color: '#D1D9E0', marginBottom: 12 }} />
            <p style={{ color: '#6A767D', margin: 0 }}>No records found</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {config.columns.map((col) => (
                  <th key={col.key} style={styles.th}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  style={styles.tr}
                  onClick={() => handleRowClick(item)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F7FA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {config.columns.map((col) => {
                    const val = item[col.key];
                    if (col.badge) {
                      const cls = getBadgeClass(val);
                      return (
                        <td key={col.key} style={styles.td}>
                          <span style={{ ...badgeStyles.base, ...badgeStyles[cls] }}>{val || '--'}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} style={styles.td}>
                        {formatValue(val, col.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Item Modal */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>New {singular}</h2>
              <button onClick={() => setShowForm(false)} style={styles.modalClose}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={styles.modalBody}>
              {/* AI Fill Section */}
              <div style={{ display:'flex', gap:8, marginBottom:16, padding:'12px 14px', background:'#F8F5FF', borderRadius:8, border:'1px solid #E8DEF8' }}>
                <input
                  type="text"
                  placeholder="Describe the record in natural language..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiFill(); } }}
                  style={{ ...styles.formInput, flex:1, background:'#fff' }}
                />
                <button type="button" onClick={handleAiFill} disabled={aiGenerating} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', fontSize:13, fontWeight:600, color:'#fff', background: aiGenerating ? '#A0AAB4' : '#8B47D7', border:'none', borderRadius:6, cursor: aiGenerating ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                  <FiCpu size={14} />
                  {aiGenerating ? 'Generating...' : 'AI Fill'}
                </button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:-8, marginBottom:12, paddingLeft:2 }}>
                {getSamplePrompts(moduleKey).map((sample, i) => (
                  <button key={i} type="button"
                    onClick={() => { setAiPrompt(sample.prompt); handleAiFill(sample.prompt); }}
                    disabled={aiGenerating}
                    style={{ padding:'5px 12px', fontSize:11, fontWeight:500, color:'#8B47D7',
                      background:'#fff', border:'1px solid #E8DEF8', borderRadius:14, cursor: aiGenerating ? 'default' : 'pointer', opacity: aiGenerating ? 0.5 : 1 }}>
                    {sample.label}
                  </button>
                ))}
              </div>
              {/* Duplicate Warning */}
              {duplicates.length > 0 && (
                <div style={{ padding:'10px 14px', marginBottom:14, background:'#FFF4E5', border:'1px solid #FFE0B2', borderRadius:8, display:'flex', alignItems:'flex-start', gap:10 }}>
                  <FiAlertCircle size={18} style={{ color:'#E76500', flexShrink:0, marginTop:2 }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#D14900' }}>Possible duplicates found</div>
                    {duplicates.map((d) => (
                      <div key={d.id} style={{ fontSize:12, color:'#6A767D', marginTop:2 }}>
                        {d.name || d.first_name || d.email || `ID: ${d.id}`}
                        {d.email && ` \u2014 ${d.email}`}
                        <span style={{ color:'#A0AAB4', marginLeft:4 }}>#{d.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={styles.formGrid}>
                {config.fields.map((field) => (
                  <div key={field.key} style={field.type === 'textarea' ? styles.fieldFull : styles.fieldHalf}>
                    <label style={styles.formLabel}>
                      {field.label}
                      {field.required && <span style={{ color: '#BB0000' }}> *</span>}
                    </label>
                    {field.relation ? (
                      <RelationDropdown
                        field={field}
                        value={formData[field.key] || ''}
                        onChange={(val) => { setFormData({ ...formData, [field.key]: val }); }}
                        inputStyle={styles.formInput}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        style={styles.formInput}
                        required={field.required}
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        style={{ ...styles.formInput, minHeight: 80, resize: 'vertical' }}
                        required={field.required}
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime-local' ? 'datetime-local' : field.type === 'email' ? 'email' : 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        onBlur={(e) => handleDupBlur(field.key, e.target.value)}
                        style={styles.formInput}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={styles.submitBtn}>
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div style={styles.overlay} onClick={closeDetail}>
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div style={styles.detailLoaderWrap}>
                <div style={styles.spinner} />
              </div>
            ) : (
              <>
                {/* Detail Header */}
                <div style={styles.detailHeader}>
                  <div style={styles.detailHeaderLeft}>
                    <div style={{ ...styles.detailIcon, background: config.color + '14', color: config.color }}>
                      <Icon size={24} />
                    </div>
                    <div>
                      <h2 style={styles.detailTitle}>{getRecordTitle(selectedItem, config)}</h2>
                      <div style={styles.detailMeta}>
                        {selectedItem.status && (() => {
                          const cls = getBadgeClass(selectedItem.status);
                          return <span style={{ ...badgeStyles.base, ...badgeStyles[cls] }}>{selectedItem.status}</span>;
                        })()}
                        <span style={{ fontSize: 12, color: '#A0AAB4', fontFamily: 'monospace' }}>ID: {selectedItem.id}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={closeDetail} style={styles.modalClose}>
                      <FiX size={20} />
                    </button>
                  </div>
                </div>

                {/* Workflow Action Buttons */}
                <WorkflowActions config={config} item={selectedItem} onStatusChange={async (updates) => {
                  try {
                    const res = await updateItem(moduleKey, selectedItem.id, { ...selectedItem, ...updates });
                    const updated = res?.data || res;
                    setSelectedItem(updated);
                    setEditData(updated);
                    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                  } catch {}
                }} />

                {/* Popup AI Action Bar */}
                <div style={{ margin:'0 24px 12px', padding:'12px 14px', background:'#FAFBFF', border:'1px solid #E8EBF0', borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#354A5F', textTransform:'uppercase', letterSpacing:'0.3px' }}>AI Actions · {contextLabel}</span>
                    {(aiActionLoading || emailDraftLoading) && (
                      <span style={{ fontSize:12, color:'#6A767D' }}>Working...</span>
                    )}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {recordAiActions.map((action) => {
                      const ActionIcon = action.icon;
                      const isLoading = aiActionLoading === action.key || (action.key === 'draft-email' && emailDraftLoading);
                      return (
                        <button
                          key={action.key}
                          onClick={action.onClick}
                          disabled={Boolean(aiActionLoading || emailDraftLoading)}
                          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 11px', minHeight:32, fontSize:12, fontWeight:600, color:isLoading ? '#6A767D' : '#0070F2', background:isLoading ? '#F0F2F5' : '#fff', border:'1px solid #D1E8FF', borderRadius:6, cursor:(aiActionLoading || emailDraftLoading) ? 'default' : 'pointer' }}
                        >
                          <ActionIcon size={14} />
                          {isLoading ? 'Working...' : action.label}
                        </button>
                      );
                    })}
                    {moduleKey === 'tickets' && (
                      <button onClick={handleTicketClassify} disabled={Boolean(aiActionLoading || emailDraftLoading || classifyLoading)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 11px', minHeight:32, fontSize:12, fontWeight:600, color:'#E76500', background:'#fff', border:'1px solid #FFE0B2', borderRadius:6, cursor:(aiActionLoading || emailDraftLoading || classifyLoading) ? 'default' : 'pointer' }}>
                        <FiTag size={14} />
                        {classifyLoading ? 'Classifying...' : 'Classify'}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Result Panel */}
                {aiPanel && (
                  <div style={{ margin:'0 24px', padding:'14px 16px', background:aiPanel.tone === 'green' ? '#F2FAF2' : aiPanel.tone === 'orange' ? '#FFF8F0' : aiPanel.tone === 'red' ? '#FDEDED' : '#F8F5FF', border:`1px solid ${aiPanel.tone === 'green' ? '#CDECCB' : aiPanel.tone === 'orange' ? '#FFE0B2' : aiPanel.tone === 'red' ? '#F5C6C6' : '#E8DEF8'}`, borderRadius:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:aiPanel.tone === 'green' ? '#1E7E34' : aiPanel.tone === 'orange' ? '#E76500' : aiPanel.tone === 'red' ? '#BB0000' : '#8B47D7', textTransform:'uppercase', letterSpacing:'0.3px' }}>{aiPanel.title}</span>
                      <button onClick={() => setAiPanel(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#A0AAB4', padding:2, display:'flex' }}><FiX size={14} /></button>
                    </div>
                    <ProfessionalAiOutput content={aiPanel.content} />
                  </div>
                )}

                {/* AI Classify Result (tickets only) */}
                {classifyResult && !classifyResult.error && (
                  <div style={{ margin:'0 24px', padding:'14px 16px', background:'#FFF8F0', border:'1px solid #FFE0B2', borderRadius:8, marginTop: aiPanel ? 8 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#E76500', textTransform:'uppercase' }}>AI Classification</span>
                      <button onClick={() => setClassifyResult(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#A0AAB4', padding:2, display:'flex' }}><FiX size={14} /></button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                      <div style={{ padding:'8px 12px', background:'#fff', borderRadius:6, border:'1px solid #E8EBF0' }}>
                        <div style={{ fontSize:11, color:'#6A767D', marginBottom:2 }}>Category</div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#1D2D3E' }}>{classifyResult.category}</div>
                      </div>
                      <div style={{ padding:'8px 12px', background:'#fff', borderRadius:6, border:'1px solid #E8EBF0' }}>
                        <div style={{ fontSize:11, color:'#6A767D', marginBottom:2 }}>Priority</div>
                        <div style={{ fontSize:14, fontWeight:600, color: classifyResult.priority === 'Very High' || classifyResult.priority === 'High' ? '#BB0000' : '#E76500' }}>{classifyResult.priority}</div>
                      </div>
                      <div style={{ padding:'8px 12px', background:'#fff', borderRadius:6, border:'1px solid #E8EBF0' }}>
                        <div style={{ fontSize:11, color:'#6A767D', marginBottom:2 }}>Confidence</div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#498205' }}>{(classifyResult.confidence * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:'#354A5F', lineHeight:1.6 }}>
                      <strong>Reasoning:</strong> {classifyResult.reasoning}
                    </div>
                    {classifyResult.suggested_resolution && (
                      <div style={{ fontSize:13, color:'#354A5F', lineHeight:1.6, marginTop:6 }}>
                        <strong>Suggested Resolution:</strong> {classifyResult.suggested_resolution}
                      </div>
                    )}
                    {classifyResult.tags && classifyResult.tags.length > 0 && (
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                        {classifyResult.tags.map((tag, i) => (
                          <span key={i} style={{ padding:'3px 10px', fontSize:11, borderRadius:12, background:'#E8F4FD', color:'#0070F2', fontWeight:500 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Detail Body */}
                <div style={styles.detailBody}>
                  <div style={styles.detailGrid}>
                    {config.fields.map((field) => {
                      const colFormat = config.columns?.find((c) => c.key === field.key);
                      const isBadgeField = field.key === 'status' || field.key === 'priority' || field.key === 'qualification' || field.key === 'threat_level' || field.key === 'phase';
                      const format = colFormat?.format || getFieldFormat(field.key) || (field.type === 'date' ? 'date' : null) || (field.type === 'datetime-local' ? 'datetime' : null);

                      return (
                        <div key={field.key} style={field.type === 'textarea' ? styles.detailFieldFull : styles.detailFieldHalf}>
                          <p style={styles.detailLabel}>{field.label}</p>
                          {editing ? (
                            field.relation ? (
                              <RelationDropdown
                                field={field}
                                value={editData[field.key] || ''}
                                onChange={(val) => setEditData({ ...editData, [field.key]: val })}
                                inputStyle={styles.detailInput}
                              />
                            ) : field.type === 'select' ? (
                              <select
                                value={editData[field.key] || ''}
                                onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                                style={styles.detailInput}
                              >
                                <option value="">Select...</option>
                                {(field.options || []).map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                value={editData[field.key] || ''}
                                onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                                style={{ ...styles.detailInput, minHeight: 80, resize: 'vertical' }}
                              />
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime-local' ? 'datetime-local' : field.type === 'email' ? 'email' : 'text'}
                                value={editData[field.key] || ''}
                                onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                                style={styles.detailInput}
                              />
                            )
                          ) : isBadgeField && selectedItem[field.key] ? (
                            (() => {
                              const cls = getBadgeClass(selectedItem[field.key]);
                              return <span style={{ ...badgeStyles.base, ...badgeStyles[cls] }}>{selectedItem[field.key]}</span>;
                            })()
                          ) : (
                            <p style={styles.detailValue}>{formatValue(selectedItem[field.key], format)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Email Draft Section */}
                  {emailDraft && (
                    <div style={{ marginTop:16, padding:'14px 16px', background:'#EFF6FF', border:'1px solid #B8D8F8', borderRadius:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#0070F2', textTransform:'uppercase' }}>Email Draft</span>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => { navigator.clipboard.writeText(emailDraft); }} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', fontSize:11, fontWeight:600, color:'#0070F2', background:'#fff', border:'1px solid #B8D8F8', borderRadius:4, cursor:'pointer' }}>
                            <FiCopy size={12} /> Copy
                          </button>
                          <button onClick={() => setEmailDraft('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#A0AAB4', padding:2, display:'flex' }}><FiX size={14} /></button>
                        </div>
                      </div>
                      <textarea
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        style={{ width:'100%', minHeight:120, padding:'10px 12px', fontSize:13, border:'1px solid #D1D9E0', borderRadius:6, background:'#fff', boxSizing:'border-box', resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }}
                      />
                    </div>
                  )}

                  {/* Document Flow */}
                  <DocumentFlow config={config} item={selectedItem} moduleKey={moduleKey} />

                  {/* Related Records */}
                  <RelatedRecords config={config} item={selectedItem} />

                  {/* SAP Advanced Features */}
                  <WhereUsed config={config} item={selectedItem} moduleKey={moduleKey} />
                  <ChangeHistory item={selectedItem} moduleKey={moduleKey} />
                  <OrgAssignment config={config} item={selectedItem} />
                  <PartnerFunctions config={config} item={selectedItem} moduleKey={moduleKey} />
                  <PricingConditions config={config} item={selectedItem} moduleKey={moduleKey} />
                  <BatchInfo config={config} item={selectedItem} moduleKey={moduleKey} />
                  <ConfigLinks config={config} item={selectedItem} moduleKey={moduleKey} />
                  <ApprovalChain config={config} item={selectedItem} moduleKey={moduleKey} />
                  <CrossCompany config={config} item={selectedItem} moduleKey={moduleKey} />
                </div>

                {/* Detail Footer */}
                <div style={styles.detailFooter}>
                  {editing ? (
                    <>
                      <button onClick={() => { setEditing(false); setEditData(selectedItem); }} style={styles.detailCancelBtn}>
                        <FiX size={15} style={{ marginRight: 6 }} />
                        Cancel
                      </button>
                      <button onClick={handleDetailSave} disabled={detailSaving} style={styles.detailSaveBtn}>
                        <FiSave size={15} style={{ marginRight: 6 }} />
                        {detailSaving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleEmailDraft} disabled={emailDraftLoading} style={{ display:'flex', alignItems:'center', padding:'9px 16px', fontSize:13, fontWeight:600, color:'#0070F2', background:'#EFF6FF', border:'1px solid #B8D8F8', borderRadius:8, cursor: emailDraftLoading ? 'default' : 'pointer' }}>
                        <FiMail size={15} style={{ marginRight: 6 }} />
                        {emailDraftLoading ? 'Drafting...' : 'Draft Email'}
                      </button>
                      <div style={{ flex:1 }} />
                      <button onClick={() => setEditing(true)} style={styles.detailEditBtn}>
                        <FiEdit2 size={15} style={{ marginRight: 6 }} />
                        Edit
                      </button>
                      <button onClick={handleDetailDelete} style={styles.detailDeleteBtn}>
                        <FiTrash2 size={15} style={{ marginRight: 6 }} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '24px 32px',
    maxWidth: 1400,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#1D2D3E',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 13,
    color: '#6A767D',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: '1px solid #D1D9E0',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#6A767D',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: '#0070F2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  searchWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#A0AAB4',
  },
  searchInput: {
    width: '100%',
    padding: '11px 40px 11px 40px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 8,
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#A0AAB4',
    padding: 4,
    display: 'flex',
  },
  tableWrap: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #E8EBF0',
    overflow: 'auto',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    borderBottom: '2px solid #E8EBF0',
    background: '#FAFBFC',
    whiteSpace: 'nowrap',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderBottom: '1px solid #F0F2F5',
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    color: '#354A5F',
    whiteSpace: 'nowrap',
    maxWidth: 250,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  loaderWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: 60,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #E8EBF0',
    borderTopColor: '#0070F2',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #E8EBF0',
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6A767D',
    padding: 4,
    display: 'flex',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  fieldHalf: {},
  fieldFull: {
    gridColumn: '1 / -1',
  },
  formLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#354A5F',
    marginBottom: 5,
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#F7F8FA',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 20,
    borderTop: '1px solid #E8EBF0',
    marginTop: 20,
  },
  cancelBtn: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#6A767D',
    background: '#F0F2F5',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: '#0070F2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  detailModal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 780,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  detailLoaderWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #E8EBF0',
  },
  detailHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#1D2D3E',
  },
  detailMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  detailBody: {
    padding: 24,
    overflowY: 'auto',
    flex: 1,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 28px',
  },
  detailFieldHalf: {},
  detailFieldFull: {
    gridColumn: '1 / -1',
  },
  detailLabel: {
    margin: '0 0 4px',
    fontSize: 12,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  detailValue: {
    margin: 0,
    fontSize: 14,
    color: '#1D2D3E',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  detailInput: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#F7F8FA',
  },
  detailFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid #E8EBF0',
  },
  detailEditBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#0070F2',
    background: '#E8F4FD',
    border: '1px solid #B8D8F8',
    borderRadius: 8,
    cursor: 'pointer',
  },
  detailDeleteBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#BB0000',
    background: '#FDEDED',
    border: '1px solid #F5C6C6',
    borderRadius: 8,
    cursor: 'pointer',
  },
  detailSaveBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: '#0070F2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  detailCancelBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6A767D',
    background: '#F0F2F5',
    border: '1px solid #D1D9E0',
    borderRadius: 8,
    cursor: 'pointer',
  },
};

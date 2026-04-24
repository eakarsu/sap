import { useState, useEffect } from 'react';
import {
  callAI, embedKnowledgeBase, ragSearch, uploadDocument, fetchDocuments,
  deleteDocument, getCustomer360, getRecommendations, getWorkflowSuggestions,
  explainAnomalies, fetchAnomalies,
  conversationalRag, getApprovalRouting, getPredictiveInventory,
  getContractAnalysis, getIntelligentMatching, getNlReporting,
  getDataQuality, getVendorRisk, multiDocQA, getChangeImpact,
  emailToRecord, getPricingOptimizer, getBatchDemandForecast,
  translateAI, ragWithCitations
} from '../api';
import {
  FiBarChart2, FiTrendingUp, FiHeart, FiZap, FiActivity,
  FiShield, FiEdit2, FiMessageSquare, FiSend, FiCpu,
  FiCode, FiCopy, FiCheck, FiDatabase, FiUpload, FiSearch,
  FiUser, FiPackage, FiTool, FiAlertTriangle, FiTrash2, FiFileText,
  FiCheckCircle, FiBox,
  FiLink, FiPieChart, FiClipboard, FiStar, FiBookOpen,
  FiRefreshCw, FiMail, FiDollarSign, FiLayers, FiGlobe, FiBookmark
} from 'react-icons/fi';

// ============ AI RESULT MODAL ============
function AIResultModal({ title, content, extras, onClose }) {
  if (!content && !extras) return null;
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{title || 'AI Result'}</h2>
          <button onClick={onClose} style={modalStyles.closeBtn}>&times;</button>
        </div>
        <div style={modalStyles.body}>
          {extras && <div style={{ marginBottom: 16 }}>{extras}</div>}
          <AIOutputDisplay content={content} />
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 900,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #E8EBF0',
    background: 'linear-gradient(135deg, #0070F2 0%, #8B47D7 100%)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    fontSize: 24,
    width: 36,
    height: 36,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    flexShrink: 0,
  },
  body: {
    padding: 24,
    overflowY: 'auto',
    flex: 1,
  },
};

const aiFeatures = [
  {
    key: 'sales-forecast',
    title: 'Sales Forecast',
    description: 'AI-powered revenue predictions and trend analysis based on historical data and pipeline.',
    icon: FiBarChart2,
    color: '#0070F2',
    action: 'Generate',
    samples: [
      { label: 'Q1 Pipeline', context: 'Focus on Q1 pipeline and conversion rates' },
      { label: 'Enterprise Deals', context: 'Analyze enterprise segment deals over $100K' },
      { label: 'Regional Trends', context: 'Compare sales trends across all regions' },
    ],
  },
  {
    key: 'lead-scoring',
    title: 'Lead Scoring',
    description: 'Intelligent lead prioritization using behavioral signals and conversion patterns.',
    icon: FiTrendingUp,
    color: '#E76500',
    action: 'Analyze',
    samples: [
      { label: 'Last 30 Days', context: 'Score leads from the last 30 days based on engagement' },
      { label: 'Inbound Leads', context: 'Prioritize inbound leads from marketing campaigns' },
      { label: 'Enterprise Segment', context: 'Focus on enterprise segment leads with high deal potential' },
    ],
  },
  {
    key: 'sentiment',
    title: 'Customer Sentiment',
    description: 'Analyze customer interactions to gauge satisfaction and detect churn risks.',
    icon: FiHeart,
    color: '#E3008C',
    action: 'Analyze',
    samples: [
      { label: 'Support Tickets', context: 'Analyze sentiment from recent support ticket interactions' },
      { label: 'Key Accounts', context: 'Gauge satisfaction levels for top 20 key accounts' },
      { label: 'Recent Interactions', context: 'Review sentiment trends from last quarter interactions' },
    ],
  },
  {
    key: 'insights',
    title: 'Business Insights',
    description: 'Discover actionable insights from your CRM data and business operations.',
    icon: FiZap,
    color: '#8B47D7',
    action: 'Generate',
    samples: [
      { label: 'Revenue Trends', context: 'Analyze revenue trends and growth patterns across segments' },
      { label: 'Customer Churn', context: 'Identify customers at risk of churning and root causes' },
      { label: 'Cross-sell Opportunities', context: 'Find cross-sell and upsell opportunities in existing accounts' },
    ],
  },
  {
    key: 'performance',
    title: 'Performance Analysis',
    description: 'Evaluate team and individual performance across sales, service, and operations.',
    icon: FiActivity,
    color: '#498205',
    action: 'Analyze',
    samples: [
      { label: 'Sales Team', context: 'Evaluate sales team performance and quota attainment' },
      { label: 'Q4 Results', context: 'Analyze Q4 results compared to targets and prior year' },
      { label: 'Support Metrics', context: 'Review support team response times and resolution rates' },
    ],
  },
  {
    key: 'competitor-analysis',
    title: 'Competitor Analysis',
    description: 'Strategic competitive intelligence and market positioning recommendations.',
    icon: FiShield,
    color: '#A4262C',
    action: 'Analyze',
    samples: [
      { label: 'Market Share', context: 'Analyze current market share and competitive positioning' },
      { label: 'Pricing Analysis', context: 'Compare pricing strategies against top competitors' },
      { label: 'Product Comparison', context: 'Feature-by-feature comparison with main competitors' },
    ],
  },
  {
    key: 'content-generate',
    title: 'Content Generator',
    description: 'Generate professional emails, proposals, reports, and marketing content with AI.',
    icon: FiEdit2,
    color: '#1565C0',
    action: 'Generate',
    hasForm: true,
  },
  {
    key: 'copilot',
    title: 'AI Copilot Chat',
    description: 'Ask questions about your business data and get intelligent AI-powered answers.',
    icon: FiMessageSquare,
    color: '#354A5F',
    action: 'Chat',
    hasChat: true,
  },
];

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={outputStyles.codeBlock}>
      <div style={outputStyles.codeHeader}>
        <span style={outputStyles.codeLang}>{language || 'code'}</span>
        <button onClick={handleCopy} style={outputStyles.copyBtn}>
          {copied ? <><FiCheck size={12} /> Copied</> : <><FiCopy size={12} /> Copy</>}
        </button>
      </div>
      <pre style={outputStyles.pre}><code>{code}</code></pre>
    </div>
  );
}

function AIOutputDisplay({ content }) {
  if (!content) return null;

  const text = String(content);
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} style={outputStyles.ul}>
          {listItems.map((li, j) => (
            <li key={j} style={outputStyles.li}>{renderInline(li)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#1D2D3E' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={outputStyles.inlineCode}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  // Split by code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);

  segments.forEach((segment, si) => {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      flushList();
      const inner = segment.slice(3, -3);
      const nlIndex = inner.indexOf('\n');
      const lang = nlIndex > 0 ? inner.slice(0, nlIndex).trim() : '';
      const code = nlIndex > 0 ? inner.slice(nlIndex + 1) : inner;
      elements.push(<CodeBlock key={`code-${si}`} code={code} language={lang} />);
    } else {
      const lines = segment.split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) { flushList(); return; }
        if (trimmed.startsWith('## ')) {
          flushList();
          elements.push(<h2 key={`${si}-${i}`} style={outputStyles.h2}>{renderInline(trimmed.slice(3))}</h2>);
        } else if (trimmed.startsWith('### ')) {
          flushList();
          elements.push(<h3 key={`${si}-${i}`} style={outputStyles.h3}>{renderInline(trimmed.slice(4))}</h3>);
        } else if (trimmed.match(/^\d+\.\s/)) {
          listItems.push(trimmed.replace(/^\d+\.\s/, ''));
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          listItems.push(trimmed.slice(2));
        } else {
          flushList();
          elements.push(<p key={`${si}-${i}`} style={outputStyles.p}>{renderInline(trimmed)}</p>);
        }
      });
    }
  });
  flushList();

  return <div style={outputStyles.container}>{elements}</div>;
}

const outputStyles = {
  container: {
    background: '#FAFBFC',
    border: '1px solid #E8EBF0',
    borderRadius: 10,
    padding: '20px 24px',
    marginTop: 16,
  },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0070F2',
    margin: '20px 0 10px',
    paddingBottom: 8,
    borderBottom: '2px solid #E8F4FD',
  },
  h3: {
    fontSize: 15,
    fontWeight: 600,
    color: '#354A5F',
    margin: '16px 0 8px',
  },
  p: {
    fontSize: 14,
    color: '#354A5F',
    lineHeight: 1.7,
    margin: '8px 0',
  },
  ul: {
    margin: '8px 0',
    paddingLeft: 20,
  },
  li: {
    fontSize: 14,
    color: '#354A5F',
    lineHeight: 1.7,
    marginBottom: 4,
  },
  inlineCode: {
    background: '#E8EBF0',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    color: '#D83B01',
  },
  codeBlock: {
    margin: '16px 0',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #D1D9E0',
    background: '#1D2D3E',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    background: '#2A3F54',
    borderBottom: '1px solid #354A5F',
  },
  codeLang: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8B9DB5',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#8B9DB5',
    background: 'none',
    border: '1px solid #445A6F',
    borderRadius: 4,
    padding: '3px 8px',
    cursor: 'pointer',
  },
  pre: {
    margin: 0,
    padding: '16px',
    overflow: 'auto',
    maxHeight: 500,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#E8EBF0',
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  },
};

export default function AIInsights() {
  const [activeFeature, setActiveFeature] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);

  // Modal state for AI results
  const [modalContent, setModalContent] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalExtras, setModalExtras] = useState(null);
  const openModal = (title, content, extras) => { setModalTitle(title); setModalContent(content); setModalExtras(extras || null); };
  const closeModal = () => { setModalContent(null); setModalTitle(''); setModalExtras(null); };

  // Content generator form
  const [contentForm, setContentForm] = useState({
    contentType: 'Email',
    topic: '',
    audience: '',
    tone: 'Professional',
  });

  // Code generator form
  const [codeForm, setCodeForm] = useState({
    language: 'ABAP',
    description: '',
    context: 'SAP S/4HANA',
  });

  // Copilot chat
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  // RAG Knowledge Base
  const [kbEmbedding, setKbEmbedding] = useState(false);
  const [kbResult, setKbResult] = useState(null);
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState(null);
  const [ragSearching, setRagSearching] = useState(false);

  // Document Store
  const [docFile, setDocFile] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('General');
  const [docUploading, setDocUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docLoaded, setDocLoaded] = useState(false);

  // Customer 360
  const [c360Account, setC360Account] = useState('');
  const [c360Loading, setC360Loading] = useState(false);

  // Recommendations
  const [recAccount, setRecAccount] = useState('');
  const [recLoading, setRecLoading] = useState(false);

  // Workflow Suggestions
  const [wfLoading, setWfLoading] = useState(false);

  // Anomaly Explanations
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  // 1. Conversational RAG
  const [cragInput, setCragInput] = useState('');
  const [cragHistory, setCragHistory] = useState([]);
  const [cragSources, setCragSources] = useState([]);
  const [cragLoading, setCragLoading] = useState(false);

  // 2. Approval Routing
  const [arForm, setArForm] = useState({ module: 'orders', recordType: '', amount: '', department: '' });
  const [arLoading, setArLoading] = useState(false);

  // 3. Predictive Inventory
  const [piLoading, setPiLoading] = useState(false);

  // 4. Contract Clause Analysis
  const [ccForm, setCcForm] = useState({ contractId: '', contractText: '' });
  const [ccLoading, setCcLoading] = useState(false);

  // 5. Intelligent Matching
  const [imForm, setImForm] = useState({ documentType: 'purchase_orders', documentId: '' });
  const [imLoading, setImLoading] = useState(false);

  // 6. NL Reporting
  const [nlQuery, setNlQuery] = useState('');
  const [nlLoading, setNlLoading] = useState(false);

  // 7. Data Quality
  const [dqLoading, setDqLoading] = useState(false);

  // 8. Vendor Risk
  const [vrLoading, setVrLoading] = useState(false);

  // 9. Multi-doc Q&A
  const [mdQuestion, setMdQuestion] = useState('');
  const [mdLoading, setMdLoading] = useState(false);

  // 10. Change Impact
  const [ciForm, setCiForm] = useState({ changeType: 'Data Migration', module: '', description: '' });
  const [ciLoading, setCiLoading] = useState(false);

  // 11. Email-to-Record
  const [etEmail, setEtEmail] = useState('');
  const [etLoading, setEtLoading] = useState(false);

  // 12. Pricing Optimizer
  const [poForm, setPoForm] = useState({ productName: '', accountName: '' });
  const [poLoading, setPoLoading] = useState(false);

  // 13. Batch Demand Forecast
  const [bdLoading, setBdLoading] = useState(false);

  // 14. Multi-language
  const [tlText, setTlText] = useState('');
  const [tlLang, setTlLang] = useState('German');
  const [tlLoading, setTlLoading] = useState(false);

  // 15. RAG with Citations
  const [rcQuestion, setRcQuestion] = useState('');
  const [rcLoading, setRcLoading] = useState(false);

  useEffect(() => {
    fetchAnomalies().then(r => setAnomalies(r?.anomalies || [])).catch(() => {});
  }, []);

  const loadDocuments = async () => {
    const res = await fetchDocuments();
    setDocuments(res?.documents || []);
    setDocLoaded(true);
  };

  const handleEmbedKB = async () => {
    setKbEmbedding(true);
    setKbResult(null);
    try {
      const res = await embedKnowledgeBase();
      setKbResult(res);
    } catch (e) {
      setKbResult({ error: 'Failed to embed KB articles' });
    }
    setKbEmbedding(false);
  };

  const handleRagSearch = async () => {
    if (!ragQuery.trim()) return;
    setRagSearching(true);
    try {
      const res = await ragSearch(ragQuery);
      setRagResults(res?.results || []);
    } catch (e) {
      setRagResults([]);
    }
    setRagSearching(false);
  };

  const handleDocUpload = async () => {
    if (!docFile) return;
    setDocUploading(true);
    try {
      const res = await uploadDocument(docFile, docTitle, docCategory);
      if (res?.error) {
        openModal('Document Upload', 'Upload failed: ' + res.error);
      } else {
        openModal('Document Upload', `Document "${res?.document?.title || docTitle || docFile.name}" uploaded and embedded successfully (${res?.chunks_embedded || 0} chunks).`);
        setDocFile(null);
        setDocTitle('');
        loadDocuments();
      }
    } catch (e) {
      openModal('Document Upload', 'Failed to upload document. Check that the backend is running and the file is a valid PDF or text file.');
    }
    setDocUploading(false);
  };

  const handleDocDelete = async (id) => {
    await deleteDocument(id);
    loadDocuments();
  };

  const handleCustomer360 = async () => {
    if (!c360Account.trim()) return;
    setC360Loading(true);
    try {
      const res = await getCustomer360(c360Account);
      const stats = res?.stats;
      const extras = stats ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {Object.entries(stats).map(([k, v]) => (
            <span key={k} style={{ padding: '4px 12px', borderRadius: 14, background: '#E0F5F5', color: '#006060', fontSize: 12, fontWeight: 600 }}>
              {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: {typeof v === 'number' && v > 100 ? '$' + v.toLocaleString() : v}
            </span>
          ))}
        </div>
      ) : null;
      openModal('Customer 360 — ' + c360Account, res?.result || 'No data found.', extras);
    } catch (e) {
      openModal('Customer 360', 'Failed to generate customer 360 view.');
    }
    setC360Loading(false);
  };

  const handleRecommendations = async () => {
    if (!recAccount.trim()) return;
    setRecLoading(true);
    try {
      const res = await getRecommendations(recAccount);
      const recs = res?.result;
      if (Array.isArray(recs) && recs.length > 0) {
        const extras = (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {recs.map((rec, i) => (
              <div key={i} style={{ padding: '16px 18px', background: '#FFF8F0', border: '1px solid #FFE0B2', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E76500', textTransform: 'uppercase' }}>{rec.type}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: rec.confidence === 'high' ? '#498205' : rec.confidence === 'medium' ? '#E76500' : '#6A767D', padding: '2px 8px', borderRadius: 10, background: rec.confidence === 'high' ? '#F0FFF0' : rec.confidence === 'medium' ? '#FFF8F0' : '#F0F2F5' }}>{rec.confidence}</span>
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#1D2D3E' }}>{rec.product}</h4>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6A767D', lineHeight: 1.5 }}>{rec.reason}</p>
                {rec.estimated_value > 0 && <div style={{ fontSize: 18, fontWeight: 700, color: '#498205', marginBottom: 6 }}>${Number(rec.estimated_value).toLocaleString()}</div>}
                <p style={{ margin: 0, fontSize: 12, color: '#354A5F', fontStyle: 'italic' }}>{rec.action}</p>
              </div>
            ))}
          </div>
        );
        openModal('Recommendations — ' + recAccount, null, extras);
      } else {
        openModal('Recommendations — ' + recAccount, typeof recs === 'string' ? recs : 'No recommendations found.');
      }
    } catch (e) {
      openModal('Recommendations', 'Failed to generate recommendations.');
    }
    setRecLoading(false);
  };

  const handleWorkflow = async () => {
    setWfLoading(true);
    try {
      const res = await getWorkflowSuggestions();
      const stats = res?.stats;
      const extras = stats ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {Object.entries(stats).map(([k, v]) => (
            <span key={k} style={{ padding: '4px 12px', borderRadius: 14, background: v > 0 ? '#FFF8F0' : '#F0FFF0', color: v > 0 ? '#D14900' : '#498205', fontSize: 12, fontWeight: 600, border: `1px solid ${v > 0 ? '#FFE0B2' : '#B8E6B8'}` }}>
              {k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: {v}
            </span>
          ))}
        </div>
      ) : null;
      openModal('Workflow Automation Suggestions', res?.result || 'No suggestions.', extras);
    } catch (e) {
      openModal('Workflow Suggestions', 'Failed to generate workflow suggestions.');
    }
    setWfLoading(false);
  };

  const handleExplainAnomalies = async () => {
    if (anomalies.length === 0) return;
    setAnomalyLoading(true);
    try {
      const res = await explainAnomalies(anomalies);
      openModal('AI Anomaly Explanations', res?.result || 'No explanation generated.');
    } catch (e) {
      openModal('AI Anomaly Explanations', 'Failed to explain anomalies.');
    }
    setAnomalyLoading(false);
  };

  // --- Advanced RAG Handlers ---
  const handleCragSend = async () => {
    if (!cragInput.trim()) return;
    const q = cragInput;
    setCragInput('');
    const newHistory = [...cragHistory, { role: 'user', content: q }];
    setCragHistory(newHistory);
    setCragLoading(true);
    try {
      const res = await conversationalRag(q, newHistory);
      setCragHistory(prev => [...prev, { role: 'ai', content: res?.result || 'No answer found.' }]);
      setCragSources(res?.sources || []);
    } catch (e) {
      setCragHistory(prev => [...prev, { role: 'ai', content: 'Failed to get answer.' }]);
    }
    setCragLoading(false);
  };

  const handleApprovalRouting = async () => {
    setArLoading(true);
    try {
      const res = await getApprovalRouting(arForm);
      const data = res?.result;
      if (data && data.suggested_chain) {
        const extras = (
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#4527A0' }}>Suggested Approval Chain</h4>
            {data.suggested_chain.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 6, background: '#F3E5F5', border: '1px solid #E1BEE7', borderRadius: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#4527A0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{step.step}</span>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: '#1D2D3E' }}>{step.approver}</div><div style={{ fontSize: 12, color: '#6A767D' }}>{step.role} — {step.reason}</div></div>
              </div>
            ))}
            {data.estimated_time && <p style={{ fontSize: 13, color: '#6A767D', marginTop: 8 }}>Estimated time: {data.estimated_time}</p>}
            {data.notes && <p style={{ fontSize: 13, color: '#4527A0', fontStyle: 'italic' }}>{data.notes}</p>}
          </div>
        );
        openModal('AI Approval Routing', null, extras);
      } else {
        openModal('AI Approval Routing', typeof data === 'string' ? data : 'No approval chain generated.');
      }
    } catch (e) { openModal('AI Approval Routing', 'Failed to analyze approval routing.'); }
    setArLoading(false);
  };

  const handlePredictiveInventory = async () => {
    setPiLoading(true);
    try {
      const res = await getPredictiveInventory();
      openModal('Predictive Inventory', res?.result || 'No forecast generated.');
    } catch (e) { openModal('Predictive Inventory', 'Failed to generate forecast.'); }
    setPiLoading(false);
  };

  const handleContractAnalysis = async () => {
    setCcLoading(true);
    try {
      const res = await getContractAnalysis(ccForm);
      openModal('Contract Clause Analysis', res?.result || 'No analysis generated.');
    } catch (e) { openModal('Contract Clause Analysis', 'Failed to analyze contract.'); }
    setCcLoading(false);
  };

  const handleIntelligentMatching = async () => {
    if (!imForm.documentId) return;
    setImLoading(true);
    try {
      const res = await getIntelligentMatching(imForm.documentType, imForm.documentId);
      openModal('Intelligent Matching', res?.result || 'No matches found.');
    } catch (e) { openModal('Intelligent Matching', 'Failed to match documents.'); }
    setImLoading(false);
  };

  const handleNlReporting = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    try {
      const res = await getNlReporting(nlQuery);
      const data = res?.data || [];
      const extras = data.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{Object.keys(data[0]).map(k => <th key={k} style={{ padding: '8px 12px', background: '#FFF8E1', borderBottom: '2px solid #F57F17', textAlign: 'left', fontWeight: 600, color: '#354A5F' }}>{k}</th>)}</tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#FFFDE7' : '#fff' }}>
                  {Object.values(row).map((v, j) => <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #E8EBF0', color: '#354A5F' }}>{v != null ? String(v) : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 20 && <p style={{ fontSize: 12, color: '#6A767D', marginTop: 6 }}>Showing 20 of {data.length} rows</p>}
        </div>
      ) : null;
      openModal('Natural Language Report', res?.result || 'No report generated.', extras);
    } catch (e) { openModal('Natural Language Report', 'Failed to generate report.'); }
    setNlLoading(false);
  };

  const handleDataQuality = async () => {
    setDqLoading(true);
    try {
      const res = await getDataQuality();
      const checks = res?.checks || [];
      const extras = checks.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {checks.map((c, i) => (
            <span key={i} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600,
              background: c.severity === 'high' ? '#FFEBEE' : c.severity === 'medium' ? '#FFF3E0' : '#F1F8E9',
              color: c.severity === 'high' ? '#C62828' : c.severity === 'medium' ? '#E65100' : '#33691E',
              border: `1px solid ${c.severity === 'high' ? '#FFCDD2' : c.severity === 'medium' ? '#FFE0B2' : '#DCEDC8'}` }}>
              {c.label}: {c.count}
            </span>
          ))}
        </div>
      ) : null;
      openModal('AI Data Quality Scan', res?.result || 'No quality issues found.', extras);
    } catch (e) { openModal('AI Data Quality Scan', 'Failed to analyze data quality.'); }
    setDqLoading(false);
  };

  const handleVendorRisk = async () => {
    setVrLoading(true);
    try {
      const res = await getVendorRisk();
      const data = res?.result;
      if (data && data.vendors) {
        const extras = (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#354A5F', marginBottom: 10 }}>{data.overall_assessment}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {data.vendors.map((v, i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid',
                  borderColor: v.risk_level === 'critical' ? '#F44336' : v.risk_level === 'high' ? '#FF9800' : v.risk_level === 'medium' ? '#FFC107' : '#4CAF50',
                  background: v.risk_level === 'critical' ? '#FFF5F5' : v.risk_level === 'high' ? '#FFF8F0' : v.risk_level === 'medium' ? '#FFFDE7' : '#F1F8E9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: '#1D2D3E' }}>{v.name}</strong>
                    <span style={{ fontSize: 20, fontWeight: 700, color: v.risk_level === 'low' ? '#4CAF50' : v.risk_level === 'medium' ? '#FF9800' : '#F44336' }}>{v.risk_score}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: v.risk_level === 'low' ? '#4CAF50' : v.risk_level === 'medium' ? '#FF9800' : '#F44336' }}>{v.risk_level} risk</span>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: '#555' }}>
                    {(v.factors || []).map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: '#6A767D', margin: '6px 0 0' }}>{v.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        );
        openModal('Vendor Risk Scoring', null, extras);
      } else {
        openModal('Vendor Risk Scoring', typeof data === 'string' ? data : 'No vendor risk data available.');
      }
    } catch (e) { openModal('Vendor Risk Scoring', 'Failed to assess vendor risk.'); }
    setVrLoading(false);
  };

  const handleMultiDocQA = async () => {
    if (!mdQuestion.trim()) return;
    setMdLoading(true);
    try {
      const res = await multiDocQA(mdQuestion);
      const sources = res?.sources || [];
      const extras = sources.length > 0 ? (
        <div style={{ padding: 12, background: '#E8EAF6', borderRadius: 8, border: '1px solid #C5CAE9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#283593', marginBottom: 6 }}>Source Documents ({sources.length})</div>
          {sources.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>
              [Doc {s.id}] <strong>{s.metadata?.title || 'Untitled'}</strong> — {s.chunk.substring(0, 100)}... ({(s.similarity * 100).toFixed(0)}%)
            </div>
          ))}
        </div>
      ) : null;
      openModal('Multi-doc RAG Q&A', res?.result || 'No answer found.', extras);
    } catch (e) { openModal('Multi-doc RAG Q&A', 'Failed to query documents.'); }
    setMdLoading(false);
  };

  const handleChangeImpact = async () => {
    if (!ciForm.description) return;
    setCiLoading(true);
    try {
      const res = await getChangeImpact(ciForm);
      openModal('AI Change Impact Analysis', res?.result || 'No impact analysis generated.');
    } catch (e) { openModal('AI Change Impact Analysis', 'Failed to analyze impact.'); }
    setCiLoading(false);
  };

  const handleEmailToRecord = async () => {
    if (!etEmail.trim()) return;
    setEtLoading(true);
    try {
      const res = await emailToRecord(etEmail);
      const data = res?.result;
      if (data && data.suggested_module) {
        const extras = (
          <div style={{ padding: 16, background: '#E0F7FA', border: '1px solid #B2EBF2', borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={{ padding: '4px 12px', borderRadius: 14, background: '#00838F', color: '#fff', fontSize: 12, fontWeight: 600 }}>{data.suggested_module}</span>
              <span style={{ padding: '4px 12px', borderRadius: 14, background: data.confidence === 'high' ? '#C8E6C9' : '#FFF9C4', color: '#333', fontSize: 12, fontWeight: 600 }}>{data.confidence} confidence</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1D2D3E', margin: '0 0 8px' }}>{data.summary}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(data.extracted_fields || {}).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ fontSize: 13, color: '#354A5F' }}><strong>{k.replace(/_/g, ' ')}:</strong> {String(v)}</div>
              ))}
            </div>
            {data.additional_actions && data.additional_actions.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#00838F' }}>Suggested Actions:</div>
                {data.additional_actions.map((a, i) => <span key={i} style={{ display: 'inline-block', margin: '4px 4px 0 0', padding: '3px 10px', borderRadius: 12, background: '#B2EBF2', fontSize: 11, color: '#006064' }}>{a}</span>)}
              </div>
            )}
          </div>
        );
        openModal('Email-to-Record', null, extras);
      } else {
        openModal('Email-to-Record', typeof data === 'string' ? data : 'Could not parse the email.');
      }
    } catch (e) { openModal('Email-to-Record', 'Failed to parse email.'); }
    setEtLoading(false);
  };

  const handlePricingOptimizer = async () => {
    setPoLoading(true);
    try {
      const res = await getPricingOptimizer(poForm.productName, poForm.accountName);
      openModal('AI Pricing Optimizer', res?.result || 'No pricing suggestions.');
    } catch (e) { openModal('AI Pricing Optimizer', 'Failed to generate pricing suggestions.'); }
    setPoLoading(false);
  };

  const handleBatchDemand = async () => {
    setBdLoading(true);
    try {
      const res = await getBatchDemandForecast();
      openModal('Batch Demand Forecasting', res?.result || 'No forecast generated.');
    } catch (e) { openModal('Batch Demand Forecasting', 'Failed to generate batch forecast.'); }
    setBdLoading(false);
  };

  const handleTranslate = async () => {
    if (!tlText.trim()) return;
    setTlLoading(true);
    try {
      const res = await translateAI(tlText, tlLang);
      openModal('Translation — ' + tlLang, res?.result || 'Translation failed.');
    } catch (e) { openModal('Translation', 'Translation failed.'); }
    setTlLoading(false);
  };

  const handleRagCitations = async () => {
    if (!rcQuestion.trim()) return;
    setRcLoading(true);
    try {
      const res = await ragWithCitations(rcQuestion);
      const sources = res?.sources || [];
      const extras = sources.length > 0 ? (
        <div style={{ padding: 12, background: '#ECEFF1', borderRadius: 8, border: '1px solid #CFD8DC' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#37474F', marginBottom: 6 }}>Source Citations ({sources.length})</div>
          {sources.map((s, i) => (
            <div key={i} style={{ padding: '8px 10px', marginBottom: 6, background: '#fff', borderRadius: 6, border: '1px solid #E0E0E0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#37474F' }}>[Source {s.id}] {s.source_type}{s.metadata?.title ? `: ${s.metadata.title}` : ''}</span>
                <span style={{ fontSize: 11, color: '#9E9E9E' }}>{(s.similarity * 100).toFixed(0)}% match</span>
              </div>
              <p style={{ fontSize: 12, color: '#616161', lineHeight: 1.5, margin: 0 }}>{s.chunk}</p>
            </div>
          ))}
        </div>
      ) : null;
      openModal('RAG with Citations', res?.result || 'No answer found.', extras);
    } catch (e) { openModal('RAG with Citations', 'Failed to get cited answer.'); }
    setRcLoading(false);
  };

  const handleGenerate = async (feature, context) => {
    setActiveFeature(feature.key);
    setLoadingKey(feature.key);
    try {
      const res = await callAI(feature.key, context ? { context } : undefined);
      const content = res?.result || res?.data || res?.message || JSON.stringify(res);
      openModal(feature.title, content);
    } catch (err) {
      openModal(feature.title, 'Failed to generate AI insights. Please try again.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleContentGenerate = async () => {
    setLoadingKey('content-generate');
    try {
      const res = await callAI('content-generate', contentForm);
      const content = res?.result || res?.data || res?.message || JSON.stringify(res);
      openModal('Content Generator — ' + contentForm.contentType, content);
    } catch (err) {
      openModal('Content Generator', 'Failed to generate content. Please try again.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleCodeGenerate = async () => {
    setLoadingKey('code-generate');
    try {
      const res = await callAI('code-generate', codeForm);
      const content = res?.result || res?.data || res?.message || JSON.stringify(res);
      openModal('SAP Build Code — ' + codeForm.language, content);
    } catch (err) {
      openModal('SAP Build Code', 'Failed to generate code. Please try again.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleCopilotSend = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput;
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', content: question }];
    setChatHistory(newHistory);
    setLoadingKey('copilot');
    try {
      const res = await callAI('copilot', { message: question, history: newHistory });
      const answer = res?.result || res?.data || res?.message || JSON.stringify(res);
      setChatHistory((prev) => [...prev, { role: 'ai', content: answer }]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'ai', content: 'Sorry, I could not process your request. Please try again.' }]);
    } finally {
      setLoadingKey(null);
    }
  };

  const suggestions = [
    "What's our pipeline value?",
    'Summarize open tickets',
    'Top performing territories',
    'Revenue forecast',
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <FiCpu size={28} />
        </div>
        <div>
          <h1 style={styles.headerTitle}>SAP AI Business Copilot</h1>
          <p style={styles.headerSub}>Intelligent insights powered by artificial intelligence</p>
        </div>
      </div>

      {/* AI Feature Cards Grid */}
      <div style={styles.cardGrid}>
        {aiFeatures.filter((f) => !f.hasForm && !f.hasChat).map((feature) => {
          const Icon = feature.icon;
          const isActive = activeFeature === feature.key;
          const isLoading = loadingKey === feature.key;
          return (
            <div key={feature.key} style={{ ...styles.featureCard, borderTop: `3px solid ${feature.color}` }}>
              <div style={{ ...styles.featureIcon, background: feature.color + '14', color: feature.color }}>
                <Icon size={24} />
              </div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
              {feature.samples && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                  {feature.samples.map((s) => (
                    <button key={s.label}
                      onClick={() => handleGenerate(feature, s.context)}
                      style={{ padding:'5px 12px', fontSize:11, fontWeight:500, color: feature.color,
                        background:'#fff', border:`1px solid ${feature.color}30`, borderRadius:14, cursor:'pointer' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleGenerate(feature)}
                disabled={isLoading}
                style={{ ...styles.featureBtn, background: feature.color }}
              >
                {isLoading ? (
                  <>
                    <div style={styles.btnSpinner} />
                    Processing...
                  </>
                ) : (
                  feature.action
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Content Generator */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #1565C0' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#1565C014', color: '#1565C0' }}>
            <FiEdit2 size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Content Generator</h3>
            <p style={styles.featureDesc}>Generate professional emails, proposals, reports, and marketing content with AI.</p>
          </div>
        </div>
        <div style={styles.contentForm}>
          <div style={styles.contentFormGrid}>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Content Type</label>
              <select
                value={contentForm.contentType}
                onChange={(e) => setContentForm({ ...contentForm, contentType: e.target.value })}
                style={styles.formInput}
              >
                <option value="Email">Email</option>
                <option value="Proposal">Proposal</option>
                <option value="Report">Report</option>
                <option value="Blog Post">Blog Post</option>
                <option value="Social Media Post">Social Media Post</option>
                <option value="Sales Pitch">Sales Pitch</option>
                <option value="Meeting Summary">Meeting Summary</option>
              </select>
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Tone</label>
              <select
                value={contentForm.tone}
                onChange={(e) => setContentForm({ ...contentForm, tone: e.target.value })}
                style={styles.formInput}
              >
                <option value="Professional">Professional</option>
                <option value="Formal">Formal</option>
                <option value="Casual">Casual</option>
                <option value="Persuasive">Persuasive</option>
                <option value="Friendly">Friendly</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Topic</label>
              <input
                type="text"
                value={contentForm.topic}
                onChange={(e) => setContentForm({ ...contentForm, topic: e.target.value })}
                placeholder="e.g., Q4 sales results, product launch..."
                style={styles.formInput}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Target Audience</label>
              <input
                type="text"
                value={contentForm.audience}
                onChange={(e) => setContentForm({ ...contentForm, audience: e.target.value })}
                placeholder="e.g., C-level executives, customers..."
                style={styles.formInput}
              />
            </div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
            {[
              { label: 'Q4 Results Email', topic: 'Q4 2025 sales results and achievements', audience: 'C-level executives', contentType: 'Email', tone: 'Professional' },
              { label: 'Product Launch', topic: 'New cloud analytics platform launch announcement', audience: 'Existing customers', contentType: 'Blog Post', tone: 'Persuasive' },
              { label: 'Sales Pitch', topic: 'Enterprise ERP migration with AI-powered automation', audience: 'IT Decision Makers', contentType: 'Sales Pitch', tone: 'Persuasive' },
              { label: 'Meeting Summary', topic: 'Quarterly business review with key stakeholders', audience: 'Internal team and management', contentType: 'Meeting Summary', tone: 'Professional' },
            ].map(s => (
              <button key={s.label}
                onClick={() => setContentForm({ contentType: s.contentType, topic: s.topic, audience: s.audience, tone: s.tone })}
                style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#1565C0', background:'#E8F0FE', border:'1px solid #B8D0F0', borderRadius:16, cursor:'pointer' }}>
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleContentGenerate}
            disabled={loadingKey === 'content-generate'}
            style={{ ...styles.featureBtn, background: '#1565C0', marginTop: 16 }}
          >
            {loadingKey === 'content-generate' ? (
              <>
                <div style={styles.btnSpinner} />
                Generating...
              </>
            ) : (
              'Generate Content'
            )}
          </button>
        </div>
      </div>

      {/* SAP Build Code - AI Code Generator */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #007DB8' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#007DB814', color: '#007DB8' }}>
            <FiCode size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>SAP Build Code with Joule AI</h3>
            <p style={styles.featureDesc}>Generate production-ready code for ABAP, Fiori UI5, CDS Models, OData Services, JavaScript, SQL, and integration flows.</p>
          </div>
        </div>
        <div style={styles.contentForm}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={styles.formField}>
              <label style={styles.formLabel}>Language / Framework</label>
              <select
                value={codeForm.language}
                onChange={(e) => setCodeForm({ ...codeForm, language: e.target.value })}
                style={styles.formInput}
              >
                <option value="ABAP">ABAP</option>
                <option value="ABAP RAP">ABAP RAP (RESTful Application Programming)</option>
                <option value="CDS">CDS (Core Data Services)</option>
                <option value="OData V4">OData V4 Service</option>
                <option value="SAP Fiori UI5">SAP Fiori / UI5</option>
                <option value="SAP CAP Node.js">SAP CAP (Node.js)</option>
                <option value="SAP CAP Java">SAP CAP (Java)</option>
                <option value="JavaScript">JavaScript / Node.js</option>
                <option value="SQL HANA">SQL (SAP HANA)</option>
                <option value="Integration Flow">SAP Integration Suite Flow</option>
                <option value="Workflow">SAP Build Process Automation</option>
                <option value="BTP Extension">SAP BTP Extension</option>
              </select>
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>SAP Context</label>
              <select
                value={codeForm.context}
                onChange={(e) => setCodeForm({ ...codeForm, context: e.target.value })}
                style={styles.formInput}
              >
                <option value="SAP S/4HANA">SAP S/4HANA</option>
                <option value="SAP BTP">SAP BTP</option>
                <option value="SAP SuccessFactors">SAP SuccessFactors</option>
                <option value="SAP Ariba">SAP Ariba</option>
                <option value="SAP Commerce Cloud">SAP Commerce Cloud</option>
                <option value="SAP Analytics Cloud">SAP Analytics Cloud</option>
                <option value="SAP Integration Suite">SAP Integration Suite</option>
                <option value="SAP Datasphere">SAP Datasphere</option>
                <option value="SAP Fieldglass">SAP Fieldglass</option>
                <option value="Custom">Custom / General</option>
              </select>
            </div>
          </div>
          <div style={{ ...styles.formField, marginTop: 16 }}>
            <label style={styles.formLabel}>Describe what you want to build</label>
            <textarea
              value={codeForm.description}
              onChange={(e) => setCodeForm({ ...codeForm, description: e.target.value })}
              placeholder="e.g., Create a CDS view for sales order items with currency conversion, or Build a Fiori Elements list report for purchase orders with filters..."
              style={{ ...styles.formInput, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
              rows={3}
            />
          </div>
          {/* Quick templates */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[
              { label: 'ABAP Class', lang: 'ABAP', desc: 'Create an ABAP class with constructor, methods for CRUD operations on sales orders' },
              { label: 'CDS View', lang: 'CDS', desc: 'Create a CDS view entity for sales order items with associations to business partner and product' },
              { label: 'Fiori List Report', lang: 'SAP Fiori UI5', desc: 'Create a Fiori Elements List Report page with smart filters for sales orders' },
              { label: 'OData Service', lang: 'OData V4', desc: 'Create an OData V4 service definition for customer master data with CRUD operations' },
              { label: 'CAP Service', lang: 'SAP CAP Node.js', desc: 'Create a CAP service with entity definitions for products and orders with custom handlers' },
              { label: 'HANA SQL', lang: 'SQL HANA', desc: 'Create a HANA calculation view with sales analytics aggregating by region and product category' },
              { label: 'RAP Business Object', lang: 'ABAP RAP', desc: 'Create a RAP managed business object for travel booking with draft support' },
              { label: 'Integration Flow', lang: 'Integration Flow', desc: 'Create an integration flow to sync business partners from S/4HANA to SuccessFactors' },
            ].map(t => (
              <button key={t.label} onClick={() => setCodeForm({ language: t.lang, context: 'SAP S/4HANA', description: t.desc })}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#007DB8', background: '#E8F6FA', border: '1px solid #B8E0EF', borderRadius: 16, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleCodeGenerate}
            disabled={loadingKey === 'code-generate' || !codeForm.description.trim()}
            style={{ ...styles.featureBtn, background: '#007DB8', marginTop: 16 }}
          >
            {loadingKey === 'code-generate' ? (
              <><div style={styles.btnSpinner} /> Generating Code...</>
            ) : (
              <><FiCode size={16} /> Generate Code</>
            )}
          </button>
        </div>
      </div>

      {/* === RAG Knowledge Base === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #006400' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#00640014', color: '#006400' }}>
            <FiDatabase size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>RAG Knowledge Base</h3>
            <p style={styles.featureDesc}>Embed your knowledge base articles into the vector store for semantic search and AI-enhanced answers.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={handleEmbedKB} disabled={kbEmbedding}
            style={{ ...styles.featureBtn, background: '#006400' }}>
            {kbEmbedding ? <><div style={styles.btnSpinner} /> Embedding...</> : <><FiDatabase size={16} /> Embed KB Articles</>}
          </button>
          {kbResult && (
            <div style={{ padding: '8px 16px', borderRadius: 8, background: kbResult.error ? '#FFF0F0' : '#F0FFF0', border: `1px solid ${kbResult.error ? '#F5C6C6' : '#B8E6B8'}`, fontSize: 13, color: kbResult.error ? '#BB0000' : '#006400', display: 'flex', alignItems: 'center' }}>
              {kbResult.error || `Embedded ${kbResult.articles} articles into ${kbResult.chunks} chunks`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="text" value={ragQuery} onChange={e => setRagQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRagSearch(); }}
            placeholder="Semantic search across knowledge base..."
            style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleRagSearch} disabled={ragSearching || !ragQuery.trim()}
            style={{ ...styles.featureBtn, background: '#006400', padding: '10px 20px' }}>
            {ragSearching ? <div style={styles.btnSpinner} /> : <FiSearch size={16} />}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
          {[
            'S/4HANA setup and configuration',
            'Ariba procurement best practices',
            'Datasphere data modeling',
          ].map(s => (
            <button key={s} onClick={() => setRagQuery(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#006400', background:'#00640014', border:'1px solid #00640040', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
        {ragResults && (
          <div style={{ marginTop: 16 }}>
            {ragResults.length === 0 ? (
              <p style={{ color: '#6A767D', fontSize: 13 }}>No results found. Try embedding KB articles first.</p>
            ) : (
              ragResults.map((r, i) => (
                <div key={i} style={{ padding: '12px 16px', marginBottom: 8, background: '#F7FFF7', border: '1px solid #D4EDD4', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#006400', textTransform: 'uppercase' }}>{r.source_type}</span>
                    <span style={{ fontSize: 12, color: '#6A767D' }}>Similarity: {(r.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#354A5F', lineHeight: 1.6, margin: 0 }}>{r.content_chunk.substring(0, 400)}{r.content_chunk.length > 400 ? '...' : ''}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* === Document Store & RAG === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #5C2D91' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#5C2D9114', color: '#5C2D91' }}>
            <FiUpload size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Document Store & RAG</h3>
            <p style={styles.featureDesc}>Upload PDF or TXT documents to automatically extract text, chunk it, and embed into the vector store.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Document Title</label>
            <input type="text" value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Enter title..." style={styles.formInput} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Category</label>
            <select value={docCategory} onChange={e => setDocCategory(e.target.value)} style={styles.formInput}>
              <option>General</option>
              <option>Policy</option>
              <option>Technical</option>
              <option>Process</option>
              <option>Training</option>
            </select>
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>File (PDF / TXT)</label>
            <input type="file" accept=".pdf,.txt,.md,.csv" onChange={e => setDocFile(e.target.files[0])}
              style={{ ...styles.formInput, padding: '7px 12px' }} />
          </div>
        </div>
        <button onClick={handleDocUpload} disabled={docUploading || !docFile}
          style={{ ...styles.featureBtn, background: '#5C2D91' }}>
          {docUploading ? <><div style={styles.btnSpinner} /> Uploading & Embedding...</> : <><FiUpload size={16} /> Upload & Embed</>}
        </button>
        {!docLoaded && (
          <button onClick={loadDocuments} style={{ ...styles.featureBtn, background: '#5C2D91', marginLeft: 10, opacity: 0.8 }}>
            <FiFileText size={16} /> Load Documents
          </button>
        )}
        {documents.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#354A5F', margin: '0 0 10px' }}>Uploaded Documents</h4>
            {documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 6, background: '#FAF5FF', border: '1px solid #E8DEF8', borderRadius: 8 }}>
                <FiFileText size={18} style={{ color: '#5C2D91', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#354A5F' }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: '#6A767D' }}>{doc.filename} | {doc.category} | {doc.uploaded_by} | {new Date(doc.created_at).toLocaleDateString()}</div>
                </div>
                <button onClick={() => handleDocDelete(doc.id)} style={{ background: 'none', border: '1px solid #E8DEF8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#A4262C', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <FiTrash2 size={12} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Customer 360 AI Summary === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #008080' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#00808014', color: '#008080' }}>
            <FiUser size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Customer 360 AI Summary</h3>
            <p style={styles.featureDesc}>Get a comprehensive AI-generated view of any account — contacts, opportunities, tickets, orders, and revenue analysis.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="text" value={c360Account} onChange={e => setC360Account(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomer360(); }}
            placeholder="Enter account name (e.g., BASF, Siemens)..." style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleCustomer360} disabled={c360Loading || !c360Account.trim()}
            style={{ ...styles.featureBtn, background: '#008080' }}>
            {c360Loading ? <><div style={styles.btnSpinner} /> Analyzing...</> : <><FiUser size={16} /> Generate 360</>}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {['BASF', 'Siemens', 'Deutsche Bank'].map(s => (
            <button key={s} onClick={() => setC360Account(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#008080', background:'#00808014', border:'1px solid #00808040', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* === AI-Powered Recommendations === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #E76500' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#E7650014', color: '#E76500' }}>
            <FiPackage size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI-Powered Recommendations</h3>
            <p style={styles.featureDesc}>Get cross-sell and upsell suggestions based on account purchase history and product catalog.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="text" value={recAccount} onChange={e => setRecAccount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRecommendations(); }}
            placeholder="Enter account name..." style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleRecommendations} disabled={recLoading || !recAccount.trim()}
            style={{ ...styles.featureBtn, background: '#E76500' }}>
            {recLoading ? <><div style={styles.btnSpinner} /> Generating...</> : <><FiPackage size={16} /> Get Recommendations</>}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {['BASF', 'SAP SE', 'BMW'].map(s => (
            <button key={s} onClick={() => setRecAccount(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#E76500', background:'#E7650014', border:'1px solid #E7650040', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* === Workflow Automation Suggestions === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #498205' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#49820514', color: '#498205' }}>
            <FiTool size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Workflow Automation Suggestions</h3>
            <p style={styles.featureDesc}>Analyze pending approvals, overdue tickets, stale opportunities, and expiring contracts for a prioritized action plan.</p>
          </div>
        </div>
        <button onClick={handleWorkflow} disabled={wfLoading}
          style={{ ...styles.featureBtn, background: '#498205', marginBottom: 12 }}>
          {wfLoading ? <><div style={styles.btnSpinner} /> Analyzing Workflows...</> : <><FiTool size={16} /> Analyze & Suggest</>}
        </button>
      </div>

      {/* === AI Anomaly Explanations === */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #A4262C' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#A4262C14', color: '#A4262C' }}>
            <FiAlertTriangle size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Anomaly Explanations</h3>
            <p style={styles.featureDesc}>Get AI-powered root cause analysis and corrective actions for detected business anomalies.</p>
          </div>
        </div>
        {anomalies.length === 0 ? (
          <p style={{ color: '#6A767D', fontSize: 13 }}>No anomalies currently detected. Your business metrics look healthy.</p>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              {anomalies.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 6, background: a.severity === 'high' ? '#FFF0F0' : '#FFF8F0', border: `1px solid ${a.severity === 'high' ? '#F5C6C6' : '#FFE0B2'}`, borderRadius: 8 }}>
                  <FiAlertTriangle size={14} style={{ color: a.severity === 'high' ? '#BB0000' : '#E76500', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: a.severity === 'high' ? '#BB0000' : '#D14900' }}>{a.title}</span>
                  <span style={{ fontSize: 12, color: '#6A767D' }}>— {a.description}</span>
                </div>
              ))}
            </div>
            <button onClick={handleExplainAnomalies} disabled={anomalyLoading}
              style={{ ...styles.featureBtn, background: '#A4262C' }}>
              {anomalyLoading ? <><div style={styles.btnSpinner} /> Analyzing Root Causes...</> : <><FiAlertTriangle size={16} /> Explain All Anomalies</>}
            </button>
          </>
        )}
      </div>

      {/* ============ 15 ADVANCED RAG FEATURES ============ */}

      {/* 1. Conversational RAG */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #1B5E20' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#1B5E2014', color: '#1B5E20' }}>
            <FiBookOpen size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Conversational RAG</h3>
            <p style={styles.featureDesc}>Ask questions grounded in your actual documents and KB articles instead of pure LLM generation.</p>
          </div>
        </div>
        {cragHistory.length > 0 && (
          <div style={{ maxHeight: 350, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cragHistory.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? styles.chatUser : styles.chatAI}>
                {msg.role === 'user' ? <div style={styles.chatUserBubble}>{msg.content}</div> : <AIOutputDisplay content={msg.content} />}
              </div>
            ))}
            {cragLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: '#6A767D' }}><div style={styles.btnSpinner} /> Searching knowledge base...</div>}
          </div>
        )}
        {cragSources.length > 0 && (
          <div style={{ marginBottom: 12, padding: 12, background: '#F0FFF0', borderRadius: 8, border: '1px solid #C8E6C9' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1B5E20', marginBottom: 6 }}>Sources Used ({cragSources.length})</div>
            {cragSources.map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>
                [{s.id}] <strong>{s.source_type}</strong> — {s.chunk.substring(0, 120)}... ({(s.similarity * 100).toFixed(0)}%)
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
          {[
            'How do I get started with S/4HANA?',
            'How to integrate SuccessFactors with HR systems?',
            'Best practices for Ariba procurement?',
            'How to set up expense policies in Concur?',
          ].map(s => (
            <button key={s} onClick={() => setCragInput(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#1B5E20', background:'#1B5E2014', border:'1px solid #1B5E2040', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={styles.chatInputRow}>
          <input type="text" value={cragInput} onChange={e => setCragInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCragSend(); }}
            placeholder="Ask a question grounded in your documents..." style={styles.chatInput} />
          <button onClick={handleCragSend} disabled={!cragInput.trim() || cragLoading}
            style={{ ...styles.chatSendBtn, background: '#1B5E20' }}><FiSend size={18} /></button>
        </div>
      </div>

      {/* 2. AI Approval Routing */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #4527A0' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#4527A014', color: '#4527A0' }}>
            <FiCheckCircle size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Approval Routing</h3>
            <p style={styles.featureDesc}>Auto-suggest approval chains based on historical patterns, document type, and org structure.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Module</label>
            <select value={arForm.module} onChange={e => setArForm({ ...arForm, module: e.target.value })} style={styles.formInput}>
              <option value="orders">Orders</option><option value="purchase_orders">Purchase Orders</option>
              <option value="contracts">Contracts</option><option value="invoices">Invoices</option>
              <option value="projects">Projects</option><option value="expense_reports">Expense Reports</option>
            </select>
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Amount</label>
            <input type="text" value={arForm.amount} onChange={e => setArForm({ ...arForm, amount: e.target.value })} placeholder="e.g., 50000" style={styles.formInput} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Department</label>
            <input type="text" value={arForm.department} onChange={e => setArForm({ ...arForm, department: e.target.value })} placeholder="e.g., Sales" style={styles.formInput} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Record Type</label>
            <input type="text" value={arForm.recordType} onChange={e => setArForm({ ...arForm, recordType: e.target.value })} placeholder="e.g., Capital Expense" style={styles.formInput} />
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'Large PO $250K', v: { module:'purchase_orders', amount:'250000', department:'Procurement', recordType:'Capital Equipment' } },
            { label: 'Sales Order $50K', v: { module:'orders', amount:'50000', department:'Sales', recordType:'Standard Order' } },
            { label: 'Expense Report $8K', v: { module:'expense_reports', amount:'8000', department:'Marketing', recordType:'Travel Expense' } },
          ].map(s => (
            <button key={s.label} onClick={() => setArForm(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#4527A0', background:'#4527A014', border:'1px solid #4527A040', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleApprovalRouting} disabled={arLoading} style={{ ...styles.featureBtn, background: '#4527A0' }}>
          {arLoading ? <><div style={styles.btnSpinner} /> Analyzing Patterns...</> : <><FiCheckCircle size={16} /> Suggest Approval Chain</>}
        </button>
      </div>

      {/* 3. Predictive Inventory */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #00695C' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#00695C14', color: '#00695C' }}>
            <FiBox size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Predictive Inventory</h3>
            <p style={styles.featureDesc}>Forecast stock needs from order/delivery history and detect seasonal patterns.</p>
          </div>
        </div>
        <button onClick={handlePredictiveInventory} disabled={piLoading} style={{ ...styles.featureBtn, background: '#00695C' }}>
          {piLoading ? <><div style={styles.btnSpinner} /> Forecasting...</> : <><FiBox size={16} /> Generate Inventory Forecast</>}
        </button>
      </div>

      {/* 4. Contract Clause Analysis */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #BF360C' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#BF360C14', color: '#BF360C' }}>
            <FiFileText size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Contract Clause Analysis</h3>
            <p style={styles.featureDesc}>RAG over uploaded contracts — extract key terms, risks, and obligations.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Contract ID (optional)</label>
            <input type="text" value={ccForm.contractId} onChange={e => setCcForm({ ...ccForm, contractId: e.target.value })} placeholder="e.g., 1" style={styles.formInput} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Or paste contract text</label>
            <textarea value={ccForm.contractText} onChange={e => setCcForm({ ...ccForm, contractText: e.target.value })} placeholder="Paste contract clauses here..." style={{ ...styles.formInput, minHeight: 60, fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'SLA Contract', v: { contractId:'', contractText:'This Service Level Agreement ("SLA") is entered into by and between the parties. The Provider guarantees 99.9% uptime for all production systems measured on a monthly basis. Downtime excludes scheduled maintenance windows (Saturdays 2-6 AM UTC). Credits: 10% for <99.9%, 25% for <99.5%, 50% for <99.0%. Provider shall notify Customer within 15 minutes of any unplanned outage via email and status page.' } },
            { label: 'NDA Agreement', v: { contractId:'', contractText:'Non-Disclosure Agreement: The Receiving Party agrees to hold all Confidential Information in strict confidence for a period of 3 years from disclosure. Confidential Information includes trade secrets, customer lists, pricing strategies, technical specifications, and business plans. The Receiving Party shall not disclose to third parties without prior written consent. Exceptions: information that becomes public through no fault of Receiving Party.' } },
            { label: 'License Terms', v: { contractId:'', contractText:'Software License Agreement: Licensor grants Licensee a perpetual, non-exclusive license to use the Software. License covers up to 500 named users. Annual maintenance fee: 20% of license cost, includes updates and patches. Licensee may not sublicense, reverse engineer, or modify the Software. Warranty: 90 days from delivery. Liability cap: total fees paid in the 12 months preceding the claim.' } },
          ].map(s => (
            <button key={s.label} onClick={() => setCcForm(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#BF360C', background:'#BF360C14', border:'1px solid #BF360C40', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleContractAnalysis} disabled={ccLoading || (!ccForm.contractId && !ccForm.contractText)} style={{ ...styles.featureBtn, background: '#BF360C' }}>
          {ccLoading ? <><div style={styles.btnSpinner} /> Analyzing Clauses...</> : <><FiFileText size={16} /> Analyze Contract</>}
        </button>
      </div>

      {/* 5. Intelligent Matching */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #0D47A1' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#0D47A114', color: '#0D47A1' }}>
            <FiLink size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Intelligent Matching</h3>
            <p style={styles.featureDesc}>Auto-match POs to invoices to goods receipts using embedding similarity for 3-way matching.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Document Type</label>
            <select value={imForm.documentType} onChange={e => setImForm({ ...imForm, documentType: e.target.value })} style={styles.formInput}>
              <option value="purchase_orders">Purchase Order</option>
              <option value="invoices">Invoice</option>
              <option value="goods_receipts">Goods Receipt</option>
            </select>
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Document ID</label>
            <input type="text" value={imForm.documentId} onChange={e => setImForm({ ...imForm, documentId: e.target.value })} placeholder="e.g., 1" style={styles.formInput} />
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'PO #1', v: { documentType:'purchase_orders', documentId:'1' } },
            { label: 'Invoice #1', v: { documentType:'invoices', documentId:'1' } },
            { label: 'GR #1', v: { documentType:'goods_receipts', documentId:'1' } },
          ].map(s => (
            <button key={s.label} onClick={() => setImForm(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#0D47A1', background:'#0D47A114', border:'1px solid #0D47A140', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleIntelligentMatching} disabled={imLoading || !imForm.documentId} style={{ ...styles.featureBtn, background: '#0D47A1' }}>
          {imLoading ? <><div style={styles.btnSpinner} /> Matching...</> : <><FiLink size={16} /> Find Matches</>}
        </button>
      </div>

      {/* 6. Natural Language Reporting */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #F57F17' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#F57F1714', color: '#F57F17' }}>
            <FiPieChart size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Natural Language Reporting</h3>
            <p style={styles.featureDesc}>"Show me revenue by region last quarter" — auto-generates SQL, executes it, and shows results.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="text" value={nlQuery} onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleNlReporting(); }}
            placeholder='e.g., "Show me top 10 accounts by revenue" or "Count tickets by status"' style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleNlReporting} disabled={nlLoading || !nlQuery.trim()} style={{ ...styles.featureBtn, background: '#F57F17' }}>
            {nlLoading ? <><div style={styles.btnSpinner} /> Querying...</> : <><FiPieChart size={16} /> Run Report</>}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {[
            'Top 10 accounts by revenue',
            'Count tickets by status',
            'Average deal size by region',
            'Open opportunities over $50K',
          ].map(s => (
            <button key={s} onClick={() => setNlQuery(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#F57F17', background:'#F57F1714', border:'1px solid #F57F1740', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 7. AI Data Quality */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #C62828' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#C6282814', color: '#C62828' }}>
            <FiClipboard size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Data Quality</h3>
            <p style={styles.featureDesc}>Detect missing fields, inconsistencies, stale records, and duplicates across all modules.</p>
          </div>
        </div>
        <button onClick={handleDataQuality} disabled={dqLoading} style={{ ...styles.featureBtn, background: '#C62828' }}>
          {dqLoading ? <><div style={styles.btnSpinner} /> Scanning All Modules...</> : <><FiClipboard size={16} /> Run Data Quality Scan</>}
        </button>
      </div>

      {/* 8. Vendor Risk Scoring */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #AD1457' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#AD145714', color: '#AD1457' }}>
            <FiStar size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Vendor Risk Scoring</h3>
            <p style={styles.featureDesc}>Analyze vendor performance data and external signals to assess supply chain risk.</p>
          </div>
        </div>
        <button onClick={handleVendorRisk} disabled={vrLoading} style={{ ...styles.featureBtn, background: '#AD1457' }}>
          {vrLoading ? <><div style={styles.btnSpinner} /> Scoring Vendors...</> : <><FiStar size={16} /> Assess Vendor Risk</>}
        </button>
      </div>

      {/* 9. Multi-doc RAG Q&A */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #283593' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#28359314', color: '#283593' }}>
            <FiBookOpen size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Multi-doc RAG Q&A</h3>
            <p style={styles.featureDesc}>Ask questions across multiple uploaded PDFs and documents simultaneously.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="text" value={mdQuestion} onChange={e => setMdQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleMultiDocQA(); }}
            placeholder="Ask a question across all your uploaded documents..." style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleMultiDocQA} disabled={mdLoading || !mdQuestion.trim()} style={{ ...styles.featureBtn, background: '#283593' }}>
            {mdLoading ? <><div style={styles.btnSpinner} /> Searching...</> : <><FiSearch size={16} /> Ask Documents</>}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {[
            'How to design dashboards in Analytics Cloud?',
            'What are the top AI use cases for enterprise?',
            'How to do demand planning with IBP?',
          ].map(s => (
            <button key={s} onClick={() => setMdQuestion(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#283593', background:'#28359314', border:'1px solid #28359340', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 10. AI Change Impact Analysis */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #E65100' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#E6510014', color: '#E65100' }}>
            <FiRefreshCw size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Change Impact Analysis</h3>
            <p style={styles.featureDesc}>Before org reassignment or config change, predict downstream effects on related modules.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Change Type</label>
            <select value={ciForm.changeType} onChange={e => setCiForm({ ...ciForm, changeType: e.target.value })} style={styles.formInput}>
              <option value="Data Migration">Data Migration</option><option value="Org Restructure">Org Restructure</option>
              <option value="Module Config">Module Configuration</option><option value="User Role Change">User/Role Change</option>
              <option value="Field Removal">Field Removal</option><option value="Workflow Change">Workflow Change</option>
            </select>
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Affected Module</label>
            <input type="text" value={ciForm.module} onChange={e => setCiForm({ ...ciForm, module: e.target.value })} placeholder="e.g., accounts" style={styles.formInput} />
          </div>
        </div>
        <div style={{ ...styles.formField, marginBottom: 12 }}>
          <label style={styles.formLabel}>Describe the change</label>
          <textarea value={ciForm.description} onChange={e => setCiForm({ ...ciForm, description: e.target.value })}
            placeholder="e.g., Merging two sales territories and reassigning all opportunities..." style={{ ...styles.formInput, minHeight: 60, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'Territory Merge', v: { changeType:'Org Restructure', module:'accounts', description:'Merging EMEA North and EMEA South territories, reassigning 200+ accounts and all open opportunities to new territory owners' } },
            { label: 'Field Removal', v: { changeType:'Field Removal', module:'leads', description:'Removing deprecated lead_source_detail field used by 3 workflow rules and 2 report filters' } },
            { label: 'Role Change', v: { changeType:'User Role Change', module:'', description:'Changing 15 sales reps from Standard User to Power User role, granting access to pricing and discount approval' } },
          ].map(s => (
            <button key={s.label} onClick={() => setCiForm(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#E65100', background:'#E6510014', border:'1px solid #E6510040', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleChangeImpact} disabled={ciLoading || !ciForm.description} style={{ ...styles.featureBtn, background: '#E65100' }}>
          {ciLoading ? <><div style={styles.btnSpinner} /> Analyzing Impact...</> : <><FiRefreshCw size={16} /> Analyze Impact</>}
        </button>
      </div>

      {/* 11. Email-to-Record */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #00838F' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#00838F14', color: '#00838F' }}>
            <FiMail size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Email-to-Record</h3>
            <p style={styles.featureDesc}>Paste an incoming email — AI will parse it and auto-extract fields to create tickets, orders, or activities.</p>
          </div>
        </div>
        <div style={{ ...styles.formField, marginBottom: 12 }}>
          <label style={styles.formLabel}>Paste email content</label>
          <textarea value={etEmail} onChange={e => setEtEmail(e.target.value)}
            placeholder={'From: john@acme.com\nSubject: Urgent: Server down\n\nHi, our production server has been down since 2pm...'}
            style={{ ...styles.formInput, minHeight: 100, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'Urgent Support', v: 'From: john.mueller@basf.com\nSubject: URGENT: Production system down since 2pm\n\nHi Support Team,\n\nOur SAP production environment has been unresponsive since 2:00 PM CET today. All 500 users are affected. We need immediate P1 support.\n\nError: Connection timeout on app server AS01\nSystem: PRD 400\nImpact: Complete business standstill\n\nPlease escalate immediately.\n\nBest regards,\nJohn Mueller\nIT Director, BASF SE\n+49 621 60-0' },
            { label: 'New Order Request', v: 'From: procurement@siemens.com\nSubject: PO Request - Cloud Analytics Suite\n\nHello,\n\nWe would like to place an order for 50 licenses of Cloud Analytics Suite Enterprise Edition.\n\nDelivery: Q1 2026\nBudget: EUR 125,000\nBilling: Annual subscription\nContact: Maria Schmidt, Procurement\n\nPlease send us a formal quote.\n\nRegards,\nSiemens Procurement' },
            { label: 'Meeting Follow-up', v: 'From: anna.weber@bmw.com\nSubject: Follow-up: Quarterly Business Review\n\nHi Team,\n\nThank you for the QBR yesterday. Key action items:\n1. Renew support contract by March 15\n2. Schedule upgrade assessment for S/4HANA\n3. Send updated pricing for additional 200 user licenses\n\nNext meeting: April 10, 2026\n\nBest,\nAnna Weber\nVP Technology, BMW Group' },
          ].map(s => (
            <button key={s.label} onClick={() => setEtEmail(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#00838F', background:'#00838F14', border:'1px solid #00838F40', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleEmailToRecord} disabled={etLoading || !etEmail.trim()} style={{ ...styles.featureBtn, background: '#00838F' }}>
          {etLoading ? <><div style={styles.btnSpinner} /> Parsing Email...</> : <><FiMail size={16} /> Parse & Extract</>}
        </button>
      </div>

      {/* 12. AI Pricing Optimizer */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #2E7D32' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#2E7D3214', color: '#2E7D32' }}>
            <FiDollarSign size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Pricing Optimizer</h3>
            <p style={styles.featureDesc}>Suggest optimal pricing conditions based on historical win rates and deal analysis.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Product (optional)</label>
            <input type="text" value={poForm.productName} onChange={e => setPoForm({ ...poForm, productName: e.target.value })} placeholder="e.g., Cloud Analytics Suite" style={styles.formInput} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Account (optional)</label>
            <input type="text" value={poForm.accountName} onChange={e => setPoForm({ ...poForm, accountName: e.target.value })} placeholder="e.g., BASF" style={styles.formInput} />
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'Cloud Analytics for BASF', v: { productName:'Cloud Analytics Suite', accountName:'BASF' } },
            { label: 'ERP Licenses for Siemens', v: { productName:'S/4HANA Enterprise License', accountName:'Siemens' } },
            { label: 'Integration Suite for BMW', v: { productName:'Integration Suite Premium', accountName:'BMW' } },
          ].map(s => (
            <button key={s.label} onClick={() => setPoForm(s.v)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#2E7D32', background:'#2E7D3214', border:'1px solid #2E7D3240', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handlePricingOptimizer} disabled={poLoading} style={{ ...styles.featureBtn, background: '#2E7D32' }}>
          {poLoading ? <><div style={styles.btnSpinner} /> Optimizing Prices...</> : <><FiDollarSign size={16} /> Optimize Pricing</>}
        </button>
      </div>

      {/* 13. Batch Demand Forecasting */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #4E342E' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#4E342E14', color: '#4E342E' }}>
            <FiLayers size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Batch Demand Forecasting</h3>
            <p style={styles.featureDesc}>Predict batch consumption to optimize FIFO/FEFO strategies and reduce waste.</p>
          </div>
        </div>
        <button onClick={handleBatchDemand} disabled={bdLoading} style={{ ...styles.featureBtn, background: '#4E342E' }}>
          {bdLoading ? <><div style={styles.btnSpinner} /> Forecasting Batches...</> : <><FiLayers size={16} /> Forecast Batch Demand</>}
        </button>
      </div>

      {/* 14. Multi-language Support */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #1565C0' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#1565C014', color: '#1565C0' }}>
            <FiGlobe size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>Multi-language Support</h3>
            <p style={styles.featureDesc}>Translate any AI output to your preferred language while preserving formatting.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Text to translate</label>
            <textarea value={tlText} onChange={e => setTlText(e.target.value)} placeholder="Paste any AI output or text here..." style={{ ...styles.formInput, minHeight: 80, fontFamily: 'inherit' }} />
          </div>
          <div style={styles.formField}>
            <label style={styles.formLabel}>Target Language</label>
            <select value={tlLang} onChange={e => setTlLang(e.target.value)} style={styles.formInput}>
              <option>German</option><option>French</option><option>Spanish</option><option>Portuguese</option>
              <option>Italian</option><option>Dutch</option><option>Japanese</option><option>Chinese</option>
              <option>Korean</option><option>Arabic</option><option>Turkish</option><option>Hindi</option>
              <option>Russian</option><option>Polish</option><option>Swedish</option>
            </select>
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {[
            { label: 'Sales Report \u2192 German', text:'Q4 revenue exceeded targets by 15%. Top performing regions include EMEA North (+22%) and APAC (+18%). Key wins: BASF renewal ($2.1M), Siemens expansion ($1.8M). Pipeline for Q1 remains strong at $45M.', lang:'German' },
            { label: 'Support Update \u2192 French', text:'Critical incident resolved. Root cause: database connection pool exhaustion during peak load. Fix deployed: connection pool size increased from 100 to 250. Monitoring confirms stable performance.', lang:'French' },
            { label: 'Product Brief \u2192 Japanese', text:'Introducing our next-generation AI-powered analytics platform. Features include real-time dashboards, predictive forecasting, and natural language reporting. Available Q2 2026.', lang:'Japanese' },
          ].map(s => (
            <button key={s.label} onClick={() => { setTlText(s.text); setTlLang(s.lang); }}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#1565C0', background:'#1565C014', border:'1px solid #1565C040', borderRadius:16, cursor:'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={handleTranslate} disabled={tlLoading || !tlText.trim()} style={{ ...styles.featureBtn, background: '#1565C0' }}>
          {tlLoading ? <><div style={styles.btnSpinner} /> Translating...</> : <><FiGlobe size={16} /> Translate</>}
        </button>
      </div>

      {/* 15. RAG with Citations */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #37474F' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#37474F14', color: '#37474F' }}>
            <FiBookmark size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>RAG with Citations</h3>
            <p style={styles.featureDesc}>Get AI answers with exact source document/chunk citations backing every claim.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="text" value={rcQuestion} onChange={e => setRcQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRagCitations(); }}
            placeholder="Ask anything — every answer will cite its sources..." style={{ ...styles.formInput, flex: 1 }} />
          <button onClick={handleRagCitations} disabled={rcLoading || !rcQuestion.trim()} style={{ ...styles.featureBtn, background: '#37474F' }}>
            {rcLoading ? <><div style={styles.btnSpinner} /> Citing...</> : <><FiBookmark size={16} /> Ask with Citations</>}
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {[
            'How to build low-code apps with SAP Build?',
            'What is Signavio process mining?',
            'How to set up ESG reporting with Green Ledger?',
          ].map(s => (
            <button key={s} onClick={() => setRcQuestion(s)}
              style={{ padding:'6px 12px', fontSize:12, fontWeight:500, color:'#37474F', background:'#37474F14', border:'1px solid #37474F40', borderRadius:16, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* AI Copilot Chat */}
      <div style={{ ...styles.fullCard, borderTop: '3px solid #354A5F' }}>
        <div style={styles.fullCardHeader}>
          <div style={{ ...styles.featureIcon, background: '#354A5F14', color: '#354A5F' }}>
            <FiMessageSquare size={24} />
          </div>
          <div>
            <h3 style={styles.featureTitle}>AI Copilot Chat</h3>
            <p style={styles.featureDesc}>Ask questions about your business data and get intelligent AI-powered answers.</p>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div style={styles.chipRow}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setChatInput(s); }}
              style={styles.chip}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div style={styles.chatHistory}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? styles.chatUser : styles.chatAI}>
                {msg.role === 'user' ? (
                  <div style={styles.chatUserBubble}>{msg.content}</div>
                ) : (
                  <AIOutputDisplay content={msg.content} />
                )}
              </div>
            ))}
            {loadingKey === 'copilot' && (
              <div style={styles.chatAI}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: '#6A767D' }}>
                  <div style={styles.btnSpinner} />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Input */}
        <div style={styles.chatInputRow}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCopilotSend(); }}
            placeholder="Ask me anything about your business data..."
            style={styles.chatInput}
          />
          <button
            onClick={handleCopilotSend}
            disabled={!chatInput.trim() || loadingKey === 'copilot'}
            style={styles.chatSendBtn}
          >
            <FiSend size={18} />
          </button>
        </div>
      </div>

      {/* AI Result Modal */}
      <AIResultModal title={modalTitle} content={modalContent} extras={modalExtras} onClose={closeModal} />
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
    gap: 16,
    marginBottom: 28,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #0070F2 0%, #8B47D7 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: '#1D2D3E',
  },
  headerSub: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#6A767D',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
    marginBottom: 24,
  },
  featureCard: {
    background: '#fff',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #E8EBF0',
    display: 'flex',
    flexDirection: 'column',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    flexShrink: 0,
  },
  featureTitle: {
    margin: '0 0 8px',
    fontSize: 17,
    fontWeight: 600,
    color: '#1D2D3E',
  },
  featureDesc: {
    margin: '0 0 18px',
    fontSize: 13,
    color: '#6A767D',
    lineHeight: 1.5,
    flex: 1,
  },
  featureBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    alignSelf: 'flex-start',
  },
  btnSpinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  fullCard: {
    background: '#fff',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #E8EBF0',
    marginBottom: 24,
  },
  fullCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  contentForm: {},
  contentFormGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  formField: {},
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
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#0070F2',
    background: '#E8F4FD',
    border: '1px solid #B8D8F8',
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  chatHistory: {
    maxHeight: 400,
    overflowY: 'auto',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  chatUser: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  chatUserBubble: {
    background: '#0070F2',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '16px 16px 4px 16px',
    maxWidth: '70%',
    fontSize: 14,
    lineHeight: 1.5,
  },
  chatAI: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  chatInputRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 10,
    outline: 'none',
    background: '#F7F8FA',
    boxSizing: 'border-box',
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: '#0070F2',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

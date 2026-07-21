import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { modules, sidebarGroups, moduleList } from './modules';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ModulePage from './pages/ModulePage';
import DetailPage from './pages/DetailPage';
import AIInsights from './pages/AIInsights';
import AIStudio from './pages/AIStudio';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Calendar from './pages/Calendar';
import Approvals from './pages/Approvals';
import ApprovalExposure from './pages/ApprovalExposure';
import SAPControls from './pages/SAPControls';
import SAPProcessHub from './pages/SAPProcessHub';
import SAPConfigurationHub from './pages/SAPConfigurationHub';
import SAPWorkflowInbox from './pages/SAPWorkflowInbox';
import SAPAuthorizationCenter from './pages/SAPAuthorizationCenter';
import SAPFinanceLedger from './pages/SAPFinanceLedger';
import SAPProductionPlanning from './pages/SAPProductionPlanning';
import SAPSalesDistribution from './pages/SAPSalesDistribution';
import SAPInventoryWarehouse from './pages/SAPInventoryWarehouse';
import { callAI } from './api';
import { FiGrid, FiCpu, FiLogOut, FiMenu, FiX, FiChevronDown, FiChevronRight, FiUser, FiSearch, FiSettings, FiBarChart2, FiCalendar, FiCheckSquare, FiShield, FiGitBranch } from 'react-icons/fi';


const sampleSearches = [
  'Show all overdue invoices over $10,000',
  'Find opportunities closing this month',
  'List high priority open tickets',
  'Accounts with revenue above $1M',
];

function GlobalSearch({ navigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowSuggestions(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setAiResults(null); return; }
    const matches = moduleList.filter(m =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.description.toLowerCase().includes(query.toLowerCase()) ||
      m.key.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
    setResults(matches);
    setOpen(matches.length > 0 || aiLoading || aiResults);
  }, [query]);

  const triggerAiSearch = async (searchQuery) => {
    setAiLoading(true);
    setAiResults(null);
    setShowSuggestions(false);
    setOpen(true);
    try {
      const res = await callAI('smart-search', { query: searchQuery });
      setAiResults(res);
    } catch { setAiResults(null); }
    setAiLoading(false);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && query.trim().length >= 3) {
      triggerAiSearch(query.trim());
    }
  };

  const getRecordLabel = (r) => r.name || r.title || r.subject || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null) || r.invoice_number || r.order_number || r.ticket_number || `ID: ${r.id}`;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div className="global-search">
        <FiSearch size={14} />
        <input
          type="text"
          placeholder="Search modules... (Enter for AI search)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query && (results.length > 0 || aiResults)) setOpen(true); if (!query.trim()) setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {showSuggestions && !query.trim() && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:1000, marginTop:4, overflow:'hidden' }}>
          <div style={{ padding:'6px 14px', fontSize:11, fontWeight:600, color:'#8B47D7', textTransform:'uppercase', letterSpacing:'0.3px', background:'#F8F5FF', borderBottom:'1px solid #E8EBF0' }}>
            Try AI Search
          </div>
          {sampleSearches.map((s, i) => (
            <div key={i} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', borderBottom:'1px solid #f0f2f5', fontSize:13, color:'#354A5F' }}
              onMouseEnter={(e) => e.currentTarget.style.background='#f5f8ff'}
              onMouseLeave={(e) => e.currentTarget.style.background='#fff'}
              onClick={() => { setQuery(s); setShowSuggestions(false); triggerAiSearch(s); }}>
              <FiCpu size={12} style={{ marginRight:8, color:'#8B47D7', flexShrink:0 }} />
              {s}
            </div>
          ))}
        </div>
      )}
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:1000, marginTop:4, overflow:'hidden', maxHeight:420, overflowY:'auto' }}>
          {results.length > 0 && (
            <div style={{ padding:'6px 14px', fontSize:11, fontWeight:600, color:'#6A767D', textTransform:'uppercase', letterSpacing:'0.3px', background:'#FAFBFC', borderBottom:'1px solid #E8EBF0' }}>Modules</div>
          )}
          {results.map(m => {
            const Icon = m.icon;
            return (
              <div key={m.key} style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderBottom:'1px solid #f0f2f5' }}
                onClick={() => { navigate(`/${m.key}`); setQuery(''); setOpen(false); setAiResults(null); }}
                onMouseEnter={(e) => e.currentTarget.style.background='#f5f8ff'}
                onMouseLeave={(e) => e.currentTarget.style.background='#fff'}>
                <Icon size={16} style={{ color: m.color }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1D2D3E' }}>{m.name}</div>
                  <div style={{ fontSize:11, color:'#6A767D' }}>{m.description}</div>
                </div>
              </div>
            );
          })}
          {aiLoading && (
            <div style={{ padding:'14px', textAlign:'center', color:'#6A767D', fontSize:13 }}>
              <FiCpu size={14} style={{ marginRight:6, animation:'spin 1s linear infinite' }} />
              AI searching...
            </div>
          )}
          {aiResults && !aiLoading && (
            <>
              <div style={{ padding:'6px 14px', fontSize:11, fontWeight:600, color:'#8B47D7', textTransform:'uppercase', letterSpacing:'0.3px', background:'#F8F5FF', borderBottom:'1px solid #E8EBF0', borderTop:'1px solid #E8EBF0' }}>
                <FiCpu size={10} style={{ marginRight:4 }} />
                AI Results {aiResults.table && `\u2014 ${aiResults.table}`}
              </div>
              {aiResults.interpretation && (
                <div style={{ padding:'8px 14px', fontSize:12, color:'#6A767D', fontStyle:'italic', borderBottom:'1px solid #f0f2f5' }}>{aiResults.interpretation}</div>
              )}
              {(aiResults.results || []).slice(0, 8).map((r, i) => (
                <div key={i} style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderBottom:'1px solid #f0f2f5' }}
                  onClick={() => { navigate(`/${aiResults.table}`); setQuery(''); setOpen(false); setAiResults(null); }}
                  onMouseEnter={(e) => e.currentTarget.style.background='#f5f8ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background='#fff'}>
                  <div style={{ width:28, height:28, borderRadius:6, background:'#F8F5FF', color:'#8B47D7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{i + 1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1D2D3E', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getRecordLabel(r)}</div>
                    <div style={{ fontSize:11, color:'#6A767D' }}>
                      {r.status && <span style={{ marginRight:8 }}>{r.status}</span>}
                      {r.amount && <span>${Number(r.amount).toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {(aiResults.results || []).length === 0 && (
                <div style={{ padding:'14px', textAlign:'center', color:'#A0AAB4', fontSize:13 }}>No results found</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({
    'SD - Sales': true, 'CS - Service': true, 'Marketing': true, 'Products': true,
    'FI - Financial Accounting': true, 'CO - Controlling': false, 'MM - Materials Mgmt': false,
    'PP - Production': false, 'PM - Plant Maintenance': false, 'QM - Quality': false,
    'WM - Warehouse': false, 'Ariba - Procurement': false, 'HCM - Human Capital': true,
    'Concur - Travel': false, 'IBP - Planning': false, 'Operations': true, 'System': false,
  });
  const location = useLocation();
  const navigate = useNavigate();

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname === `/${path}` ||
    location.pathname.startsWith(`/${path}/`);

  return (
    <div className="app-layout">
      <header className="top-bar">
        <div className="top-bar-left">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <div className="brand" onClick={() => navigate('/dashboard')}>
            <svg width="48" height="24" viewBox="0 0 80 40">
              <rect width="80" height="40" rx="4" fill="#0070F2"/>
              <text x="40" y="26" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="20" fill="white">SAP</text>
            </svg>
            <span className="brand-text">CRM</span>
          </div>
        </div>
        <div className="top-bar-center">
          <GlobalSearch navigate={navigate} />
        </div>
        <div className="top-bar-right">
          <div className="user-menu">
            <div className="user-avatar"><FiUser size={16} /></div>
            <span className="user-name">{user?.full_name}</span>
            <button className="btn-logout" onClick={onLogout} title="Sign Out">
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="main-container">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            <Link to="/dashboard" className={`sidebar-item ${isActive('/dashboard') ? 'active' : ''}`}>
              <FiGrid size={18} />
              <span>Dashboard</span>
            </Link>

            {sidebarGroups.map(group => (
              <div key={group.label} className="sidebar-group">
                <button className="sidebar-group-header" onClick={() => toggleGroup(group.label)}>
                  {expandedGroups[group.label] ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <span>{group.label}</span>
                </button>
                {expandedGroups[group.label] && (
                  <div className="sidebar-group-items">
                    {group.items.map(key => {
                      const mod = modules[key];
                      if (!mod) return null;
                      const Icon = mod.icon;
                      return (
                        <Link
                          key={key}
                          to={`/${key}`}
                          className={`sidebar-item ${isActive(key) ? 'active' : ''}`}
                        >
                          <Icon size={16} />
                          <span>{mod.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="sidebar-divider"></div>
            <Link to="/calendar" className={`sidebar-item ${isActive('/calendar') ? 'active' : ''}`}>
              <FiCalendar size={18} />
              <span>Calendar</span>
            </Link>
            <Link to="/reports" className={`sidebar-item ${isActive('/reports') ? 'active' : ''}`}>
              <FiBarChart2 size={18} />
              <span>Reports</span>
            </Link>
            <Link to="/approvals" className={`sidebar-item ${isActive('/approvals') ? 'active' : ''}`}>
              <FiCheckSquare size={18} />
              <span>Approvals</span>
            </Link>
            <Link to="/approval-exposure" className={`sidebar-item ${isActive('/approval-exposure') ? 'active' : ''}`}>
              <FiCheckSquare size={18} />
              <span>Approval Exposure</span>
            </Link>
            <Link to="/sap-controls" className={`sidebar-item ${isActive('/sap-controls') ? 'active' : ''}`}>
              <FiShield size={18} />
              <span>SAP Controls</span>
            </Link>
            <Link to="/sap-process-hub" className={`sidebar-item ${isActive('/sap-process-hub') ? 'active' : ''}`}>
              <FiGitBranch size={18} />
              <span>SAP Process Hub</span>
            </Link>
            <Link to="/sap-configuration" className={`sidebar-item ${isActive('/sap-configuration') ? 'active' : ''}`}>
              <FiSettings size={18} />
              <span>SAP Configuration</span>
            </Link>
            <Link to="/sap-workflow" className={`sidebar-item ${isActive('/sap-workflow') ? 'active' : ''}`}>
              <FiCheckSquare size={18} />
              <span>SAP Workflow Inbox</span>
            </Link>
            <Link to="/sap-authorization" className={`sidebar-item ${isActive('/sap-authorization') ? 'active' : ''}`}>
              <FiShield size={18} />
              <span>SAP Authorization</span>
            </Link>
            <Link to="/sap-finance-ledger" className={`sidebar-item ${isActive('/sap-finance-ledger') ? 'active' : ''}`}>
              <FiBarChart2 size={18} />
              <span>SAP Finance Ledger</span>
            </Link>
            <Link to="/sap-production-planning" className={`sidebar-item ${isActive('/sap-production-planning') ? 'active' : ''}`}>
              <FiGitBranch size={18} />
              <span>SAP Production Planning</span>
            </Link>
            <Link to="/sap-sales-distribution" className={`sidebar-item ${isActive('/sap-sales-distribution') ? 'active' : ''}`}>
              <FiBarChart2 size={18} />
              <span>SAP SD Pricing</span>
            </Link>
            <Link to="/sap-inventory-warehouse" className={`sidebar-item ${isActive('/sap-inventory-warehouse') ? 'active' : ''}`}>
              <FiGrid size={18} />
              <span>SAP Inventory</span>
            </Link>
            <Link to="/custom-views" className={`sidebar-item ${isActive('/custom-views') ? 'active' : ''}`}>
              <FiGrid size={18} />
              <span>SAP Views</span>
            </Link>
            <Link to="/ai-insights" className={`sidebar-item ai-sidebar-item ${isActive('/ai-insights') ? 'active' : ''}`}>
              <FiCpu size={18} />
              <span>AI Copilot</span>
            </Link>
            <Link to="/ai-studio" className={`sidebar-item ai-sidebar-item ${isActive('/ai-studio') ? 'active' : ''}`}>
              <FiCpu size={18} />
              <span>AI Studio</span>
            </Link>
            <div className="sidebar-divider"></div>
            <Link to="/settings" className={`sidebar-item ${isActive('/settings') ? 'active' : ''}`}>
              <FiSettings size={18} />
              <span>Settings</span>
            </Link>
          </nav>
        </aside>

        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-insights" element={<AIInsights />} />
        <Route path="/ai-studio" element={<AIStudio />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/approval-exposure" element={<ApprovalExposure />} />
        <Route path="/sap-controls" element={<SAPControls />} />
        <Route path="/sap-process-hub" element={<SAPProcessHub />} />
        <Route path="/sap-configuration" element={<SAPConfigurationHub />} />
        <Route path="/sap-workflow" element={<SAPWorkflowInbox />} />
        <Route path="/sap-authorization" element={<SAPAuthorizationCenter />} />
        <Route path="/sap-finance-ledger" element={<SAPFinanceLedger />} />
        <Route path="/sap-production-planning" element={<SAPProductionPlanning />} />
        <Route path="/sap-sales-distribution" element={<SAPSalesDistribution />} />
        <Route path="/sap-inventory-warehouse" element={<SAPInventoryWarehouse />} />
        <Route path="/:moduleKey" element={<ModulePage />} />
        <Route path="/:moduleKey/:id" element={<DetailPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

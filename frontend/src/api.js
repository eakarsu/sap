const API = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...getHeaders(), ...options.headers } });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }
  return res.json();
}

export const login = (email, password) =>
  request(`${API}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const fetchAll = (module, search = '') =>
  request(`${API}/${module}?search=${encodeURIComponent(search)}&limit=100&order=desc`);

export const fetchOne = (module, id) =>
  request(`${API}/${module}/${id}`);

export const createItem = (module, data) =>
  request(`${API}/${module}`, { method: 'POST', body: JSON.stringify(data) });

export const updateItem = (module, id, data) =>
  request(`${API}/${module}/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteItem = (module, id) =>
  request(`${API}/${module}/${id}`, { method: 'DELETE' });

export const fetchDashboard = () =>
  request(`${API}/dashboard/stats`);

export const callAI = (endpoint, body = {}) =>
  request(`${API}/ai/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });

export const globalSearch = (q) =>
  request(`${API}/search/global?q=${encodeURIComponent(q)}`);

export const fetchUsers = () =>
  request(`${API}/admin/users`);

export const createUser = (data) =>
  request(`${API}/admin/users`, { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (id, data) =>
  request(`${API}/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUser = (id) =>
  request(`${API}/admin/users/${id}`, { method: 'DELETE' });

export const fetchAnomalies = () =>
  request(`${API}/dashboard/anomalies`);

// RAG endpoints
export const embedKnowledgeBase = () =>
  request(`${API}/rag/embed-knowledge-base`, { method: 'POST' });

export const ragSearch = (query, sourceType) =>
  request(`${API}/rag/search`, { method: 'POST', body: JSON.stringify({ query, sourceType }) });

export const uploadDocument = async (file, title, category) => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (category) formData.append('category', category);
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}/rag/upload-document`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }
  return res.json();
};

export const fetchDocuments = () =>
  request(`${API}/rag/documents`);

export const deleteDocument = (id) =>
  request(`${API}/rag/documents/${id}`, { method: 'DELETE' });

// Enhanced AI endpoints
export const getCustomer360 = (accountName) =>
  request(`${API}/ai/customer-360`, { method: 'POST', body: JSON.stringify({ accountName }) });

export const getRecommendations = (accountName) =>
  request(`${API}/ai/recommendations`, { method: 'POST', body: JSON.stringify({ accountName }) });

export const getWorkflowSuggestions = () =>
  request(`${API}/ai/workflow-suggestions`, { method: 'POST' });

export const explainAnomalies = (anomalies) =>
  request(`${API}/ai/explain-anomalies`, { method: 'POST', body: JSON.stringify({ anomalies }) });

export const classifyTicket = (title, description) =>
  request(`${API}/ai/ticket-classify`, { method: 'POST', body: JSON.stringify({ title, description }) });

export const fetchDocumentFlow = (module, id) =>
  request(`${API}/document-flow/${module}/${id}`);

export const fetchEnhancedDashboard = () =>
  request(`${API}/dashboard/enhanced-stats`);

export const fetchAggregate = (table, groupBy, aggregate, valueField) =>
  request(`${API}/${table}/aggregate?groupBy=${groupBy}&aggregate=${aggregate}&valueField=${valueField || ''}`);

// Where-Used Lists
export const fetchWhereUsed = (module, id) =>
  request(`${API}/where-used/${module}/${id}`);

// Change History (with optional filters)
export const fetchChangeHistory = (module, id, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.user) params.set('user', filters.user);
  if (filters.field) params.set('field', filters.field);
  const qs = params.toString();
  return request(`${API}/${module}/${id}/history${qs ? '?' + qs : ''}`);
};

// Rollback a change
export const rollbackChange = (module, id, auditId) =>
  request(`${API}/${module}/${id}/rollback/${auditId}`, { method: 'POST' });

// Org Tree
export const fetchOrgTree = () =>
  request(`${API}/org-units/tree`);

// Org Assignment
export const orgAssign = (module, id, orgUpdates) =>
  request(`${API}/${module}/${id}/org-assign`, { method: 'PUT', body: JSON.stringify(orgUpdates) });

// Partner Functions
export const fetchPartnerFunctions = (module, id) =>
  request(`${API}/partner-functions/${module}/${id}`);

export const createPartnerFunction = (module, id, data) =>
  request(`${API}/partner-functions/${module}/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const deletePartnerFunction = (id) =>
  request(`${API}/partner-functions/${id}`, { method: 'DELETE' });

export const searchPartners = (q) =>
  request(`${API}/partner-functions/search?q=${encodeURIComponent(q)}`);

// Pricing Conditions
export const fetchPricingConditions = (module, id) =>
  request(`${API}/pricing-conditions/${module}/${id}`);

export const createPricingCondition = (module, id, data) =>
  request(`${API}/pricing-conditions/${module}/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const deletePricingCondition = (id) =>
  request(`${API}/pricing-conditions/${id}`, { method: 'DELETE' });

export const recalculatePricing = (module, id) =>
  request(`${API}/pricing-conditions/${module}/${id}/recalculate`, { method: 'POST' });

// Batches
export const fetchBatches = (module, id) =>
  request(`${API}/batches/${module}/${id}`);

export const createBatch = (module, id, data) =>
  request(`${API}/batches/${module}/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const deleteBatch = (id) =>
  request(`${API}/batches/${id}`, { method: 'DELETE' });

export const toggleBatchHold = (id, action) =>
  request(`${API}/batches/${id}/hold`, { method: 'PUT', body: JSON.stringify({ action }) });

// Config Chain (with optional direction)
export const fetchConfigChain = (module, id, direction = 'forward') =>
  request(`${API}/config-chain/${module}/${id}?direction=${direction}`);

// Approval Steps
export const fetchApprovalSteps = (module, id) =>
  request(`${API}/approval-steps/${module}/${id}`);

export const createApprovalStep = (module, id, data) =>
  request(`${API}/approval-steps/${module}/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const updateApprovalStep = (id, data) =>
  request(`${API}/approval-steps/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteApprovalStep = (id) =>
  request(`${API}/approval-steps/${id}`, { method: 'DELETE' });

export const recallApprovalStep = (id) =>
  request(`${API}/approval-steps/${id}/recall`, { method: 'POST' });

// Cross-Company Links
export const fetchCrossCompanyLinks = (module, id) =>
  request(`${API}/cross-company/${module}/${id}`);

export const createCrossCompanyLink = (module, id, data) =>
  request(`${API}/cross-company/${module}/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const deleteCrossCompanyLink = (id) =>
  request(`${API}/cross-company/${id}`, { method: 'DELETE' });

export const updateCrossCompanyStatus = (id, status) =>
  request(`${API}/cross-company/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });

// Advanced RAG AI Features
export const conversationalRag = (question, history) =>
  request(`${API}/ai/conversational-rag`, { method: 'POST', body: JSON.stringify({ question, history }) });

export const getApprovalRouting = (body) =>
  request(`${API}/ai/approval-routing`, { method: 'POST', body: JSON.stringify(body) });

export const getPredictiveInventory = () =>
  request(`${API}/ai/predictive-inventory`, { method: 'POST' });

export const getContractAnalysis = (body) =>
  request(`${API}/ai/contract-clause-analysis`, { method: 'POST', body: JSON.stringify(body) });

export const getIntelligentMatching = (documentType, documentId) =>
  request(`${API}/ai/intelligent-matching`, { method: 'POST', body: JSON.stringify({ documentType, documentId }) });

export const getNlReporting = (query) =>
  request(`${API}/ai/nl-reporting`, { method: 'POST', body: JSON.stringify({ query }) });

export const getDataQuality = () =>
  request(`${API}/ai/data-quality`, { method: 'POST' });

export const getVendorRisk = () =>
  request(`${API}/ai/vendor-risk`, { method: 'POST' });

export const multiDocQA = (question) =>
  request(`${API}/ai/multi-doc-qa`, { method: 'POST', body: JSON.stringify({ question }) });

export const getChangeImpact = (body) =>
  request(`${API}/ai/change-impact`, { method: 'POST', body: JSON.stringify(body) });

export const emailToRecord = (emailText, preferredModule) =>
  request(`${API}/ai/email-to-record`, { method: 'POST', body: JSON.stringify({ emailText, preferredModule }) });

export const getPricingOptimizer = (productName, accountName) =>
  request(`${API}/ai/pricing-optimizer`, { method: 'POST', body: JSON.stringify({ productName, accountName }) });

export const getBatchDemandForecast = () =>
  request(`${API}/ai/batch-demand-forecast`, { method: 'POST' });

export const translateAI = (text, targetLanguage) =>
  request(`${API}/ai/translate`, { method: 'POST', body: JSON.stringify({ text, targetLanguage }) });

export const ragWithCitations = (question) =>
  request(`${API}/ai/rag-citations`, { method: 'POST', body: JSON.stringify({ question }) });

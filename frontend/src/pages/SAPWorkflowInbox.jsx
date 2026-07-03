import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCornerUpRight,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiUserCheck,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import {
  actOnSapWorkflowTask,
  createSapWorkflowDelegation,
  createSapWorkflowTask,
  escalateSapOverdueWorkflow,
  fetchSapWorkflowOverview,
} from '../api';

const tabs = ['Ready', 'In Review', 'Escalated', 'Approved', 'Rejected'];
const priorityColor = {
  Critical: '#BB0000',
  High: '#E76500',
  Medium: '#0070F2',
  Low: '#498205',
};

function Badge({ children, tone = 'blue' }) {
  const colors = {
    blue: ['#E8F4FD', '#0070F2'],
    green: ['#E6F4EA', '#1E7E34'],
    red: ['#FDEDED', '#BB0000'],
    orange: ['#FFF4E5', '#E76500'],
    gray: ['#F0F2F5', '#6A767D'],
  };
  const [bg, color] = colors[tone] || colors.blue;
  return <span style={{ padding:'4px 9px', borderRadius:12, background:bg, color, fontSize:11, fontWeight:800, whiteSpace:'nowrap' }}>{children}</span>;
}

function Card({ children, style }) {
  return <div style={{ background:'#fff', border:'1px solid #E8EBF0', borderRadius:8, padding:16, ...style }}>{children}</div>;
}

function Metric({ label, value, icon: Icon, tone }) {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:tone === 'red' ? '#FDEDED' : tone === 'orange' ? '#FFF4E5' : '#E8F4FD', color:tone === 'red' ? '#BB0000' : tone === 'orange' ? '#E76500' : '#0070F2' }}>
          <Icon size={20} />
        </div>
        <div>
          <div style={{ fontSize:26, color:'#1D2D3E', fontWeight:800 }}>{value}</div>
          <div style={{ fontSize:12, color:'#6A767D', fontWeight:700, textTransform:'uppercase' }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Payload({ payload }) {
  const entries = payload && typeof payload === 'object' ? Object.entries(payload) : [];
  if (!entries.length) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
      {entries.map(([key, value]) => (
        <span key={key} style={{ padding:'5px 8px', border:'1px solid #E8EBF0', borderRadius:6, background:'#FAFBFC', fontSize:11, color:'#354A5F' }}>
          <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}
        </span>
      ))}
    </div>
  );
}

export default function SAPWorkflowInbox() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Ready');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [taskForm, setTaskForm] = useState({
    workflow_type: 'General Approval',
    title: 'Review custom business approval',
    business_object: 'Business Object',
    object_key: 'OBJ-1000',
    priority: 'Medium',
    processor_role: 'Manager',
    assigned_to: 'manager@sapcrm.com',
    due_days: 2,
  });
  const [delegationForm, setDelegationForm] = useState({
    delegator: 'controller@sapcrm.com',
    substitute: 'backup.controller@sapcrm.com',
    workflow_type: 'ALL',
    reason: 'Coverage',
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchSapWorkflowOverview());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const tasks = data?.tasks || [];
  const filtered = useMemo(() => tasks.filter((task) => task.status === activeTab), [tasks, activeTab]);

  const runAction = async (task, action) => {
    setBusy(`${task.id}-${action}`);
    setMessage('');
    try {
      await actOnSapWorkflowTask(task.id, {
        action,
        note: `${action} from SAP Workflow Inbox`,
        forward_to: action === 'forward' ? forwardTo : undefined,
      });
      setMessage(`Task ${task.task_key} ${action} completed.`);
      await load();
    } catch {
      setMessage(`Unable to ${action} task ${task.task_key}.`);
    }
    setBusy('');
  };

  const createTask = async () => {
    setBusy('create-task');
    setMessage('');
    try {
      await createSapWorkflowTask(taskForm);
      setMessage('Workflow task created.');
      await load();
    } catch {
      setMessage('Unable to create workflow task.');
    }
    setBusy('');
  };

  const createDelegation = async () => {
    setBusy('delegation');
    setMessage('');
    try {
      await createSapWorkflowDelegation(delegationForm);
      setMessage('Workflow delegation created.');
      await load();
    } catch {
      setMessage('Unable to create delegation.');
    }
    setBusy('');
  };

  const escalateOverdue = async () => {
    setBusy('escalate');
    setMessage('');
    try {
      const res = await escalateSapOverdueWorkflow();
      setMessage(`${res?.escalated?.length || 0} overdue tasks escalated.`);
      await load();
    } catch {
      setMessage('Unable to escalate overdue workflow tasks.');
    }
    setBusy('');
  };

  const tabCount = (status) => tasks.filter((task) => task.status === status).length;
  const dateText = (date) => date ? new Date(date).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'No due date';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SAP Workflow Inbox</h1>
          <p style={styles.subtitle}>Approvals, substitutions, forwarding, escalation, and decision audit history.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={escalateOverdue} disabled={busy === 'escalate'} style={styles.warningBtn}>
            <FiAlertTriangle size={15} />
            {busy === 'escalate' ? 'Escalating...' : 'Escalate Overdue'}
          </button>
          <button onClick={load} disabled={loading} style={styles.refreshBtn}>
            <FiRefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.metrics}>
        <Metric label="Ready" value={data?.summary?.ready ?? 0} icon={FiClock} />
        <Metric label="Overdue" value={data?.summary?.overdue ?? 0} icon={FiAlertTriangle} tone="orange" />
        <Metric label="Escalated" value={data?.summary?.escalated ?? 0} icon={FiCornerUpRight} tone="red" />
        <Metric label="Delegations" value={data?.summary?.delegations ?? 0} icon={FiUsers} />
      </div>

      {message && (
        <div style={styles.message}>
          <FiCheckCircle size={14} />
          {message}
        </div>
      )}

      <div style={styles.layout}>
        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <div style={styles.tabs}>
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}>
                  {tab} ({tabCount(tab)})
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {loading ? (
              <div style={styles.empty}>Loading workflow tasks...</div>
            ) : filtered.length === 0 ? (
              <div style={styles.empty}><FiFileText size={26} /> No {activeTab.toLowerCase()} workflow tasks.</div>
            ) : (
              <div style={styles.taskList}>
                {filtered.map((task) => {
                  const isClosed = ['Approved', 'Rejected', 'Completed'].includes(task.status);
                  const priorityTone = task.priority === 'Critical' ? 'red' : task.priority === 'High' ? 'orange' : 'blue';
                  return (
                    <div key={task.id} style={styles.taskCard}>
                      <div style={styles.taskTop}>
                        <div>
                          <div style={styles.taskTitle}>{task.title}</div>
                          <div style={styles.taskSub}>{task.workflow_type} · {task.business_object} {task.object_key} · {task.task_key}</div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                          <Badge tone={priorityTone}>{task.priority}</Badge>
                          <Badge tone={task.status === 'Escalated' ? 'red' : task.status === 'Approved' ? 'green' : task.status === 'Rejected' ? 'red' : 'blue'}>{task.status}</Badge>
                        </div>
                      </div>
                      <div style={styles.taskMeta}>
                        <span><FiUserCheck size={13} /> {task.processor_role}</span>
                        <span>Assigned: {task.substituted_to || task.assigned_to || 'Unassigned'}</span>
                        <span><FiClock size={13} /> Due {dateText(task.due_at)}</span>
                      </div>
                      <Payload payload={task.payload} />
                      {!isClosed && (
                        <div style={styles.taskActions}>
                          <button onClick={() => runAction(task, 'claim')} disabled={Boolean(busy)} style={styles.smallBtn}>Claim</button>
                          <button onClick={() => runAction(task, 'approve')} disabled={Boolean(busy)} style={styles.approveBtn}><FiCheckCircle size={13} /> Approve</button>
                          <button onClick={() => runAction(task, 'reject')} disabled={Boolean(busy)} style={styles.rejectBtn}><FiXCircle size={13} /> Reject</button>
                          <input style={styles.forwardInput} value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="forward.to@company.com" />
                          <button onClick={() => runAction(task, 'forward')} disabled={Boolean(busy || !forwardTo.trim())} style={styles.smallBtn}><FiSend size={13} /> Forward</button>
                          <button onClick={() => runAction(task, 'escalate')} disabled={Boolean(busy)} style={styles.escalateBtn}><FiCornerUpRight size={13} /> Escalate</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <Card>
            <h2 style={styles.panelTitle}>Create Workflow Task</h2>
            <div style={styles.form}>
              <input style={styles.input} value={taskForm.workflow_type} onChange={(e) => setTaskForm({ ...taskForm, workflow_type: e.target.value })} placeholder="Workflow type" />
              <input style={styles.input} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Title" />
              <input style={styles.input} value={taskForm.business_object} onChange={(e) => setTaskForm({ ...taskForm, business_object: e.target.value })} placeholder="Business object" />
              <input style={styles.input} value={taskForm.object_key} onChange={(e) => setTaskForm({ ...taskForm, object_key: e.target.value })} placeholder="Object key" />
              <select style={styles.input} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <input style={styles.input} value={taskForm.processor_role} onChange={(e) => setTaskForm({ ...taskForm, processor_role: e.target.value })} placeholder="Processor role" />
              <input style={styles.input} value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })} placeholder="Assigned to" />
              <input style={styles.input} type="number" value={taskForm.due_days} onChange={(e) => setTaskForm({ ...taskForm, due_days: e.target.value })} placeholder="Due days" />
              <button onClick={createTask} disabled={busy === 'create-task'} style={styles.primaryBtn}>
                <FiPlus size={14} />
                {busy === 'create-task' ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Delegation / Substitution</h2>
            <div style={styles.form}>
              <input style={styles.input} value={delegationForm.delegator} onChange={(e) => setDelegationForm({ ...delegationForm, delegator: e.target.value })} placeholder="Delegator" />
              <input style={styles.input} value={delegationForm.substitute} onChange={(e) => setDelegationForm({ ...delegationForm, substitute: e.target.value })} placeholder="Substitute" />
              <input style={styles.input} value={delegationForm.workflow_type} onChange={(e) => setDelegationForm({ ...delegationForm, workflow_type: e.target.value })} placeholder="Workflow type" />
              <input style={styles.input} value={delegationForm.reason} onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })} placeholder="Reason" />
              <button onClick={createDelegation} disabled={busy === 'delegation'} style={styles.primaryBtn}>
                <FiUsers size={14} />
                {busy === 'delegation' ? 'Saving...' : 'Create Delegation'}
              </button>
            </div>
          </Card>

          <Card>
            <h2 style={styles.panelTitle}>Decision Audit</h2>
            <div style={styles.auditList}>
              {(data?.audit || []).slice(0, 8).map((event) => (
                <div key={event.id} style={styles.auditRow}>
                  <div style={{ fontWeight:800, color:'#1D2D3E', fontSize:12 }}>{event.action}</div>
                  <div style={{ color:'#6A767D', fontSize:12 }}>{event.actor || 'system'} · {dateText(event.created_at)}</div>
                  {event.note && <div style={{ color:'#354A5F', fontSize:12, marginTop:3 }}>{event.note}</div>}
                </div>
              ))}
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
  subtitle: { margin:'4px 0 0', fontSize:13, color:'#6A767D' },
  metrics: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:16 },
  layout: { display:'grid', gridTemplateColumns:'minmax(0, 1fr) 360px', gap:16, alignItems:'start' },
  refreshBtn: { display:'flex', alignItems:'center', gap:7, padding:'9px 13px', border:'1px solid #D1D9E0', background:'#fff', color:'#354A5F', borderRadius:8, fontWeight:800, cursor:'pointer' },
  warningBtn: { display:'flex', alignItems:'center', gap:7, padding:'9px 13px', border:'1px solid #FFE0B2', background:'#FFF8F0', color:'#E76500', borderRadius:8, fontWeight:800, cursor:'pointer' },
  message: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', marginBottom:14, background:'#E6F4EA', border:'1px solid #CDECCB', color:'#1E7E34', borderRadius:8, fontSize:13, fontWeight:800 },
  tabs: { display:'flex', gap:8, flexWrap:'wrap' },
  tab: { padding:'8px 12px', border:'1px solid #D1D9E0', borderRadius:8, background:'#fff', color:'#354A5F', fontWeight:800, cursor:'pointer' },
  tabActive: { background:'#E8F4FD', borderColor:'#B8D8F8', color:'#0070F2' },
  taskList: { display:'grid', gap:12 },
  taskCard: { padding:14, border:'1px solid #E8EBF0', borderRadius:8, background:'#FAFBFC' },
  taskTop: { display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' },
  taskTitle: { fontSize:15, fontWeight:800, color:'#1D2D3E' },
  taskSub: { fontSize:12, color:'#6A767D', marginTop:3 },
  taskMeta: { display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:'#6A767D', marginTop:9 },
  taskActions: { display:'flex', gap:8, flexWrap:'wrap', marginTop:12, alignItems:'center' },
  smallBtn: { display:'flex', alignItems:'center', gap:5, padding:'7px 10px', border:'1px solid #D1D9E0', borderRadius:7, background:'#fff', color:'#354A5F', fontWeight:800, cursor:'pointer' },
  approveBtn: { display:'flex', alignItems:'center', gap:5, padding:'7px 10px', border:'none', borderRadius:7, background:'#1E7E34', color:'#fff', fontWeight:800, cursor:'pointer' },
  rejectBtn: { display:'flex', alignItems:'center', gap:5, padding:'7px 10px', border:'none', borderRadius:7, background:'#BB0000', color:'#fff', fontWeight:800, cursor:'pointer' },
  escalateBtn: { display:'flex', alignItems:'center', gap:5, padding:'7px 10px', border:'1px solid #FFE0B2', borderRadius:7, background:'#FFF8F0', color:'#E76500', fontWeight:800, cursor:'pointer' },
  forwardInput: { padding:'8px 10px', border:'1px solid #D1D9E0', borderRadius:7, minWidth:190, fontSize:12 },
  panelTitle: { margin:'0 0 12px', fontSize:16, color:'#1D2D3E' },
  form: { display:'grid', gap:9 },
  input: { padding:'9px 10px', border:'1px solid #D1D9E0', borderRadius:7, fontSize:13, color:'#1D2D3E', boxSizing:'border-box', width:'100%' },
  primaryBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 12px', border:'none', borderRadius:8, background:'#0070F2', color:'#fff', fontWeight:800, cursor:'pointer' },
  empty: { minHeight:180, display:'flex', gap:8, alignItems:'center', justifyContent:'center', color:'#6A767D', fontSize:13 },
  auditList: { display:'grid', gap:8 },
  auditRow: { padding:'9px 10px', border:'1px solid #E8EBF0', borderRadius:7, background:'#FAFBFC' },
};

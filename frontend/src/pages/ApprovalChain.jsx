import { useState, useEffect } from 'react';
import { fetchApprovalSteps, createApprovalStep, updateApprovalStep, deleteApprovalStep, recallApprovalStep } from '../api';

export default function ApprovalChain({ config, item, moduleKey }) {
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState({ total: 0, approved: 0, currentStep: 0 });
  const [overallStatus, setOverallStatus] = useState('Pending');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ approver: '', delegate: '', comments: '' });

  const hasApprovalChain = config?.hasApprovalChain;

  const load = () => {
    if (!hasApprovalChain || !item?.id) return;
    setLoading(true);
    fetchApprovalSteps(moduleKey, item.id)
      .then((res) => {
        setSteps(res?.steps || []);
        setProgress(res?.progress || { total: 0, approved: 0, currentStep: 0 });
        setOverallStatus(res?.overallStatus || 'Pending');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, hasApprovalChain]);

  if (!hasApprovalChain || !item) return null;

  const handleAdd = async () => {
    if (!form.approver) return;
    setError('');
    const res = await createApprovalStep(moduleKey, item.id, {
      ...form, step_order: steps.length + 1,
    });
    if (res?.error) { setError(res.error); return; }
    setForm({ approver: '', delegate: '', comments: '' });
    setAdding(false);
    load();
  };

  const handleDecision = async (stepId, status) => {
    setError('');
    const res = await updateApprovalStep(stepId, { status, decision_date: new Date().toISOString() });
    if (res?.error) { setError(res.error); return; }
    load();
  };

  const handleRecall = async (id) => {
    setError('');
    const res = await recallApprovalStep(id);
    if (res?.error) { setError(res.error); return; }
    load();
  };

  const handleDelete = async (id) => {
    await deleteApprovalStep(id);
    load();
  };

  const statusConfig = {
    'Pending': { bg: '#FFF4E5', color: '#E76500', icon: '\u23F3' },
    'Approved': { bg: '#E6F4EA', color: '#1E7E34', icon: '\u2713' },
    'Rejected': { bg: '#FDEDED', color: '#BB0000', icon: '\u2717' },
    'Delegated': { bg: '#E8F4FD', color: '#0070F2', icon: '\u21B7' },
  };

  const overallColors = {
    'Pending': { bg: '#FFF4E5', color: '#E76500' },
    'In Progress': { bg: '#E8F4FD', color: '#0070F2' },
    'Approved': { bg: '#E6F4EA', color: '#1E7E34' },
    'Rejected': { bg: '#FDEDED', color: '#BB0000' },
  };

  const oc = overallColors[overallStatus] || overallColors['Pending'];
  const progressPct = progress.total > 0 ? Math.round((progress.approved / progress.total) * 100) : 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Approval Chain</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...styles.overallBadge, background: oc.bg, color: oc.color }}>{overallStatus}</span>
          <button onClick={() => { setAdding(!adding); setError(''); }} style={styles.addBtn}>
            {adding ? 'Cancel' : '+ Add Step'}
          </button>
        </div>
      </div>
      {progress.total > 0 && (
        <div style={styles.progressBar}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressPct}%`, background: oc.color }} />
          </div>
          <span style={styles.progressText}>{progress.approved}/{progress.total} approved ({progressPct}%)</span>
        </div>
      )}
      {error && <div style={styles.errorBanner}>{error}</div>}
      {adding && (
        <div style={styles.addForm}>
          <input type="text" placeholder="Approver name" value={form.approver} onChange={e => setForm({ ...form, approver: e.target.value })} style={styles.input} />
          <input type="text" placeholder="Delegate (optional)" value={form.delegate} onChange={e => setForm({ ...form, delegate: e.target.value })} style={styles.input} />
          <input type="text" placeholder="Comments" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} style={styles.input} />
          <button onClick={handleAdd} style={styles.saveBtn}>Add</button>
        </div>
      )}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Loading approval chain...</div>
        ) : steps.length === 0 ? (
          <div style={styles.empty}>No approval steps defined</div>
        ) : (
          <div style={styles.chain}>
            {steps.map((step, i) => {
              const sc = statusConfig[step.status] || statusConfig['Pending'];
              const isCurrent = step.status === 'Pending' && i === progress.currentStep - 1;
              return (
                <div key={step.id} style={styles.stepWrap}>
                  {i > 0 && <div style={styles.connector}><div style={styles.connectorLine} /></div>}
                  <div style={{
                    ...styles.step,
                    borderLeft: `3px solid ${isCurrent ? '#0070F2' : sc.color}`,
                    background: isCurrent ? '#F0F7FF' : '#F7F8FA',
                  }}>
                    <div style={styles.stepHeader}>
                      <div style={styles.stepLeft}>
                        <span style={styles.stepNum}>Step {step.step_order}</span>
                        <span style={styles.stepApprover}>{step.approver}</span>
                        {step.delegate && <span style={styles.delegate}>Delegate: {step.delegate}</span>}
                        {step.escalated && <span style={styles.escalatedTag}>ESCALATED</span>}
                      </div>
                      <div style={styles.stepRight}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
                          background: sc.bg, color: sc.color,
                        }}>
                          {sc.icon} {step.status}
                        </span>
                      </div>
                    </div>
                    {step.comments && <div style={styles.comments}>{step.comments}</div>}
                    {step.decision_date && (
                      <div style={styles.decisionDate}>Decided: {new Date(step.decision_date).toLocaleString()}</div>
                    )}
                    {step.hours_pending !== undefined && step.status === 'Pending' && (
                      <div style={styles.escalationInfo}>
                        Pending: {step.hours_pending}h
                        {step.escalation_due
                          ? <span style={{ color: '#BB0000', fontWeight: 700 }}> — Escalation due!</span>
                          : <span> — Escalation in {step.hours_until_escalation}h</span>
                        }
                      </div>
                    )}
                    {isCurrent && (
                      <div style={styles.actions}>
                        <button onClick={() => handleDecision(step.id, 'Approved')} style={styles.approveBtn}>Approve</button>
                        <button onClick={() => handleDecision(step.id, 'Rejected')} style={styles.rejectBtn}>Reject</button>
                        <button onClick={() => handleRecall(step.id)} style={styles.recallBtn}>Recall</button>
                      </div>
                    )}
                    {step.status === 'Pending' && !isCurrent && (
                      <div style={styles.waitingMsg}>Waiting for prior steps...</div>
                    )}
                    {step.status === 'Pending' && (
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => handleDelete(step.id)} style={styles.removeStepBtn}>Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 16, border: '1px solid #E8EBF0', borderRadius: 8, overflow: 'hidden' },
  headingRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: '#FAFBFC', borderBottom: '1px solid #E8EBF0',
  },
  heading: { margin: 0, fontSize: 13, fontWeight: 600, color: '#354A5F', textTransform: 'uppercase', letterSpacing: '0.3px' },
  overallBadge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 },
  addBtn: {
    fontSize: 12, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  },
  progressBar: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
    background: '#F7F8FA', borderBottom: '1px solid #E8EBF0',
  },
  progressTrack: { flex: 1, height: 8, background: '#E8EBF0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  progressText: { fontSize: 11, color: '#6A767D', fontWeight: 600, whiteSpace: 'nowrap' },
  errorBanner: {
    padding: '8px 16px', background: '#FDEDED', borderBottom: '1px solid #F5C6C6',
    fontSize: 12, color: '#BB0000', fontWeight: 500,
  },
  addForm: {
    display: 'flex', gap: 8, padding: '12px 16px', background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0', flexWrap: 'wrap',
  },
  input: {
    flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #D1D9E0',
    borderRadius: 6, outline: 'none', boxSizing: 'border-box', minWidth: 120,
  },
  saveBtn: {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#0070F2', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  content: { background: '#fff', maxHeight: 450, overflowY: 'auto', padding: 16 },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  chain: {},
  stepWrap: { display: 'flex', flexDirection: 'column' },
  connector: { display: 'flex', justifyContent: 'center', padding: '4px 0' },
  connectorLine: { width: 2, height: 20, background: '#D1D9E0' },
  step: { padding: '12px 16px', borderRadius: '0 8px 8px 0' },
  stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  stepRight: {},
  stepNum: { fontSize: 10, fontWeight: 700, color: '#6A767D', textTransform: 'uppercase' },
  stepApprover: { fontSize: 14, fontWeight: 600, color: '#1D2D3E' },
  delegate: { fontSize: 11, color: '#6A767D', fontStyle: 'italic' },
  escalatedTag: {
    fontSize: 9, fontWeight: 700, color: '#BB0000', background: '#FDEDED',
    padding: '1px 6px', borderRadius: 8, alignSelf: 'flex-start',
  },
  comments: {
    fontSize: 12, color: '#6A767D', marginTop: 6, padding: '6px 10px',
    background: '#fff', borderRadius: 6, border: '1px solid #E8EBF0',
  },
  decisionDate: { fontSize: 11, color: '#A0AAB4', marginTop: 4 },
  escalationInfo: { fontSize: 11, color: '#6A767D', marginTop: 4 },
  actions: { display: 'flex', gap: 8, marginTop: 10 },
  approveBtn: {
    padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#1E7E34',
    background: '#E6F4EA', border: '1px solid #B7DFC3', borderRadius: 6, cursor: 'pointer',
  },
  rejectBtn: {
    padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#BB0000',
    background: '#FDEDED', border: '1px solid #F5C6C6', borderRadius: 6, cursor: 'pointer',
  },
  recallBtn: {
    padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#E76500',
    background: '#FFF4E5', border: '1px solid #FFE0B2', borderRadius: 6, cursor: 'pointer',
  },
  waitingMsg: { fontSize: 11, color: '#A0AAB4', fontStyle: 'italic', marginTop: 6 },
  removeStepBtn: {
    padding: '5px 14px', fontSize: 12, fontWeight: 500, color: '#6A767D',
    background: '#F0F2F5', border: '1px solid #D1D9E0', borderRadius: 6, cursor: 'pointer',
  },
};

import React, { useEffect, useState } from 'react';

const PROGRAMS = ['RFFOUS_T', 'RFBIBL00', 'RM07MMBL', 'RV60SBAT', 'RPCALCU0', 'RMMRP000'];
const OUTPUT_TARGETS = ['SPOOL', 'EMAIL', 'SFTP', 'S3_BUCKET'];

export default function BatchJobScheduler() {
  const [form, setForm] = useState({
    program: 'RFFOUS_T',
    variant: 'WEEKLY_PAY',
    cron: '0 2 * * *',
    outputTarget: 'SPOOL',
    description: 'Nightly payment proposal',
  });
  const [jobs, setJobs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/batch-jobs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setJobs(j.jobs || []))
      .catch(e => setErr(String(e)));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    setErr(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/batch-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to schedule');
      setMsg(`Scheduled ${j.job.id}`);
      load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const removeJob = async (id) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/custom-views/batch-jobs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div
      data-testid="batch-scheduler"
      style={{
        background: '#fff',
        border: '1px solid #E8EBF0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <h3 style={{ margin: '0 0 12px', color: '#1D2D3E' }}>Batch Job Scheduler</h3>

      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
        <Field label="ABAP Program">
          <select value={form.program} onChange={e => upd('program', e.target.value)} style={inp}>
            {PROGRAMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Variant">
          <input value={form.variant} onChange={e => upd('variant', e.target.value)} style={inp} />
        </Field>
        <Field label="Cron Schedule">
          <input
            value={form.cron}
            onChange={e => upd('cron', e.target.value)}
            placeholder="0 2 * * *"
            style={{ ...inp, fontFamily: 'monospace' }}
          />
        </Field>
        <Field label="Output Target">
          <select value={form.outputTarget} onChange={e => upd('outputTarget', e.target.value)} style={inp}>
            {OUTPUT_TARGETS.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input value={form.description} onChange={e => upd('description', e.target.value)} style={inp} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="submit"
            disabled={submitting}
            data-testid="schedule-btn"
            style={{
              padding: '8px 16px',
              background: '#0070F2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {submitting ? 'Scheduling…' : 'Schedule Job'}
          </button>
        </div>
      </form>

      {msg && <div style={{ color: '#1E8E3E', marginBottom: 8, fontSize: 13 }}>{msg}</div>}
      {err && <div style={{ color: '#C5221F', marginBottom: 8, fontSize: 13 }}>{err}</div>}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#6A767D', textTransform: 'uppercase', margin: '14px 0 6px' }}>
        Scheduled Jobs ({jobs.length})
      </div>
      {jobs.length === 0 ? (
        <div style={{ color: '#A0AAB4', fontSize: 13 }}>No jobs scheduled yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFBFC', textAlign: 'left' }}>
              <th style={th}>Job ID</th>
              <th style={th}>Program</th>
              <th style={th}>Variant</th>
              <th style={th}>Cron</th>
              <th style={th}>Output</th>
              <th style={th}>Next Run</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} style={{ borderTop: '1px solid #EEF1F5' }}>
                <td style={td}>{j.id}</td>
                <td style={td}>{j.program}</td>
                <td style={td}>{j.variant}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{j.cron}</td>
                <td style={td}>{j.outputTarget}</td>
                <td style={td}>{new Date(j.nextRun).toLocaleString()}</td>
                <td style={td}>
                  <button
                    onClick={() => removeJob(j.id)}
                    style={{ background: 'none', border: '1px solid #DB4437', color: '#DB4437', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const inp = {
  padding: '7px 10px',
  border: '1px solid #CFD7DF',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};
const th = { padding: '6px 8px', color: '#6A767D', fontWeight: 600, borderBottom: '1px solid #E8EBF0' };
const td = { padding: '6px 8px', color: '#1D2D3E' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#6A767D', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

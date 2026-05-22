import React, { useState } from 'react';
import { request } from '../api';

const sample = JSON.stringify([
  { id: 'PO-1009', value: 82000, daysWaiting: 6, approverLoad: 14 },
  { id: 'INV-228', value: 12000, daysWaiting: 2, approverLoad: 4 }
], null, 2);

export default function ApprovalExposure() {
  const [payload, setPayload] = useState(sample);
  const [result, setResult] = useState(null);

  async function run() {
    setResult(await request('/api/approval-exposure/score', {
      method: 'POST',
      body: JSON.stringify({ approvals: JSON.parse(payload) }),
    }));
  }

  return (
    <div className="page">
      <h1>Approval Exposure Monitor</h1>
      <p>Quantify delayed approval exposure by value, age, and approver workload.</p>
      <textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={12} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button className="btn-primary" onClick={run}>Score approvals</button>
      {result && (
        <div className="card">
          <h2>Total exposure ${result.totalExposure.toLocaleString()}</h2>
          {result.scored.map((row) => <div key={row.id}>{row.id}: ${row.exposure.toLocaleString()} | {row.priority} | {row.action}</div>)}
        </div>
      )}
    </div>
  );
}

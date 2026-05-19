import React from 'react';
import SystemStatusGrid from '../components/SystemStatusGrid';
import TransactionVolume from '../components/TransactionVolume';
import IDocInspector from '../components/IDocInspector';
import BatchJobScheduler from '../components/BatchJobScheduler';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#1D2D3E', fontSize: 24 }}>SAP Views</h1>
        <div style={{ color: '#6A767D', fontSize: 13, marginTop: 4 }}>
          SAP-integration platform / ERP automation — system health, transaction volume, IDoc inspection, and batch scheduling.
        </div>
      </div>

      <div data-testid="cv-system-status" style={{ marginBottom: 20 }}>
        <SystemStatusGrid />
      </div>

      <div data-testid="cv-tx-volume" style={{ marginBottom: 20 }}>
        <TransactionVolume />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
        }}
      >
        <div data-testid="cv-idoc"><IDocInspector /></div>
        <div data-testid="cv-batch"><BatchJobScheduler /></div>
      </div>
    </div>
  );
}

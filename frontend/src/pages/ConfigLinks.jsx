import { useState, useEffect } from 'react';
import { fetchConfigChain } from '../api';

export default function ConfigLinks({ config, item, moduleKey }) {
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState('forward');
  const [hasBrokenChain, setHasBrokenChain] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  const hasConfigChain = config?.configChain;

  const load = (dir) => {
    if (!hasConfigChain || !item?.id) return;
    setChain([]);
    setLoading(true);
    fetchConfigChain(moduleKey, item.id, dir || direction)
      .then((res) => {
        setChain(res?.chain || []);
        setHasBrokenChain(res?.hasBrokenChain || false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [item?.id, moduleKey, hasConfigChain]);

  if (!hasConfigChain || !item) return null;

  const handleDirectionToggle = () => {
    const newDir = direction === 'forward' ? 'reverse' : 'forward';
    setDirection(newDir);
    load(newDir);
  };

  const toggleNode = (i) => {
    setExpandedNodes(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const nodeColors = {
    products: { bg: '#E8F4FD', color: '#0070F2', border: '#B8D8F8' },
    bill_of_materials: { bg: '#F8F5FF', color: '#8B47D7', border: '#E8DEF8' },
    routings: { bg: '#E6F4EA', color: '#1E7E34', border: '#B7DFC3' },
    work_centers: { bg: '#FFF4E5', color: '#E76500', border: '#FFE0B2' },
    production_orders: { bg: '#FFF0F0', color: '#BB0000', border: '#F5C6C6' },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.headingRow}>
        <h3 style={styles.heading}>Configuration Chain</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasBrokenChain && <span style={styles.brokenBadge}>Broken Chain</span>}
          <button onClick={handleDirectionToggle} style={styles.dirBtn}>
            {direction === 'forward' ? 'Forward \u25BC' : 'Reverse \u25B2'}
          </button>
        </div>
      </div>
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Tracing configuration links...</div>
        ) : chain.length === 0 ? (
          <div style={styles.empty}>No configuration chain found</div>
        ) : (
          <div style={styles.chain}>
            {chain.map((node, i) => {
              const nc = nodeColors[node.module] || { bg: '#F0F2F5', color: '#354A5F', border: '#D1D9E0' };
              const isBroken = !node.found;
              const isExpanded = expandedNodes[i] !== false;
              return (
                <div key={i} style={styles.nodeWrap}>
                  {i > 0 && (
                    <div style={styles.connector}>
                      <div style={{ ...styles.connectorLine, background: isBroken ? '#BB0000' : '#D1D9E0', borderStyle: isBroken ? 'dashed' : 'solid' }} />
                      <span style={styles.connectorArrow}>{direction === 'forward' ? '\u25BC' : '\u25B2'}</span>
                    </div>
                  )}
                  <div
                    style={{
                      ...styles.node,
                      background: nc.bg,
                      border: isBroken ? '2px dashed #BB0000' : `1px solid ${nc.border}`,
                      cursor: node.found ? 'pointer' : 'default',
                    }}
                    onClick={() => node.found && toggleNode(i)}
                  >
                    <div style={styles.nodeHeader}>
                      <span style={{ ...styles.nodeType, color: nc.color }}>{node.module.replace(/_/g, ' ')}</span>
                      {node.found && <span style={styles.foundBadge}>Found</span>}
                      {!node.found && <span style={styles.missingBadge}>Not Found</span>}
                    </div>
                    {node.found && (
                      <div style={styles.nodeBody}>
                        <span style={{ ...styles.nodeName, color: nc.color }}>
                          {node.name || node.number || `#${node.id}`}
                        </span>
                        {node.status && <span style={styles.nodeStatus}>{node.status}</span>}
                        {node.material && <span style={styles.nodeMaterial}>{node.material}</span>}
                      </div>
                    )}
                    {node.found && isExpanded && node.fields && Object.keys(node.fields).length > 0 && (
                      <div style={styles.nodeFields}>
                        {Object.entries(node.fields).map(([k, v]) => (
                          <span key={k} style={styles.fieldTag}>{k}: {v}</span>
                        ))}
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px',
    background: '#FAFBFC', borderBottom: '1px solid #E8EBF0',
  },
  heading: {
    margin: 0, fontSize: 13, fontWeight: 600, color: '#354A5F', textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  dirBtn: {
    fontSize: 11, fontWeight: 600, color: '#0070F2', background: '#E8F4FD',
    border: '1px solid #B8D8F8', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  },
  brokenBadge: {
    fontSize: 10, fontWeight: 700, color: '#BB0000', background: '#FDEDED',
    padding: '3px 8px', borderRadius: 8,
  },
  content: { background: '#fff', maxHeight: 450, overflowY: 'auto', padding: 16 },
  loading: { padding: 20, textAlign: 'center', fontSize: 13, color: '#6A767D' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13, color: '#A0AAB4' },
  chain: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  nodeWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 420 },
  connector: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: 32 },
  connectorLine: { width: 2, flex: 1 },
  connectorArrow: { fontSize: 10, color: '#A0AAB4', lineHeight: 1 },
  node: { width: '100%', borderRadius: 8, padding: '12px 16px' },
  nodeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nodeType: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' },
  foundBadge: {
    fontSize: 10, fontWeight: 600, color: '#1E7E34', background: '#E6F4EA', padding: '2px 8px', borderRadius: 10,
  },
  missingBadge: {
    fontSize: 10, fontWeight: 600, color: '#BB0000', background: '#FDEDED', padding: '2px 8px', borderRadius: 10,
  },
  nodeBody: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nodeName: { fontSize: 14, fontWeight: 600 },
  nodeStatus: { fontSize: 11, color: '#6A767D', background: '#fff', padding: '2px 8px', borderRadius: 10 },
  nodeMaterial: { fontSize: 11, color: '#6A767D', fontStyle: 'italic' },
  nodeFields: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  fieldTag: {
    fontSize: 10, color: '#6A767D', background: '#fff', padding: '2px 8px',
    borderRadius: 6, border: '1px solid #E8EBF0',
  },
};

export default function WorkflowActions({ config, item, onStatusChange }) {
  if (!config?.workflows || !item) return null;

  const { statusField, transitions } = config.workflows;
  const currentStatus = item[statusField || 'status'];
  const available = transitions?.[currentStatus];

  if (!available || available.length === 0) return null;

  const handleClick = (transition) => {
    if (onStatusChange) {
      onStatusChange({ [statusField || 'status']: transition.nextStatus });
    }
  };

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Actions:</span>
      {available.map((t, i) => (
        <button
          key={i}
          onClick={() => handleClick(t)}
          style={{ ...styles.btn, background: t.color || '#0070F2' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#F7F8FA',
    borderBottom: '1px solid #E8EBF0',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6A767D',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginRight: 4,
  },
  btn: {
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
};

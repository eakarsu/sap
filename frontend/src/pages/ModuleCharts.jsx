import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0070F2', '#E76500', '#498205', '#BB0000', '#8B47D7', '#00B7C3', '#D14900', '#1B6AC9', '#E3008C', '#354A5F'];

function aggregate(items, groupBy, agg, valueField) {
  const groups = {};
  items.forEach((item) => {
    const key = item[groupBy] || 'Unknown';
    if (!groups[key]) groups[key] = { name: key, value: 0, count: 0 };
    groups[key].count += 1;
    if (agg === 'sum' && valueField) {
      groups[key].value += parseFloat(item[valueField]) || 0;
    }
  });
  if (agg === 'count') {
    Object.values(groups).forEach((g) => { g.value = g.count; });
  }
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function formatVal(val) {
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(0) + 'K';
  if (val > 0 && val < 1) return val.toFixed(2);
  return val.toLocaleString();
}

function ChartCard({ chart, items }) {
  const data = useMemo(
    () => aggregate(items, chart.groupBy, chart.aggregate, chart.valueField),
    [items, chart]
  );

  if (data.length === 0) return null;

  const isPie = chart.type === 'pie';
  const isCurrency = chart.aggregate === 'sum' && chart.valueField;

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{chart.title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        {isPie ? (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={85}
              label={({ name, value }) => `${name}: ${isCurrency ? formatVal(value) : value}`}
              labelLine={true}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => isCurrency ? formatVal(v) : v} />
          </PieChart>
        ) : (
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6A767D' }} interval={0} angle={data.length > 6 ? -30 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 30} />
            <YAxis tick={{ fontSize: 11, fill: '#6A767D' }} tickFormatter={(v) => isCurrency ? formatVal(v) : v} />
            <Tooltip formatter={(v) => isCurrency ? formatVal(v) : v} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function ModuleCharts({ config, items }) {
  if (!config?.charts || !items || items.length === 0) return null;

  return (
    <div style={styles.wrapper}>
      {config.charts.map((chart, i) => (
        <ChartCard key={i} chart={chart} items={items} />
      ))}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 16,
    marginBottom: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #E8EBF0',
    padding: '16px 16px 8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 600,
    color: '#354A5F',
  },
};

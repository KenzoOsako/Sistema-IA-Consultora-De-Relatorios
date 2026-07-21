'use client';

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import styles from './ChartRenderer.module.css';

const BRAND_COLORS = [
  '#C06D3B', // Terracota (primary)
  '#35415B', // Azul-marinho (secondary)
  '#5B8A6E', // Verde suave
  '#B5885A', // Dourado
  '#7B6FAD', // Roxo suave
  '#4E8FA8', // Azul petróleo
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        {label && <p className={styles.tooltipLabel}>{label}</p>}
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: <strong>{
              typeof entry.value === 'number'
                ? entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
                : entry.value
            }</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * ChartRenderer — Renderiza gráficos dinâmicos a partir de configuração JSON.
 *
 * Formato esperado (emitido pelo Gemini dentro de um bloco ```chart):
 * {
 *   "type": "bar" | "line" | "pie",
 *   "title": "Título do Gráfico",
 *   "data": [
 *     { "name": "Jan", "Receita": 15000, "Despesa": 9000 },
 *     ...
 *   ],
 *   "keys": ["Receita", "Despesa"]  // para bar/line; omitir para pie
 * }
 *
 * Para pie chart:
 * {
 *   "type": "pie",
 *   "title": "Composição de Despesas",
 *   "data": [
 *     { "name": "Operacional", "value": 45000 },
 *     { "name": "Marketing", "value": 12000 }
 *   ]
 * }
 */
export default function ChartRenderer({ config }) {
  if (!config || !config.data || config.data.length === 0) {
    return null;
  }

  const { type, title, data, keys } = config;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                tickFormatter={(v) => v.toLocaleString('pt-BR')} />
              <Tooltip content={<CustomTooltip />} />
              {keys && keys.length > 1 && <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }} />}
              {(keys || ['value']).map((key, i) => (
                <Bar key={key} dataKey={key} fill={BRAND_COLORS[i % BRAND_COLORS.length]}
                  radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                tickFormatter={(v) => v.toLocaleString('pt-BR')} />
              <Tooltip content={<CustomTooltip />} />
              {keys && keys.length > 1 && <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }} />}
              {(keys || ['value']).map((key, i) => (
                <Line key={key} type="monotone" dataKey={key}
                  stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                  strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={95}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.chartWrapper}>
      {title && <p className={styles.chartTitle}>{title}</p>}
      {renderChart()}
    </div>
  );
}

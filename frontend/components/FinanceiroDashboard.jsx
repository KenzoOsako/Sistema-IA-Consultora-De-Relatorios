'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function FinanceiroDashboard() {
  const [ano, setAno] = useState('2026');
  const [mes, setMes] = useState('Todos');

  // URL do embed do Power BI (substitua pelo link gerado na opção "Arquivo > Inserir Relatório > Site ou Portal")
  const embedUrl = "https://app.powerbi.com/view?r=eyJrIjoiYTRlNjJmZDUtMzZmZi00OTlhLTllNTUtYzgxODU1YzBkYWZlIiwidCI6IjI1ZGU5M2FhLTc1ZWYtNDc0Ny05YjZiLWQwYTI4YzRjZGI0YyIsImMiOjEwfQ%3D%3D";

  // Dados mockados para o Fallback (Recharts)
  const barData = [
    { name: 'Jan', receita: 4000 },
    { name: 'Fev', receita: 3000 },
    { name: 'Mar', receita: 5000 },
    { name: 'Abr', receita: 2780 },
    { name: 'Mai', receita: 4890 },
    { name: 'Jun', receita: 6390 },
  ];

  const pieData = [
    { name: 'Operacional', value: 400 },
    { name: 'Marketing', value: 300 },
    { name: 'RH', value: 300 },
    { name: 'Infraestrutura', value: 200 },
  ];
  const COLORS = ['var(--color-primary)', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', flex: 1, minHeight: 0 }}>
      
      {/* Barra de Filtros (Control Bar) */}
      <div style={{
        display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem',
        backgroundColor: 'rgba(15, 19, 31, 0.4)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px',
        alignItems: 'center', flexShrink: 0
      }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', color: '#fff' }}>Filtros Financeiros:</span>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Ano</label>
          <select 
            value={ano} onChange={e => setAno(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.4)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '0.5rem 1rem', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}
          >
            <option value="2026" style={{ background: '#1E1E24' }}>2026</option>
            <option value="2025" style={{ background: '#1E1E24' }}>2025</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Mês</label>
          <select 
            value={mes} onChange={e => setMes(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.4)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '0.5rem 1rem', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}
          >
            <option value="Todos" style={{ background: '#1E1E24' }}>Todos os Meses</option>
            <option value="1" style={{ background: '#1E1E24' }}>Janeiro</option>
            <option value="2" style={{ background: '#1E1E24' }}>Fevereiro</option>
            <option value="3" style={{ background: '#1E1E24' }}>Março</option>
            <option value="4" style={{ background: '#1E1E24' }}>Abril</option>
            <option value="5" style={{ background: '#1E1E24' }}>Maio</option>
            <option value="6" style={{ background: '#1E1E24' }}>Junho</option>
          </select>
        </div>
      </div>

      {/* Container do Power BI / Fallback */}
      <div style={{
        flex: 1, backgroundColor: 'rgba(15, 19, 31, 0.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: 0
      }}>
        {embedUrl ? (
          <iframe 
            title="Power BI Report"
            src={embedUrl}
            frameBorder="0"
            allowFullScreen={true}
            style={{ width: '100%', height: '100%', borderRadius: '8px' }}
          ></iframe>
        ) : (
          <div style={{ display: 'flex', height: '100%', gap: '2rem' }}>
            {/* Gráfico de Barras - Receita */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#fff', fontWeight: '400' }}>Receita Mensal (Simulação)</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1E1E24', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="receita" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Rosca - Despesas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#fff', fontWeight: '400' }}>Composição de Despesas</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E24', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {pieData.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

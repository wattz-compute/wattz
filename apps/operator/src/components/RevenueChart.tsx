'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenuePoint } from '@/lib/api';

interface RevenueChartProps {
  data: RevenuePoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const rows = data.map((p) => ({
    ts: new Date(p.timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    revenue: Number((p.revenue_lamports / 1_000_000_000).toFixed(4)),
    requests: p.requests,
  }));

  return (
    <div className="wattz-card h-72 rounded-lg p-4">
      <div className="metric-label mb-3">Revenue (SOL / day)</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,217,61,0.06)" vertical={false} />
          <XAxis
            dataKey="ts"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,217,61,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,217,61,0.12)' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A2E',
              border: '1px solid rgba(255,217,61,0.35)',
              borderRadius: 6,
              color: '#F0EAD6',
              fontSize: 12,
            }}
            formatter={(value: number, key) => {
              if (key === 'revenue') return [`${value.toFixed(4)} SOL`, 'revenue'];
              return [value.toLocaleString(), key];
            }}
          />
          <Bar dataKey="revenue" fill="#FFD93D" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

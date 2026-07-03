'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenuePoint } from '@/lib/api';

interface RevenueChartProps {
  data: RevenuePoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="wattz-card flex h-72 flex-col rounded-lg p-4">
        <div className="metric-label mb-3">Revenue ($WATTZ / day)</div>
        <div className="flex flex-1 items-center justify-center text-center text-xs text-fog">
          No revenue recorded yet.
        </div>
      </div>
    );
  }

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
      <div className="metric-label mb-3">Revenue ($WATTZ / day) + requests</div>
      <ResponsiveContainer width="100%" height="88%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,217,61,0.06)" vertical={false} />
          <XAxis
            dataKey="ts"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,217,61,0.12)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,217,61,0.12)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="requests"
            orientation="right"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(91,192,235,0.15)' }}
            tickLine={false}
            tickFormatter={(v: number) => v.toLocaleString()}
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
              if (key === 'revenue') return [`${value.toFixed(4)} $WATTZ`, 'revenue'];
              return [value.toLocaleString(), 'requests'];
            }}
          />
          <Bar yAxisId="revenue" dataKey="revenue" fill="#FFD93D" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="requests"
            type="monotone"
            dataKey="requests"
            stroke="#5BC0EB"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

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
import type { StatsHistoryPoint } from '@/lib/api';

interface ThroughputChartProps {
  data: StatsHistoryPoint[];
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="wattz-card flex h-72 flex-col rounded-lg p-4">
        <div className="metric-label mb-3">Network throughput (14d)</div>
        <div className="flex flex-1 items-center justify-center text-center text-xs text-fog">
          No throughput recorded yet.
        </div>
      </div>
    );
  }

  const rows = data.map((p) => ({
    ts: new Date(p.timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    inferences: p.inferences,
    revenue: Number((p.revenue_lamports / 1_000_000_000).toFixed(4)),
  }));

  return (
    <div className="wattz-card h-72 rounded-lg p-4">
      <div className="metric-label mb-3">Network throughput (14d) — inferences / day + revenue</div>
      <ResponsiveContainer width="100%" height="88%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(91,192,235,0.06)" vertical={false} />
          <XAxis
            dataKey="ts"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(91,192,235,0.15)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="inferences"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(91,192,235,0.15)' }}
            tickLine={false}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,217,61,0.12)' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A2E',
              border: '1px solid rgba(91,192,235,0.35)',
              borderRadius: 6,
              color: '#F0EAD6',
              fontSize: 12,
            }}
            formatter={(value: number, key) => {
              if (key === 'revenue') return [`${value.toFixed(4)} SOL`, 'revenue'];
              return [value.toLocaleString(), 'inferences'];
            }}
          />
          <Bar yAxisId="inferences" dataKey="inferences" fill="#5BC0EB" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#FFD93D"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

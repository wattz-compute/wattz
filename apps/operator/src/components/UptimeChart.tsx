'use client';

import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { UptimePoint } from '@/lib/api';

interface UptimeChartProps {
  data: UptimePoint[];
}

export function UptimeChart({ data }: UptimeChartProps) {
  const rows = data.map((p) => ({
    ts: new Date(p.timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    uptime: p.uptime_pct,
    requests: p.requests,
  }));

  return (
    <div className="wattz-card h-72 rounded-lg p-4">
      <div className="metric-label mb-3">Uptime (30d rolling %)</div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5BC0EB" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#5BC0EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(91,192,235,0.08)" vertical={false} />
          <XAxis
            dataKey="ts"
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(91,192,235,0.15)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#8B8680', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(91,192,235,0.15)' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
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
              if (key === 'uptime') return [`${value.toFixed(2)}%`, 'uptime'];
              return [value.toLocaleString(), key];
            }}
          />
          <Area
            type="monotone"
            dataKey="uptime"
            stroke="#5BC0EB"
            strokeWidth={2}
            fill="url(#uptimeGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

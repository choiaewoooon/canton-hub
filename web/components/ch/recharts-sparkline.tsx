"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  data: number[];
  color: string;
  height?: number;
  fill?: boolean;
  className?: string;
}

/**
 * Small decorative sparkline backed by Recharts — responsive via ResponsiveContainer.
 * Replaces the hand-rolled inline-SVG sparkline that didn't resize well on narrow widths.
 */
export default function RechartsSparkline({
  data,
  color,
  height = 32,
  fill = true,
  className = "",
}: Props) {
  if (!data || data.length < 2) return <div className={className} style={{ height }} />;
  const points = data.map((v, i) => ({ i, v }));
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "").slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <div className={className} style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fill ? 0.28 : 0} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
